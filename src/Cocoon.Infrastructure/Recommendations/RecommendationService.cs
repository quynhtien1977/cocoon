using System.Text.Json;
using Cocoon.Application.Recommendations;
using Cocoon.Domain.Entities;
using Cocoon.Domain.Enums;
using Cocoon.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Cocoon.Infrastructure.Recommendations;

public sealed record RebuildResult(int CustomerCount, int RecommendationCount, DateTime BuiltAt);

/// <summary>
/// Spec 7.1–7.3: gathers signals from the database and the COC-42 views, scores with RecommendationScorer and replaces
/// each customer's Active recommendations. Runs synchronously inside the request; there is no background job.
/// </summary>
public sealed class RecommendationService(AppDbContext db, CustomerFactsService facts, IOptions<RecommendationWeights> weights)
{
    internal static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    /// <summary>Rebuilds for the given customers, or for everyone (refreshing mv_product_copurchase first) when null.</summary>
    public async Task<RebuildResult> RebuildAsync(IReadOnlyCollection<int>? customerIds, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        if (customerIds is null)
            await db.Database.ExecuteSqlRawAsync("REFRESH MATERIALIZED VIEW mv_product_copurchase", ct);
        var customers = await facts.LoadAsync(customerIds, ct);
        var ids = customers.Select(c => c.Id).ToArray();

        var tags = (await db.Set<ProductPreference>().ToListAsync(ct)).ToLookup(x => x.ProductId, x => x.PreferenceId);
        var ratings = await db.Set<Feedback>().GroupBy(f => f.ProductId)
            .Select(g => new { ProductId = g.Key, Average = g.Average(f => (decimal)f.Rating), Count = g.Count() })
            .ToDictionaryAsync(x => x.ProductId, ct);
        var candidates = (await db.Set<Product>().Where(p => p.Status == ProductStatus.Active)
                .Join(db.Set<Category>(), p => p.CategoryId, c => c.Id, (p, c) => new { p.Id, p.Name, p.CategoryId, CategoryName = c.Name, p.Status })
                .ToListAsync(ct))
            .Select(p => new CandidateProduct(p.Id, p.Name, p.CategoryId, p.CategoryName, p.Status, tags[p.Id].ToList(),
                ratings.GetValueOrDefault(p.Id)?.Average, ratings.GetValueOrDefault(p.Id)?.Count ?? 0))
            .ToList();
        var productNames = await db.Set<Product>().IgnoreQueryFilters().ToDictionaryAsync(p => p.Id, p => p.Name, ct);

        var preferences = (await db.Set<CustomerPreference>().Where(x => ids.Contains(x.CustomerId))
            .Join(db.Set<Preference>(), x => x.PreferenceId, p => p.Id, (x, p) => new { x.CustomerId, x.PreferenceId, p.Name, x.Source })
            .ToListAsync(ct)).ToLookup(x => x.CustomerId);
        var share = (await db.Database.SqlQuery<AffinityRow>($"""SELECT "CustomerId", "CategoryId", "Share" FROM v_customer_category_affinity""")
            .ToListAsync(ct)).ToLookup(x => x.CustomerId);
        var coPurchase = (await db.Database.SqlQuery<CoPurchaseRow>($"""SELECT "ProductA", "ProductB", "Confidence" FROM mv_product_copurchase""")
            .ToListAsync(ct)).ToLookup(x => x.ProductB);
        var purchases = (await (
            from o in db.Set<Order>()
            join i in db.Set<OrderItem>() on o.Id equals i.OrderId
            join v in db.Set<ProductVariant>().IgnoreQueryFilters() on i.ProductVariantId equals v.Id
            where ids.Contains(o.CustomerId) && o.Status == OrderStatus.Completed && o.OrderedAt <= now
            select new { o.CustomerId, v.ProductId, o.OrderedAt }).ToListAsync(ct)).ToLookup(x => x.CustomerId);
        var dismissedSince = now.AddDays(-90);
        var dismissed = (await db.Set<Recommendation>()
            .Where(r => ids.Contains(r.CustomerId) && r.Status == RecommendationStatus.Dismissed && r.InteractedAt >= dismissedSince)
            .Select(r => new { r.CustomerId, r.ProductId }).ToListAsync(ct)).ToLookup(x => x.CustomerId, x => x.ProductId);
        var lowRatedProducts = (await db.Set<Feedback>().Where(f => ids.Contains(f.CustomerId) && f.Rating <= 2)
            .Select(f => new { f.CustomerId, f.ProductId }).ToListAsync(ct)).ToLookup(x => x.CustomerId, x => x.ProductId);
        var plans = await ActivePlansAsync(now, ct);

        var rows = new List<Recommendation>();
        foreach (var customer in customers)
        {
            var bought = purchases[customer.Id].ToList();
            var boughtIds = bought.Select(x => x.ProductId).ToHashSet();
            var customerPreferences = preferences[customer.Id].ToList();
            var signals = new CustomerSignals(
                customerPreferences.Where(x => x.Source == PreferenceSource.Declared).ToDictionary(x => x.PreferenceId, x => x.Name),
                customerPreferences.Where(x => x.Source == PreferenceSource.Survey).Select(x => x.PreferenceId).ToHashSet(),
                share[customer.Id].ToDictionary(x => x.CategoryId, x => x.Share),
                candidates.Select(p => (p.Id, Best: coPurchase[p.Id].Where(x => boughtIds.Contains(x.ProductA)).MaxBy(x => x.Confidence)))
                    .Where(x => x.Best is not null)
                    .ToDictionary(x => x.Id, x => new CoPurchaseSignal(x.Best!.Confidence, productNames.GetValueOrDefault(x.Best.ProductA, ""))),
                plans.Where(p => SegmentMatcher.Matches(customer, p.Segment))
                    .SelectMany(p => p.ProductIds.Select(productId => (productId, Signal: new PlanSignal(p.Id, p.Name))))
                    .GroupBy(x => x.productId).ToDictionary(g => g.Key, g => g.First().Signal),
                bought.Where(x => x.OrderedAt >= now.AddDays(-60)).Select(x => x.ProductId).ToHashSet(),
                dismissed[customer.Id].ToHashSet(),
                customer.LowRatedCategoryIds,
                lowRatedProducts[customer.Id].ToHashSet());
            rows.AddRange(RecommendationScorer.Score(signals, candidates, weights.Value).Select(s => new Recommendation
            {
                CustomerId = customer.Id, ProductId = s.ProductId, Score = s.Score, PlanId = s.PlanId, GeneratedAt = now,
                Breakdown = JsonSerializer.Serialize(s.Breakdown, Json), Reasons = JsonSerializer.Serialize(s.Reasons, Json)
            }));
        }

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        // Older Active rows are expired first: a unique index allows one Active row per customer and product.
        await db.Set<Recommendation>().Where(r => ids.Contains(r.CustomerId) && r.Status == RecommendationStatus.Active)
            .ExecuteUpdateAsync(s => s.SetProperty(r => r.Status, RecommendationStatus.Expired), ct);
        db.AddRange(rows);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return new RebuildResult(customers.Count, rows.Count, now);
    }

    /// <summary>Customers matching a plan's segment, for activation notices and targeted rebuilds.</summary>
    public async Task<List<int>> PlanAudienceAsync(RecommendationPlan plan, CancellationToken ct) =>
        (await facts.MatchAsync(ReadSegment(plan.Segment), ct)).Select(c => c.Id).ToList();

    public static SegmentFilter? ReadSegment(string json) => JsonSerializer.Deserialize<SegmentFilter>(json, Json);

    private async Task<List<ActivePlan>> ActivePlansAsync(DateTime now, CancellationToken ct)
    {
        var plans = await db.Set<RecommendationPlan>()
            .Where(p => p.Status == RecommendationPlanStatus.Active && p.StartAt <= now && p.EndAt > now).OrderBy(p => p.Id).ToListAsync(ct);
        var planIds = plans.Select(p => p.Id).ToArray();
        var products = (await db.Set<RecommendationPlanProduct>().Where(x => planIds.Contains(x.PlanId)).OrderBy(x => x.SortOrder)
            .ToListAsync(ct)).ToLookup(x => x.PlanId, x => x.ProductId);
        return plans.Select(p => new ActivePlan(p.Id, p.Name, ReadSegment(p.Segment), products[p.Id].ToList())).ToList();
    }

    private sealed record ActivePlan(int Id, string Name, SegmentFilter? Segment, List<int> ProductIds);
    private sealed record AffinityRow(int CustomerId, int CategoryId, decimal Share);
    private sealed record CoPurchaseRow(int ProductA, int ProductB, decimal Confidence);
}
