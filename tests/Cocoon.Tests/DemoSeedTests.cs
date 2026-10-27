using Cocoon.Domain;
using Cocoon.Domain.Entities;
using Cocoon.Domain.Enums;
using Cocoon.Infrastructure.Seeding;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Cocoon.Tests;

public sealed class DemoSeedTests(DemoSeedDatabaseFixture database) : IClassFixture<DemoSeedDatabaseFixture>
{
    private static readonly DateTime ReferenceUtc = new(2026, 10, 23, 0, 0, 0, DateTimeKind.Utc);
    private readonly PasswordHasher<Account> _hasher = new();
    private string Hash(Account account) => _hasher.HashPassword(account, "Demo@12345");

    [Fact]
    public async Task Rerun_preserves_user_edits_credentials_soft_deletes_and_historical_order_prices()
    {
        await using var db = database.CreateContext();
        await using var transaction = await db.Database.BeginTransactionAsync();
        await new DemoDataSeeder(db, Hash, ReferenceUtc).RunAsync();
        var account = await db.Set<Account>().SingleAsync(a => a.Email == "customer01@cocoon.demo");
        account.PasswordHash = _hasher.HashPassword(account, "ChangedPass9");
        var passwordHash = account.PasswordHash;
        account.IsActive = false;
        account.IsDeleted = true;
        account.FailedLoginCount = 3;
        var customer = await db.Set<CustomerProfile>().IgnoreQueryFilters().SingleAsync(c => c.AccountId == account.Id);
        customer.FullName = "Tên khách đã sửa";
        var preference = await db.Set<CustomerPreference>().FirstAsync(p => p.CustomerId == account.Id);
        db.Remove(preference);
        var product = await db.Set<Product>().FirstAsync();
        product.Name = "Tên sản phẩm đã sửa";
        var variant = await db.Set<ProductVariant>().FirstAsync(v => v.ProductId == product.Id);
        variant.Price = 123456;
        variant.IsDeleted = true;
        var external = new Account { Email = "outside-seed@example.test", PasswordHash = "unchanged", Role = AccountRole.Customer };
        db.Add(external);
        await db.SaveChangesAsync();
        var ordersBefore = await db.Set<Order>().OrderBy(o => o.Id).Select(o => new { o.Id, o.Code, o.TotalAmount, o.OrderedAt }).ToArrayAsync();
        var itemsBefore = await db.Set<OrderItem>().OrderBy(i => i.Id).Select(i => new { i.Id, i.Quantity, i.UnitPrice }).ToArrayAsync();
        var preferenceCount = await db.Set<CustomerPreference>().CountAsync(p => p.CustomerId == account.Id);
        var variantCount = await db.Set<ProductVariant>().IgnoreQueryFilters().CountAsync();
        db.ChangeTracker.Clear();

        var added = await new DemoDataSeeder(db, _ => throw new InvalidOperationException("Không được hash lại tài khoản cũ."), ReferenceUtc.AddMonths(1)).RunAsync();
        Assert.Equal(0, added);
        Assert.Equal(88, await db.Set<Account>().IgnoreQueryFilters().CountAsync());
        var saved = await db.Set<Account>().IgnoreQueryFilters().SingleAsync(a => a.Id == account.Id);
        Assert.Equal(passwordHash, saved.PasswordHash);
        Assert.False(saved.IsActive);
        Assert.True(saved.IsDeleted);
        Assert.Equal(3, saved.FailedLoginCount);
        Assert.Equal("Tên khách đã sửa", (await db.Set<CustomerProfile>().IgnoreQueryFilters().SingleAsync(c => c.AccountId == account.Id)).FullName);
        Assert.Equal(preferenceCount, await db.Set<CustomerPreference>().CountAsync(p => p.CustomerId == account.Id));
        Assert.Equal("Tên sản phẩm đã sửa", (await db.Set<Product>().SingleAsync(p => p.Id == product.Id)).Name);
        Assert.Equal(123456, (await db.Set<ProductVariant>().IgnoreQueryFilters().SingleAsync(v => v.Id == variant.Id)).Price);
        Assert.Equal(variantCount, await db.Set<ProductVariant>().IgnoreQueryFilters().CountAsync());
        Assert.Equal("unchanged", (await db.Set<Account>().SingleAsync(a => a.Id == external.Id)).PasswordHash);
        Assert.Equal(ordersBefore, await db.Set<Order>().OrderBy(o => o.Id).Select(o => new { o.Id, o.Code, o.TotalAmount, o.OrderedAt }).ToArrayAsync());
        Assert.Equal(itemsBefore, await db.Set<OrderItem>().OrderBy(i => i.Id).Select(i => new { i.Id, i.Quantity, i.UnitPrice }).ToArrayAsync());
    }

    [Fact]
    public async Task Failure_after_inserts_rolls_back_the_entire_seed_transaction()
    {
        await using (var db = database.CreateContext())
            await Assert.ThrowsAsync<InvalidOperationException>(() => new DemoDataSeeder(db,
                a => a.Role == AccountRole.Manager ? throw new InvalidOperationException("Giả lập lỗi seed.") : Hash(a), ReferenceUtc).RunAsync());
        await using var verify = database.CreateContext();
        Assert.Equal(0, await verify.Set<Account>().IgnoreQueryFilters().CountAsync());
        Assert.Equal(0, await verify.Set<Preference>().CountAsync());
        Assert.Equal(0, await verify.Set<CustomerProfile>().IgnoreQueryFilters().CountAsync());
    }

    [Fact]
    public async Task Seed_v1_has_valid_demo_accounts_catalog_customers_and_purchase_distribution()
    {
        await using var db = database.CreateContext();
        await using var transaction = await db.Database.BeginTransactionAsync();
        await new DemoDataSeeder(db, Hash, ReferenceUtc).RunAsync();
        db.ChangeTracker.Clear();

        var accounts = await db.Set<Account>().IgnoreQueryFilters().ToListAsync();
        var customers = await db.Set<CustomerProfile>().IgnoreQueryFilters().ToListAsync();
        Assert.Equal(87, accounts.Count);
        Assert.Equal(83, customers.Count);
        Assert.Equal(80, customers.Count(c => accounts.Any(a => a.Id == c.AccountId && a.IsActive && !a.IsDeleted)));
        Assert.Equal(2, accounts.Count(a => !a.IsActive));
        Assert.Single(accounts, a => a.IsDeleted);
        Assert.Equal(4, await db.Set<StaffProfile>().CountAsync());
        foreach (var account in accounts)
            Assert.NotEqual(PasswordVerificationResult.Failed, _hasher.VerifyHashedPassword(account, account.PasswordHash, "Demo@12345"));
        Assert.Equal(AccountRole.Admin, accounts.Single(a => a.Email == "admin@cocoon.demo").Role);
        Assert.Equal(AccountRole.Manager, accounts.Single(a => a.Email == "manager@cocoon.demo").Role);
        Assert.Equal(2, accounts.Count(a => a.Role == AccountRole.Staff));
        Assert.Contains(customers, c => c.DateOfBirth is null);
        Assert.Contains(customers, c => !c.ConsentPersonalData);
        Assert.All(customers, c => Assert.Equal(SearchText.Normalize(c.FullName), c.FullNameNormalized));
        var ageBuckets = customers.Where(c => c.DateOfBirth.HasValue).Select(c =>
        {
            var dob = c.DateOfBirth!.Value;
            var age = ReferenceUtc.Year - dob.Year - (dob > DateOnly.FromDateTime(ReferenceUtc).AddYears(-(ReferenceUtc.Year - dob.Year)) ? 1 : 0);
            return age < 18 ? 0 : age < 25 ? 1 : age < 35 ? 2 : age < 45 ? 3 : 4;
        }).Distinct();
        Assert.Equal(5, ageBuckets.Count());
        Assert.Equal(3, customers.Select(c => c.Gender).Distinct().Count());

        var preferences = await db.Set<CustomerPreference>().ToListAsync();
        Assert.Equal(12, await db.Set<Preference>().CountAsync());
        Assert.All(customers, c => Assert.InRange(preferences.Count(p => p.CustomerId == c.AccountId), 2, 4));
        var products = await db.Set<Product>().ToListAsync();
        var variants = await db.Set<ProductVariant>().ToListAsync();
        var tags = await db.Set<ProductPreference>().ToListAsync();
        Assert.Equal(6, await db.Set<Category>().CountAsync());
        Assert.Equal(24, products.Count);
        Assert.Equal(2, products.Count(p => p.Status == ProductStatus.Upcoming));
        Assert.Contains(products, p => p.Status == ProductStatus.Inactive);
        Assert.All(products, p =>
        {
            Assert.InRange(variants.Count(v => v.ProductId == p.Id), 1, 3);
            Assert.InRange(tags.Count(t => t.ProductId == p.Id), 2, 3);
            Assert.Equal(SearchText.Normalize(p.Name), p.NameNormalized);
        });

        var orders = await db.Set<Order>().ToListAsync();
        var items = await db.Set<OrderItem>().ToListAsync();
        Assert.Equal(320, orders.Count);
        Assert.Equal(640, items.Count);
        Assert.Equal(12, orders.Select(o => (o.OrderedAt.Year, o.OrderedAt.Month)).Distinct().Count());
        Assert.Equal(3, orders.Select(o => o.Channel).Distinct().Count());
        Assert.Equal(3, orders.Select(o => o.Status).Distinct().Count());
        Assert.All(orders, o =>
        {
            Assert.InRange(o.OrderedAt, ReferenceUtc.AddMonths(-12), ReferenceUtc);
            Assert.Equal(items.Where(i => i.OrderId == o.Id).Sum(i => i.Quantity * i.UnitPrice), o.TotalAmount);
        });
        Assert.All(items, i =>
        {
            Assert.True(i.Quantity > 0 && i.UnitPrice > 0);
            Assert.Equal(ProductStatus.Active, products.Single(p => p.Id == variants.Single(v => v.Id == i.ProductVariantId).ProductId).Status);
        });
        Assert.All(variants, v =>
        {
            Assert.StartsWith("data:image/svg+xml;base64,", v.ImageUrl);
            Assert.InRange(v.ImageUrl!.Length, 1, 2048);
        });
        var matched = items.Count(i => tags.Any(t => t.ProductId == variants.Single(v => v.Id == i.ProductVariantId).ProductId
            && preferences.Any(p => p.CustomerId == orders.Single(o => o.Id == i.OrderId).CustomerId && p.PreferenceId == t.PreferenceId)));
        Assert.Equal(0.70m, (decimal)matched / items.Count);
        var pairs = orders.Where(o => o.Status == OrderStatus.Completed).Select(o => new
        {
            o.CustomerId,
            Pair = string.Join(',', items.Where(i => i.OrderId == o.Id).Select(i => variants.Single(v => v.Id == i.ProductVariantId).ProductId).Order())
        }).GroupBy(x => x.Pair);
        Assert.Contains(pairs, pair => pair.Select(x => x.CustomerId).Distinct().Count() >= 3);
        Assert.Equal(0, await db.Set<Feedback>().CountAsync());
        Assert.Equal(0, await db.Set<Survey>().CountAsync());
        Assert.Equal(0, await db.Set<RecommendationPlan>().CountAsync());
    }
}
