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
