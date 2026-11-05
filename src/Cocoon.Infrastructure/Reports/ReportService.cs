using System.Data;
using Cocoon.Application.Reports;
using Cocoon.Domain.Entities;
using Cocoon.Domain.Enums;
using Cocoon.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Cocoon.Infrastructure.Reports;

/// <summary>Read-only SQL aggregates. Current customer composition and retained event history have separate populations.</summary>
public sealed class ReportService(AppDbContext db) : IReportService
{
    private static readonly string[] AgeGroups = ["<18", "18–24", "25–34", "35–44", "≥45", "Chưa cung cấp"];

    private IQueryable<CustomerProfile> ActiveCustomers => db.Set<CustomerProfile>().AsNoTracking()
        .Where(c => c.Account.Role == AccountRole.Customer && c.Account.IsActive);

    public Task<ReportOverview> OverviewAsync(ReportPeriod period, CancellationToken ct) => Snapshot(async () =>
    {
        var now = DateTime.UtcNow;
        var month = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var recent = now.AddDays(-30);
        var customerSummary = await ActiveCustomers.GroupBy(c => 1).Select(g => new
        {
            Total = g.Count(), Recent = g.Count(c => c.Account.CreatedAt >= recent && c.Account.CreatedAt < now),
            ThisMonth = g.Count(c => c.Account.CreatedAt >= month && c.Account.CreatedAt < now)
        }).SingleOrDefaultAsync(ct);
        var ratings = await Feedbacks(period, now).GroupBy(f => 1).Select(g => new
        {
            Total = g.Count(), New = g.Count(f => f.Status == FeedbackStatus.New), Average = g.Average(f => (decimal?)f.Rating)
        }).SingleOrDefaultAsync(ct);
        var open = await db.Set<Survey>().CountAsync(s => s.Status == SurveyStatus.Open
            && (s.OpenAt == null || s.OpenAt <= now) && (s.CloseAt == null || s.CloseAt > now), ct);
        var responses = db.Set<SurveyResponse>().AsNoTracking(); // History deliberately does not join filtered customer/survey rows.
        if (period.From is { } from) { var start = from.UtcDateTime; responses = responses.Where(r => r.SubmittedAt >= start); }
        var end = period.To?.UtcDateTime ?? now;
        var completed = await responses.CountAsync(r => r.SubmittedAt < end, ct);
        return new ReportOverview(customerSummary?.Total ?? 0, customerSummary?.Recent ?? 0, ratings?.New ?? 0,
            ratings?.Average, open, customerSummary?.ThisMonth ?? 0, ratings?.Total ?? 0, completed);
    }, ct);

    public async Task<CustomerAgeReport> CustomersByAgeAsync(CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var age18 = today.AddYears(-18); var age25 = today.AddYears(-25);
        var age35 = today.AddYears(-35); var age45 = today.AddYears(-45);
        var counts = await ActiveCustomers.GroupBy(c => c.DateOfBirth == null ? 5
            : c.DateOfBirth > age18 ? 0 : c.DateOfBirth > age25 ? 1 : c.DateOfBirth > age35 ? 2 : c.DateOfBirth > age45 ? 3 : 4)
            .Select(g => new { Group = g.Key, Count = g.Count() }).ToListAsync(ct);
        var total = counts.Sum(g => g.Count);
        var items = AgeGroups.Select((label, index) => {
            var count = counts.Where(g => g.Group == index).Sum(g => g.Count);
            return new CustomerAgeRow(label, count, Percentage(count, total));
        }).ToArray();
        return new(items, total, today);
    }

    public async Task<CustomerGenderReport> CustomersByGenderAsync(CancellationToken ct)
    {
        var counts = await ActiveCustomers.GroupBy(c => c.Gender == null || c.Gender.Trim() == "" ? "Chưa cung cấp" : c.Gender)
            .Select(g => new { Gender = g.Key!, Count = g.Count() }).ToListAsync(ct);
        var total = counts.Sum(g => g.Count);
        return new(counts.OrderBy(g => g.Gender, StringComparer.Ordinal)
            .Select(g => new CustomerGenderRow(g.Gender, g.Count, Percentage(g.Count, total))).ToArray(), total,
            DateOnly.FromDateTime(DateTime.UtcNow));
    }

    public Task<CustomerPreferenceReport> CustomersByPreferenceAsync(CancellationToken ct) => Snapshot(async () =>
    {
        var consenting = ActiveCustomers.Where(c => c.ConsentPersonalData);
        var denominator = await consenting.CountAsync(ct);
        var counts = await (from c in consenting
            join cp in db.Set<CustomerPreference>() on c.AccountId equals cp.CustomerId
            join preference in db.Set<Preference>() on cp.PreferenceId equals preference.Id
            group c by new { preference.Id, preference.Name } into g
            select new { g.Key.Id, g.Key.Name, Count = g.Count() }).ToListAsync(ct);
        return new CustomerPreferenceReport(counts.OrderByDescending(g => g.Count).ThenBy(g => g.Id)
            .Select(g => new CustomerPreferenceRow(g.Id, g.Name, g.Count, Percentage(g.Count, denominator))).ToArray(), denominator);
    }, ct);

    public Task<FeedbackRatingReport> FeedbackRatingsAsync(ReportPeriod period, CancellationToken ct) => Snapshot(async () =>
    {
        var rows = Feedbacks(period, DateTime.UtcNow);
        var distribution = await rows.GroupBy(f => f.Rating).Select(g => new { Rating = g.Key, Count = g.Count() }).ToListAsync(ct);
        var total = distribution.Sum(g => g.Count);
        decimal? average = total == 0 ? null : distribution.Sum(g => (decimal)g.Rating * g.Count) / total;
        var months = await rows.GroupBy(f => new { f.CreatedAt.Year, f.CreatedAt.Month }).Select(g => new
        {
            g.Key.Year, g.Key.Month, Count = g.Count(), Average = g.Average(f => (decimal)f.Rating), Low = g.Count(f => f.Rating <= 2)
        }).ToListAsync(ct);
        // IgnoreQueryFilters preserves feedback of products/customers that were later deleted.
        var products = await (from f in rows join p in db.Set<Product>().IgnoreQueryFilters() on f.ProductId equals p.Id
            group f by new { p.Id, p.Name } into g
            select new { g.Key.Id, g.Key.Name, Count = g.Count(), Average = g.Average(f => (decimal)f.Rating) }).ToListAsync(ct);
        var categories = await (from f in rows join p in db.Set<Product>().IgnoreQueryFilters() on f.ProductId equals p.Id
            join category in db.Set<Category>() on p.CategoryId equals category.Id
            group f by new { category.Id, category.Name } into g
            select new { g.Key.Id, g.Key.Name, Count = g.Count(), Average = g.Average(f => (decimal)f.Rating) }).ToListAsync(ct);
        return new FeedbackRatingReport(total, average,
            Enumerable.Range(1, 5).Select(rating => {
                var count = distribution.Where(g => g.Rating == rating).Sum(g => g.Count);
                return new RatingDistributionRow(rating, count, Percentage(count, total));
            }).ToArray(),
            months.OrderBy(g => g.Year).ThenBy(g => g.Month).Select(g => new MonthlyRatingRow(
                $"{g.Year:D4}-{g.Month:D2}", g.Count, g.Average, (decimal)g.Low / g.Count)).ToArray(),
            products.OrderBy(g => g.Id).Select(g => new ProductRatingRow(g.Id, g.Name, g.Count, g.Average)).ToArray(),
            categories.OrderBy(g => g.Id).Select(g => new CategoryRatingRow(g.Id, g.Name, g.Count, g.Average)).ToArray());
    }, ct);

    public async Task<CategoryPurchaseReport> PurchasesByCategoryAsync(ReportPeriod period, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(now);
        var age18 = today.AddYears(-18); var age25 = today.AddYears(-25);
        var age35 = today.AddYears(-35); var age45 = today.AddYears(-45);
        var orders = db.Set<Order>().AsNoTracking().Where(o => o.Status == OrderStatus.Completed);
        if (period.From is { } from) { var start = from.UtcDateTime; orders = orders.Where(o => o.OrderedAt >= start); }
        var end = period.To?.UtcDateTime ?? now;
        orders = orders.Where(o => o.OrderedAt < end);
        var rows = await (from o in orders
            join item in db.Set<OrderItem>() on o.Id equals item.OrderId
            join v in db.Set<ProductVariant>().IgnoreQueryFilters() on item.ProductVariantId equals v.Id
            join product in db.Set<Product>().IgnoreQueryFilters() on v.ProductId equals product.Id
            join category in db.Set<Category>() on product.CategoryId equals category.Id
            join customer in db.Set<CustomerProfile>().IgnoreQueryFilters() on o.CustomerId equals customer.AccountId
            let ageGroup = customer.DateOfBirth == null ? 5 : customer.DateOfBirth > age18 ? 0
                : customer.DateOfBirth > age25 ? 1 : customer.DateOfBirth > age35 ? 2 : customer.DateOfBirth > age45 ? 3 : 4
            group new { o.Id, item.Quantity, item.UnitPrice } by new { category.Id, category.Name, AgeGroup = ageGroup } into g
            select new { g.Key.Id, g.Key.Name, g.Key.AgeGroup, Revenue = g.Sum(x => x.Quantity * x.UnitPrice),
                Quantity = g.Sum(x => (long)x.Quantity), Orders = g.Select(x => x.Id).Distinct().Count() }).ToListAsync(ct);
        return new(rows.OrderBy(g => g.Id).ThenBy(g => g.AgeGroup)
            .Select(g => new CategoryPurchaseRow(g.Id, g.Name, AgeGroups[g.AgeGroup], g.Revenue, g.Quantity, g.Orders)).ToArray(), today);
    }

    public Task<RecommendationReport> RecommendationsAsync(ReportPeriod period, CancellationToken ct) => Snapshot(async () =>
    {
        var now = DateTime.UtcNow;
        var end = period.To?.UtcDateTime ?? now;
        var rows = db.Set<Recommendation>().AsNoTracking().Where(r => r.GeneratedAt < end);
        if (period.From is { } from) rows = rows.Where(r => r.GeneratedAt >= from.UtcDateTime);
        var eligible = ActiveCustomers.Where(c => c.ConsentPersonalData).Select(c => c.AccountId);
        var eligibleCount = await eligible.CountAsync(ct);
        var covered = await rows.Where(r => eligible.Contains(r.CustomerId)).Select(r => r.CustomerId).Distinct().CountAsync(ct);
        var totals = await rows.GroupBy(r => 1).Select(g => new
        {
            Count = g.Count(), Clicks = g.Count(r => r.Status == RecommendationStatus.Clicked),
            Dismissals = g.Count(r => r.Status == RecommendationStatus.Dismissed), LastBuiltAt = (DateTime?)g.Max(r => r.GeneratedAt)
        }).SingleOrDefaultAsync(ct);
        var count = totals?.Count ?? 0;
        var clicks = totals?.Clicks ?? 0;
        var dismissals = totals?.Dismissals ?? 0;
        var activePlans = await db.Set<RecommendationPlan>().CountAsync(p => p.Status == RecommendationPlanStatus.Active && p.StartAt <= now && p.EndAt > now, ct);

        // Aggregate in the database before joining retained catalog names; never load individual recommendations.
        var products = await rows.GroupBy(r => r.ProductId).Select(g => new
            {
                Id = g.Key, Count = g.Count(), Clicks = g.Count(r => r.Status == RecommendationStatus.Clicked),
                Dismissals = g.Count(r => r.Status == RecommendationStatus.Dismissed)
            }).Join(db.Set<Product>().IgnoreQueryFilters(), r => r.Id, p => p.Id, (r, p) => new { r.Id, p.Name, r.Count, r.Clicks, r.Dismissals })
            .OrderByDescending(r => r.Clicks).ThenByDescending(r => r.Count).ThenBy(r => r.Id).Take(10).ToListAsync(ct);
        var planGroups = rows.GroupBy(r => r.PlanId).Select(g => new
        {
            PlanId = g.Key, Customers = g.Select(r => r.CustomerId).Distinct().Count(), Count = g.Count(),
            Clicks = g.Count(r => r.Status == RecommendationStatus.Clicked), Dismissals = g.Count(r => r.Status == RecommendationStatus.Dismissed)
        });
        var plans = await (from g in planGroups
            join p in db.Set<RecommendationPlan>() on g.PlanId equals (int?)p.Id into matched
            from p in matched.DefaultIfEmpty()
            orderby g.PlanId.HasValue, g.PlanId
            select new { g.PlanId, PlanName = p == null ? null : p.Name, g.Customers, g.Count, g.Clicks, g.Dismissals }).ToListAsync(ct);
        return new RecommendationReport(eligibleCount, covered, Ratio(covered, eligibleCount), count, clicks, dismissals,
            Ratio(clicks, count), Ratio(dismissals, count), activePlans, totals?.LastBuiltAt,
            products.Select(p => new RecommendationProductRow(p.Id, p.Name, p.Count, p.Clicks, p.Dismissals, Ratio(p.Clicks, p.Count), Ratio(p.Dismissals, p.Count))).ToList(),
            plans.Select(p => new RecommendationPlanRow(p.PlanId, p.PlanName, p.Customers, p.Count, p.Clicks, p.Dismissals, Ratio(p.Clicks, p.Count), Ratio(p.Dismissals, p.Count))).ToList());
    }, ct);

    private static decimal Ratio(int numerator, int denominator) => denominator == 0 ? 0 : Math.Round((decimal)numerator / denominator, 6, MidpointRounding.AwayFromZero);

    private IQueryable<Feedback> Feedbacks(ReportPeriod period, DateTime now)
    {
        var rows = db.Set<Feedback>().AsNoTracking();
        if (period.From is { } from) { var start = from.UtcDateTime; rows = rows.Where(f => f.CreatedAt >= start); }
        var end = period.To?.UtcDateTime ?? now;
        return rows.Where(f => f.CreatedAt < end);
    }

    private async Task<T> Snapshot<T>(Func<Task<T>> read, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.RepeatableRead, ct);
        var result = await read();
        await transaction.CommitAsync(ct);
        return result;
    }

    private static decimal Percentage(int count, int total) => total == 0 ? 0 : Math.Round(100m * count / total, 2);
}
