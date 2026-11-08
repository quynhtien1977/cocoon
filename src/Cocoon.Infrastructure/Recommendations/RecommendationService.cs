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
        // Recommendations read preferences, purchases and ratings, so only customers who consented get them. Customers in
        // scope who withdrew consent lose their Active rows below and receive none.
        var consenting = await ConsentingIdsAsync(customerIds, ct);
        var customers = (await facts.LoadAsync(customerIds, ct)).Where(c => consenting.Contains(c.Id)).ToList();
        var ids = customers.Select(c => c.Id).ToArray();
        var withdrawn = await db.Set<CustomerProfile>()
            .Where(c => !c.ConsentPersonalData && (customerIds == null || customerIds.Contains(c.AccountId)))
            .Select(c => c.AccountId).ToListAsync(ct);
        var expire = ids.Concat(withdrawn).ToArray();

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
        await db.Set<Recommendation>().Where(r => expire.Contains(r.CustomerId) && r.Status == RecommendationStatus.Active)
            .ExecuteUpdateAsync(s => s.SetProperty(r => r.Status, RecommendationStatus.Expired), ct);
        db.AddRange(rows);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return new RebuildResult(customers.Count, rows.Count, now);
    }

    /// <summary>C0/C8: the customer's Active recommendations, best first, as in spec 6.3. Deleted products drop out.</summary>
    public async Task<List<RecommendationItem>> ActiveItemsAsync(int customerId, int? take, CancellationToken ct)
    {
        var query = db.Set<Recommendation>().Where(r => r.CustomerId == customerId && r.Status == RecommendationStatus.Active)
            .Join(db.Set<Product>(), r => r.ProductId, p => p.Id, (r, p) => new { RecommendationId = r.Id, r.Score, r.Reasons, ProductId = p.Id, p.Name })
            .OrderByDescending(x => x.Score).ThenBy(x => x.ProductId);
        var rows = await (take is null ? query : query.Take(take.Value)).ToListAsync(ct);
        var productIds = rows.Select(x => x.ProductId).ToArray();
        var variants = (await db.Set<ProductVariant>().Where(v => productIds.Contains(v.ProductId)).OrderBy(v => v.Price).ThenBy(v => v.Id)
            .ToListAsync(ct)).ToLookup(v => v.ProductId);
        var ratings = await db.Set<Feedback>().Where(f => productIds.Contains(f.ProductId)).GroupBy(f => f.ProductId)
            .Select(g => new { ProductId = g.Key, Average = g.Average(f => (double)f.Rating) }).ToDictionaryAsync(x => x.ProductId, x => x.Average, ct);
        return rows.Select(x => new RecommendationItem(x.RecommendationId, x.Score,
            new RecommendedProduct(x.ProductId, x.Name, variants[x.ProductId].FirstOrDefault()?.Price,
                variants[x.ProductId].FirstOrDefault(v => v.ImageUrl != null)?.ImageUrl,
                ratings.TryGetValue(x.ProductId, out var avg) ? Math.Round(avg, 1) : null),
            ReadReasons(x.Reasons))).ToList();
    }

    /// <summary>M4 tab: the customer's current recommendations, including ones they clicked or dismissed.</summary>
    public async Task<List<CustomerRecommendationRow>> CustomerRowsAsync(int customerId, CancellationToken ct) =>
        (await db.Set<Recommendation>().Where(r => r.CustomerId == customerId && r.Status != RecommendationStatus.Expired)
            .Join(db.Set<Product>().IgnoreQueryFilters(), r => r.ProductId, p => p.Id, (r, p) => new { r, p.Name })
            .OrderByDescending(x => x.r.Score).ThenBy(x => x.r.ProductId).ToListAsync(ct))
        .Select(x => new CustomerRecommendationRow(x.r.Id, x.r.ProductId, x.Name, x.r.Score, x.r.Status, x.r.PlanId,
            ReadReasons(x.r.Reasons), JsonSerializer.Deserialize<Dictionary<string, decimal>>(x.r.Breakdown, Json) ?? [], x.r.GeneratedAt, x.r.InteractedAt))
        .ToList();

    private static List<RecommendationReason> ReadReasons(string json) => JsonSerializer.Deserialize<List<RecommendationReason>>(json, Json) ?? [];

    /// <summary>Customers matching a plan's segment, for activation notices and targeted rebuilds.</summary>
    public async Task<List<int>> PlanAudienceAsync(RecommendationPlan plan, CancellationToken ct) =>
        (await ConsentingFactsAsync(ct)).Where(c => SegmentMatcher.Matches(c, ReadSegment(plan.Segment))).Select(c => c.Id).ToList();

    /// <summary>Segment facts of customers who consented: plans target them by preferences and purchases.</summary>
    public async Task<List<CustomerFacts>> ConsentingFactsAsync(CancellationToken ct)
    {
        var consenting = await ConsentingIdsAsync(null, ct);
        return (await facts.LoadAsync(null, ct)).Where(c => consenting.Contains(c.Id)).ToList();
    }

    private async Task<HashSet<int>> ConsentingIdsAsync(IReadOnlyCollection<int>? customerIds, CancellationToken ct) =>
        (await db.Set<CustomerProfile>()
            .Where(c => c.ConsentPersonalData && (customerIds == null || customerIds.Contains(c.AccountId)))
            .Select(c => c.AccountId).ToListAsync(ct)).ToHashSet();

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
