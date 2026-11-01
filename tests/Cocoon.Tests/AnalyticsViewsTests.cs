using Cocoon.Domain.Entities;
using Cocoon.Domain.Enums;
using Cocoon.Infrastructure.Persistence;
using Cocoon.Infrastructure.Seeding;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Cocoon.Tests;

public sealed class AnalyticsViewsTests(DemoSeedDatabaseFixture database) : IClassFixture<DemoSeedDatabaseFixture>
{
    [Fact]
    public async Task Views_are_queryable_on_an_empty_database()
    {
        await using var db = database.CreateContext();
        Assert.Empty(await db.Database.SqlQueryRaw<CopurchaseRow>("SELECT * FROM public.mv_product_copurchase").ToListAsync());
        Assert.Empty(await db.Database.SqlQueryRaw<AffinityRow>("SELECT * FROM public.v_customer_category_affinity").ToListAsync());
        Assert.Empty(await db.Database.SqlQueryRaw<RatingRow>("SELECT * FROM public.v_product_rating").ToListAsync());
        Assert.Empty(await db.Database.SqlQueryRaw<LowRatedRow>("SELECT * FROM public.v_customer_low_rated_category").ToListAsync());
    }

    [Fact]
    public async Task Copurchase_counts_unique_customers_across_orders_and_refreshes_directional_confidence()
    {
        await using var db = database.CreateContext();
        await using var transaction = await db.Database.BeginTransactionAsync();
        var catalog = await Catalog(db);
        var customers = await Customers(db, 5);
        var past = DateTime.UtcNow.AddDays(-1);
        var v = catalog.Variants;
        // A single customer buying variants or repeat orders is still one buyer of the product.
        await Purchase(db, customers[0], past, OrderStatus.Completed, (v[0], 5), (v[3], 9));
        await Purchase(db, customers[0], past, OrderStatus.Completed, (v[1], 1), (v[2], 1));
        await Purchase(db, customers[0], past, OrderStatus.Completed, (v[0], 1), (v[1], 1));
        await Purchase(db, customers[1], past, OrderStatus.Completed, (v[0], 1), (v[1], 1));
        await Purchase(db, customers[2], past, OrderStatus.Completed, (v[0], 1), (v[1], 1), (v[2], 1));
        await Purchase(db, customers[3], past, OrderStatus.Completed, (v[0], 1));
        await Purchase(db, customers[4], past, OrderStatus.Cancelled, (v[0], 1), (v[1], 1));
        await Purchase(db, customers[4], past, OrderStatus.Returned, (v[0], 1), (v[1], 1));
        await Purchase(db, customers[4], past.AddDays(2), OrderStatus.Completed, (v[0], 1), (v[1], 1));
        customers[0].Account.IsDeleted = true;
        catalog.Products[0].IsDeleted = true;
        v[0].IsDeleted = true;
        await db.SaveChangesAsync();

        Assert.Empty(await Pairs(db)); // Materialized results stay unchanged until refresh.
        await Refresh(db);
        var pairs = await Pairs(db);
        Assert.Equal(2, pairs.Count); // C has only two buyers in common: below the threshold of three.
        Assert.Equal(new CopurchaseRow(v[0].ProductId, v[1].ProductId, 3, 4, .75m),
            Assert.Single(pairs, p => p.ProductA == v[0].ProductId));
        Assert.Equal(new CopurchaseRow(v[1].ProductId, v[0].ProductId, 3, 3, 1m),
            Assert.Single(pairs, p => p.ProductA == v[1].ProductId));

        await Purchase(db, customers[4], past, OrderStatus.Completed, (v[0], 1), (v[1], 1));
        Assert.Equal(pairs, await Pairs(db));
        await db.Database.ExecuteSqlRawAsync("REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_product_copurchase");
        var updated = Assert.Single(await Pairs(db), p => p.ProductA == v[0].ProductId);
        Assert.Equal(4, updated.BothCount);
        Assert.Equal(5, updated.ACount);
        Assert.Equal(.8m, updated.Confidence);
    }

    [Fact]
    public async Task Affinity_uses_quantities_and_an_inclusive_twelve_month_utc_window()
    {
        await using var db = database.CreateContext();
        await using var transaction = await db.Database.BeginTransactionAsync();
        await db.Database.ExecuteSqlRawAsync("SET LOCAL TIME ZONE 'Pacific/Honolulu'");
        var now = await db.Database.SqlQueryRaw<DateTime>("SELECT CURRENT_TIMESTAMP AS \"Value\"").SingleAsync();
        var cutoff = now.AddMonths(-12);
        var catalog = await Catalog(db);
        var customers = await Customers(db, 2);
        var v = catalog.Variants;
        await Purchase(db, customers[0], cutoff, OrderStatus.Completed, (v[0], 1), (v[3], 2));
        await Purchase(db, customers[0], now, OrderStatus.Completed, (v[2], 1));
        await Purchase(db, customers[0], cutoff.AddTicks(-10), OrderStatus.Completed, (v[2], 100));
        await Purchase(db, customers[0], now.AddTicks(10), OrderStatus.Completed, (v[2], 100));
        await Purchase(db, customers[0], now, OrderStatus.Cancelled, (v[2], 100));
        await Purchase(db, customers[0], now, OrderStatus.Returned, (v[2], 100));
        catalog.Products[0].IsDeleted = true;
        v[0].IsDeleted = true;
        await db.SaveChangesAsync();

        var rows = await Affinities(db);
        Assert.Equal(2, rows.Count);
        Assert.All(rows, row => Assert.Equal(customers[0].AccountId, row.CustomerId));
        Assert.Equal(.75m, Assert.Single(rows, r => r.CategoryId == catalog.Categories[0].Id).Share);
        Assert.Equal(.25m, Assert.Single(rows, r => r.CategoryId == catalog.Categories[1].Id).Share);
        Assert.Equal(1m, rows.Sum(r => r.Share));
    }

    [Fact]
    public async Task Ratings_keep_history_and_low_rated_categories_weight_each_feedback_including_the_two_star_boundary()
    {
        await using var db = database.CreateContext();
        await using var transaction = await db.Database.BeginTransactionAsync();
        var catalog = await Catalog(db);
        var customers = await Customers(db, 2);
        var p = catalog.Products;
        Review(db, customers[0], p[0], 5);
        for (var i = 0; i < 4; i++) Review(db, customers[0], p[1], 1);
        Review(db, customers[0], p[2], 2);
        Review(db, customers[0], p[2], 3);
        Review(db, customers[1], p[0], 3);
        Review(db, customers[1], p[1], 1);
        await db.SaveChangesAsync();

        var low = await LowRated(db);
        var first = Assert.Single(low, r => r.CustomerId == customers[0].AccountId);
        Assert.Equal(catalog.Categories[0].Id, first.CategoryId);
        Assert.Equal(1.8m, first.AvgRating); // Average of reviews; average of product averages would incorrectly be 3.
        Assert.Equal(5, first.FeedbackCount);
        Assert.Equal(2m, Assert.Single(low, r => r.CustomerId == customers[1].AccountId).AvgRating);
        var before = await Ratings(db);
        Assert.Equal(new RatingRow(p[0].Id, 4m, 2), Assert.Single(before, r => r.ProductId == p[0].Id));
        Assert.Equal(new RatingRow(p[1].Id, 1m, 5), Assert.Single(before, r => r.ProductId == p[1].Id));
        Assert.Equal(new RatingRow(p[2].Id, 2.5m, 2), Assert.Single(before, r => r.ProductId == p[2].Id));

        p[0].IsDeleted = true;
        customers[1].Account.IsDeleted = true;
        await db.SaveChangesAsync();
        Assert.Equal(before, await Ratings(db));
        Assert.Single(await LowRated(db));
        Assert.Equal(9, await db.Set<Feedback>().CountAsync());
    }

    [Theory]
    [InlineData("withdraw-consent")]
    [InlineData("locked")]
    [InlineData("deleted")]
    [InlineData("Staff")]
    [InlineData("Manager")]
    public async Task Per_customer_signals_stop_immediately_when_the_customer_is_no_longer_eligible(string change)
    {
        await using var db = database.CreateContext();
        await using var transaction = await db.Database.BeginTransactionAsync();
        var catalog = await Catalog(db);
        var customer = (await Customers(db, 1))[0];
        await Purchase(db, customer, DateTime.UtcNow.AddDays(-1), OrderStatus.Completed, (catalog.Variants[0], 1));
        Review(db, customer, catalog.Products[0], 1);
        await db.SaveChangesAsync();
        Assert.Single(await Affinities(db));
        Assert.Single(await LowRated(db));

        switch (change)
        {
            case "withdraw-consent": customer.ConsentPersonalData = false; break;
            case "locked": customer.Account.IsActive = false; break;
            case "deleted": customer.Account.IsDeleted = true; break;
            default: customer.Account.Role = Enum.Parse<AccountRole>(change); break;
        }
        await db.SaveChangesAsync();
        Assert.Empty(await Affinities(db));
        Assert.Empty(await LowRated(db));
        Assert.Single(await Ratings(db));
        Assert.Equal(1, await db.Set<Order>().CountAsync());
        Assert.Equal(1, await db.Set<Feedback>().CountAsync());
    }

    [Fact]
    public async Task Seed_v2_signals_reconcile_with_persisted_rows()
    {
        await using var db = database.CreateContext();
        await using var transaction = await db.Database.BeginTransactionAsync();
        var now = await db.Database.SqlQueryRaw<DateTime>("SELECT CURRENT_TIMESTAMP AS \"Value\"").SingleAsync();
        await new DemoDataSeeder(db, _ => "test-hash", now).RunAsync(includeFeedback: true);
        await Refresh(db);
        var pairs = await Pairs(db);
        Assert.NotEmpty(pairs);
        Assert.All(pairs, pair =>
        {
            Assert.NotEqual(pair.ProductA, pair.ProductB);
            Assert.InRange(pair.BothCount, 3, pair.ACount);
            Assert.Equal(Math.Round((decimal)pair.BothCount / pair.ACount, 12), Math.Round(pair.Confidence, 12));
            Assert.Equal(pair.BothCount, Assert.Single(pairs, r => r.ProductA == pair.ProductB && r.ProductB == pair.ProductA).BothCount);
        });
        var affinities = await Affinities(db);
        Assert.NotEmpty(affinities);
        Assert.All(affinities.GroupBy(r => r.CustomerId), group => Assert.Equal(1m, Math.Round(group.Sum(r => r.Share), 12)));
        var eligible = await db.Set<CustomerProfile>().Where(c => c.ConsentPersonalData && c.Account.IsActive && c.Account.Role == AccountRole.Customer)
            .Where(c => db.Set<Order>().Any(o => o.CustomerId == c.AccountId && o.Status == OrderStatus.Completed
                && o.OrderedAt >= now.AddMonths(-12) && o.OrderedAt <= now)).Select(c => c.AccountId).OrderBy(id => id).ToListAsync();
        Assert.Equal(eligible, affinities.Select(r => r.CustomerId).Distinct().OrderBy(id => id).ToList());
        var ratings = await Ratings(db);
        var feedback = await db.Set<Feedback>().ToListAsync();
        Assert.Equal(60, ratings.Sum(r => r.FeedbackCount));
        Assert.All(ratings, row =>
        {
            var actual = feedback.Where(f => f.ProductId == row.ProductId).ToList();
            Assert.Equal(actual.Count, row.FeedbackCount);
            Assert.Equal(Math.Round(actual.Average(f => (decimal)f.Rating), 12), Math.Round(row.AvgRating, 12));
        });
    }

    [Fact]
    public async Task Migration_rollback_and_reapply_preserve_source_rows_and_populate_the_materialized_view()
    {
        var isolated = new DemoSeedDatabaseFixture();
        await isolated.InitializeAsync();
        try
        {
            await using var db = isolated.CreateContext();
            var catalog = await Catalog(db);
            foreach (var customer in await Customers(db, 3))
                await Purchase(db, customer, DateTime.UtcNow.AddDays(-1), OrderStatus.Completed,
                    (catalog.Variants[0], 1), (catalog.Variants[1], 1));
            var migrator = db.GetService<IMigrator>();
            await migrator.MigrateAsync("20261019161224_AddOrdersAndRecommendations");
            Assert.True(await db.Database.SqlQueryRaw<bool>("SELECT to_regclass('public.mv_product_copurchase') IS NULL AS \"Value\"").SingleAsync());
            Assert.True(await db.Database.SqlQueryRaw<bool>("SELECT to_regclass('public.v_customer_category_affinity') IS NULL AS \"Value\"").SingleAsync());
            Assert.True(await db.Database.SqlQueryRaw<bool>("SELECT to_regclass('public.v_product_rating') IS NULL AS \"Value\"").SingleAsync());
            Assert.True(await db.Database.SqlQueryRaw<bool>("SELECT to_regclass('public.v_customer_low_rated_category') IS NULL AS \"Value\"").SingleAsync());
            Assert.Equal(3, await db.Set<Order>().CountAsync());
            Assert.Equal(6, await db.Set<OrderItem>().CountAsync());
            await migrator.MigrateAsync();
            await migrator.MigrateAsync(); // Already applied: EF history must keep this safe to repeat.
            Assert.Equal(2, (await Pairs(db)).Count);
            Assert.Equal(3, await db.Set<Order>().CountAsync());
            Assert.Equal(6, await db.Set<OrderItem>().CountAsync());
        }
        finally { await isolated.DisposeAsync(); }
    }

    private static Task<List<CopurchaseRow>> Pairs(AppDbContext db) => db.Database
        .SqlQueryRaw<CopurchaseRow>("SELECT * FROM public.mv_product_copurchase ORDER BY \"ProductA\", \"ProductB\"").ToListAsync();
    private static Task<List<AffinityRow>> Affinities(AppDbContext db) => db.Database
        .SqlQueryRaw<AffinityRow>("SELECT * FROM public.v_customer_category_affinity").ToListAsync();
    private static Task<List<RatingRow>> Ratings(AppDbContext db) => db.Database
        .SqlQueryRaw<RatingRow>("SELECT * FROM public.v_product_rating ORDER BY \"ProductId\"").ToListAsync();
    private static Task<List<LowRatedRow>> LowRated(AppDbContext db) => db.Database
        .SqlQueryRaw<LowRatedRow>("SELECT * FROM public.v_customer_low_rated_category").ToListAsync();
    private static Task<int> Refresh(AppDbContext db) => db.Database.ExecuteSqlRawAsync("REFRESH MATERIALIZED VIEW public.mv_product_copurchase");

    private static async Task<(Category[] Categories, Product[] Products, ProductVariant[] Variants)> Catalog(AppDbContext db)
    {
        Category[] categories = [new() { Name = "Chăm sóc da" }, new() { Name = "Chăm sóc tóc" }];
        db.AddRange(categories);
        await db.SaveChangesAsync();
        Product[] products = [new() { Name = "A", CategoryId = categories[0].Id },
            new() { Name = "B", CategoryId = categories[0].Id }, new() { Name = "C", CategoryId = categories[1].Id }];
        db.AddRange(products);
        await db.SaveChangesAsync();
        var variants = new[] { products[0], products[1], products[2], products[0] }.Select(p => new ProductVariant
            { ProductId = p.Id, Name = "100 ml", Sku = Guid.NewGuid().ToString("N"), Price = 100000 }).ToArray();
        db.AddRange(variants);
        await db.SaveChangesAsync();
        return (categories, products, variants);
    }

    private static async Task<CustomerProfile[]> Customers(AppDbContext db, int count)
    {
        var customers = Enumerable.Range(0, count).Select(_ => new CustomerProfile
        {
            Account = new Account { Email = $"{Guid.NewGuid():N}@cocoon.demo", PasswordHash = "test-hash" },
            FullName = "Khách kiểm thử", ConsentPersonalData = true
        }).ToArray();
        db.AddRange(customers);
        await db.SaveChangesAsync();
        return customers;
    }

    private static async Task Purchase(AppDbContext db, CustomerProfile customer, DateTime when, OrderStatus status,
        params (ProductVariant Variant, int Quantity)[] items)
    {
        var order = new Order { Code = Guid.NewGuid().ToString("N")[..20], CustomerId = customer.AccountId,
            OrderedAt = when, Status = status, TotalAmount = items.Sum(i => i.Quantity * i.Variant.Price) };
        db.Add(order);
        await db.SaveChangesAsync();
        db.AddRange(items.Select(i => new OrderItem { OrderId = order.Id, ProductVariantId = i.Variant.Id,
            Quantity = i.Quantity, UnitPrice = i.Variant.Price }));
        await db.SaveChangesAsync();
    }

    private static void Review(AppDbContext db, CustomerProfile customer, Product product, int rating) => db.Add(new Feedback
        { CustomerId = customer.AccountId, ProductId = product.Id, Rating = rating, Content = "Nội dung đánh giá kiểm thử SQL." });
}

public sealed record CopurchaseRow(int ProductA, int ProductB, long BothCount, long ACount, decimal Confidence);
public sealed record AffinityRow(int CustomerId, int CategoryId, decimal Share);
public sealed record RatingRow(int ProductId, decimal AvgRating, long FeedbackCount);
public sealed record LowRatedRow(int CustomerId, int CategoryId, decimal AvgRating, long FeedbackCount);
