using Cocoon.Application.Recommendations;
using Cocoon.Domain.Entities;
using Cocoon.Domain.Enums;
using Cocoon.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Cocoon.Infrastructure.Recommendations;

/// <summary>Loads segment facts for active customers. Data sizes are seed-scale (~100 customers), so matching runs in memory.</summary>
public sealed class CustomerFactsService(AppDbContext db)
{
    public async Task<List<CustomerFacts>> LoadAsync(IReadOnlyCollection<int>? customerIds, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(now);
        var customers = db.Set<CustomerProfile>().Where(c => c.Account.Role == AccountRole.Customer && c.Account.IsActive);
        if (customerIds is not null) customers = customers.Where(c => customerIds.Contains(c.AccountId));
        var rows = await customers.Select(c => new { c.AccountId, c.FullName, c.Account.Email, c.DateOfBirth, c.Gender }).ToListAsync(ct);
        var ids = rows.Select(x => x.AccountId).ToArray();

        var preferences = (await db.Set<CustomerPreference>().Where(x => ids.Contains(x.CustomerId))
            .Select(x => new { x.CustomerId, x.PreferenceId }).ToListAsync(ct)).ToLookup(x => x.CustomerId, x => x.PreferenceId);
        var purchases = await (
            from o in db.Set<Order>()
            join i in db.Set<OrderItem>() on o.Id equals i.OrderId
            join v in db.Set<ProductVariant>().IgnoreQueryFilters() on i.ProductVariantId equals v.Id
            join p in db.Set<Product>().IgnoreQueryFilters() on v.ProductId equals p.Id
            where ids.Contains(o.CustomerId) && o.Status == OrderStatus.Completed && o.OrderedAt <= now
            select new { o.CustomerId, p.CategoryId, o.OrderedAt }).ToListAsync(ct);
        var byCustomer = purchases.ToLookup(x => x.CustomerId);
        var lowRated = (await db.Database
            .SqlQuery<CustomerCategoryRow>($"""SELECT "CustomerId", "CategoryId" FROM v_customer_low_rated_category""")
            .ToListAsync(ct)).ToLookup(x => x.CustomerId, x => x.CategoryId);

        return rows.Select(c =>
        {
            var bought = byCustomer[c.AccountId].ToList();
            return new CustomerFacts(c.AccountId, c.FullName, c.Email, Age(c.DateOfBirth, today), c.Gender,
                preferences[c.AccountId].ToHashSet(), bought.Select(x => x.CategoryId).ToHashSet(), lowRated[c.AccountId].ToHashSet(),
                bought.Count == 0 ? null : (int)(now - bought.Max(x => x.OrderedAt)).TotalDays);
        }).ToList();
    }

    public async Task<List<CustomerFacts>> MatchAsync(SegmentFilter? filter, CancellationToken ct) =>
        (await LoadAsync(null, ct)).Where(c => SegmentMatcher.Matches(c, filter)).ToList();

    private static int? Age(DateOnly? birth, DateOnly today) =>
        birth is null ? null : today.Year - birth.Value.Year - (today < birth.Value.AddYears(today.Year - birth.Value.Year) ? 1 : 0);

    private sealed record CustomerCategoryRow(int CustomerId, int CategoryId);
}
