using Cocoon.Domain.Entities;
using Cocoon.Domain.Enums;
using Cocoon.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Cocoon.Tests;

public sealed class SchemaIntegrationTests : IClassFixture<DatabaseFixture>
{
    private readonly DatabaseFixture _database;
    public SchemaIntegrationTests(DatabaseFixture database) => _database = database;

    [Theory]
    [InlineData(0)]
    [InlineData(6)]
    public Task Feedback_rating_outside_one_to_five_is_rejected(int rating) => InTransaction(async db =>
    {
        var (customer, _, product, _) = await AddParents(db);
        db.Add(new Feedback { CustomerId = customer, ProductId = product, Rating = rating, Content = "Phản hồi thử nghiệm" });
        await AssertConstraint(db, PostgresErrorCodes.CheckViolation);
    });

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public Task Variant_price_must_be_positive(decimal price) => InTransaction(async db =>
    {
        var (_, _, product, _) = await AddParents(db);
        db.Add(new ProductVariant { ProductId = product, Name = "100 ml", Sku = "TEST-SKU", Price = price });
        await AssertConstraint(db, PostgresErrorCodes.CheckViolation);
    });

    [Fact]
    public Task Duplicate_email_is_rejected_even_for_soft_deleted_account() => InTransaction(async db =>
    {
        db.Add(new Account { Email = "duplicate@cocoon.demo", PasswordHash = "test-only", IsDeleted = true });
        await db.SaveChangesAsync();
        db.Add(new Account { Email = "duplicate@cocoon.demo", PasswordHash = "test-only" });
        await AssertConstraint(db, PostgresErrorCodes.UniqueViolation);
    });

    [Fact]
    public Task Duplicate_sku_is_rejected() => InTransaction(async db =>
    {
        var (_, _, product, _) = await AddParents(db);
        db.AddRange(new ProductVariant { ProductId = product, Sku = "TEST-SKU", Name = "100 ml", Price = 1 },
            new ProductVariant { ProductId = product, Sku = "TEST-SKU", Name = "200 ml", Price = 2 });
        await AssertConstraint(db, PostgresErrorCodes.UniqueViolation);
    });

    [Fact]
    public Task Survey_close_before_open_is_rejected() => InTransaction(async db =>
    {
        var (_, staff, _, _) = await AddParents(db);
        db.Add(new Survey { Title = "Khảo sát thử", CreatedBy = staff, OpenAt = DateTime.UtcNow,
            CloseAt = DateTime.UtcNow.AddDays(-1) });
        await AssertConstraint(db, PostgresErrorCodes.CheckViolation);
    });

    [Fact]
    public Task Survey_recipient_cannot_be_added_twice() => InTransaction(async db =>
    {
        var (customer, _, _, survey) = await AddParents(db);
        db.AddRange(new SurveyRecipient { SurveyId = survey, CustomerId = customer },
            new SurveyRecipient { SurveyId = survey, CustomerId = customer });
        await AssertConstraint(db, PostgresErrorCodes.UniqueViolation);
    });

    [Fact]
    public Task Customer_cannot_submit_a_survey_twice() => InTransaction(async db =>
    {
        var (customer, _, _, survey) = await AddParents(db);
        db.AddRange(new SurveyResponse { SurveyId = survey, CustomerId = customer },
            new SurveyResponse { SurveyId = survey, CustomerId = customer });
        await AssertConstraint(db, PostgresErrorCodes.UniqueViolation);
    });

    [Fact]
    public Task Feedback_allows_only_one_official_reply() => InTransaction(async db =>
    {
        var (customer, staff, product, _) = await AddParents(db);
        var feedback = new Feedback { CustomerId = customer, ProductId = product, Rating = 4, Content = "Phản hồi thử nghiệm" };
        db.Add(feedback);
        await db.SaveChangesAsync();
        db.Add(new FeedbackReply { FeedbackId = feedback.Id, StaffId = staff, Content = "Trả lời 1" });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear(); // Simulate a second request; exercise the database unique index.
        db.Add(new FeedbackReply { FeedbackId = feedback.Id, StaffId = staff, Content = "Trả lời 2" });
        await AssertConstraint(db, PostgresErrorCodes.UniqueViolation);
    });

    [Fact]
    public Task Soft_delete_hides_customer_but_preserves_feedback_and_history() => InTransaction(async db =>
    {
        var (customer, _, product, _) = await AddParents(db);
        var feedback = new Feedback { CustomerId = customer, ProductId = product, Rating = 4, Content = "Phản hồi thử nghiệm" };
        db.Add(feedback);
        await db.SaveChangesAsync();
        var account = await db.Set<Account>().SingleAsync(x => x.Id == customer);
        account.IsDeleted = true;
        await db.SaveChangesAsync();
        Assert.False(await db.Set<Account>().AnyAsync(x => x.Id == customer));
        Assert.False(await db.Set<CustomerProfile>().AnyAsync(x => x.AccountId == customer));
        Assert.True(await db.Set<Feedback>().AnyAsync(x => x.Id == feedback.Id));
        Assert.True(await db.Set<CustomerProfile>().IgnoreQueryFilters().AnyAsync(x => x.AccountId == customer));
    });

    [Fact]
    public Task Physical_delete_of_referenced_customer_is_blocked() => InTransaction(async db =>
    {
        var (customer, _, product, _) = await AddParents(db);
        db.Add(new Feedback { CustomerId = customer, ProductId = product, Rating = 4, Content = "Phản hồi thử nghiệm" });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear(); // No tracked dependents: verify the actual PostgreSQL foreign key.
        db.Remove(await db.Set<CustomerProfile>().SingleAsync(x => x.AccountId == customer));
        await AssertConstraint(db, PostgresErrorCodes.RestrictViolation);
        Assert.True(await db.Set<CustomerProfile>().AnyAsync(x => x.AccountId == customer));
        Assert.True(await db.Set<Feedback>().AnyAsync(x => x.CustomerId == customer));
    });

    [Fact]
    public Task Missing_product_foreign_key_is_rejected() => InTransaction(async db =>
    {
        var (customer, _, _, _) = await AddParents(db);
        db.Add(new Feedback { CustomerId = customer, ProductId = int.MaxValue, Rating = 4, Content = "Phản hồi thử nghiệm" });
        await AssertConstraint(db, PostgresErrorCodes.ForeignKeyViolation);
    });

    [Fact]
    public Task Order_line_quantity_must_be_positive() => InTransaction(async db =>
    {
        var (orderId, variantId) = await AddOrder(db);
        db.Add(new OrderItem { OrderId = orderId, ProductVariantId = variantId, Quantity = 0, UnitPrice = 100000 });
        await AssertConstraint(db, PostgresErrorCodes.CheckViolation);
    });

    [Fact]
    public Task Order_line_can_be_reviewed_only_once() => InTransaction(async db =>
    {
        var (customer, _, product, _) = await AddParents(db);
        var (orderId, variantId) = await AddOrder(db, customer, product);
        var line = new OrderItem { OrderId = orderId, ProductVariantId = variantId, Quantity = 1, UnitPrice = 100000 };
        db.Add(line);
        await db.SaveChangesAsync();
        db.AddRange(new Feedback { CustomerId = customer, ProductId = product, OrderItemId = line.Id, Rating = 5, Content = "Lần 1" },
            new Feedback { CustomerId = customer, ProductId = product, OrderItemId = line.Id, Rating = 4, Content = "Lần 2" });
        await AssertConstraint(db, PostgresErrorCodes.UniqueViolation);
    });

    [Fact]
    public Task Only_one_active_recommendation_per_customer_and_product() => InTransaction(async db =>
    {
        var (customer, _, product, _) = await AddParents(db);
        db.Add(new Recommendation { CustomerId = customer, ProductId = product, Score = 0.5m, Status = RecommendationStatus.Expired });
        db.Add(new Recommendation { CustomerId = customer, ProductId = product, Score = 0.6m });
        await db.SaveChangesAsync(); // An expired row may coexist with the active one.
        db.Add(new Recommendation { CustomerId = customer, ProductId = product, Score = 0.7m });
        await AssertConstraint(db, PostgresErrorCodes.UniqueViolation);
    });

    private static async Task<(int Order, int Variant)> AddOrder(AppDbContext db, int? customer = null, int? product = null)
    {
        if (customer is null || product is null)
            (customer, _, product, _) = await AddParents(db);
        var variant = new ProductVariant { ProductId = product.Value, Name = "140 ml", Sku = $"SKU-{Guid.NewGuid():N}", Price = 100000 };
        var order = new Order { Code = $"CO-{Random.Shared.Next(100000, 999999)}", CustomerId = customer.Value, TotalAmount = 100000 };
        db.AddRange(variant, order);
        await db.SaveChangesAsync();
        return (order.Id, variant.Id);
    }

    private async Task InTransaction(Func<AppDbContext, Task> test)
    {
        await using var db = _database.CreateContext();
        await using var transaction = await db.Database.BeginTransactionAsync();
        await test(db); // Disposal rolls back all test rows; never modifies demo data.
    }

    private static async Task AssertConstraint(AppDbContext db, string sqlState)
    {
        var error = await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
        Assert.Equal(sqlState, Assert.IsType<PostgresException>(error.InnerException).SqlState);
    }

    private static async Task<(int Customer, int Staff, int Product, int Survey)> AddParents(AppDbContext db)
    {
        var customer = new Account { Email = $"customer-{Guid.NewGuid():N}@cocoon.demo", PasswordHash = "test-only", Role = AccountRole.Customer };
        var staff = new Account { Email = $"staff-{Guid.NewGuid():N}@cocoon.demo", PasswordHash = "test-only", Role = AccountRole.Manager };
        db.AddRange(customer, staff);
        await db.SaveChangesAsync();
        db.Add(new CustomerProfile { AccountId = customer.Id, FullName = "Khách hàng thử nghiệm", FullNameNormalized = "khach hang thu nghiem" });
        db.Add(new StaffProfile { AccountId = staff.Id, FullName = "Quản lý thử nghiệm" });
        var category = new Category { Name = "Danh mục thử" };
        db.Add(category);
        await db.SaveChangesAsync();
        var product = new Product { Name = "Sản phẩm thử", NameNormalized = "san pham thu", CategoryId = category.Id };
        var survey = new Survey { Title = "Khảo sát thử", CreatedBy = staff.Id };
        db.AddRange(product, survey);
        await db.SaveChangesAsync();
        return (customer.Id, staff.Id, product.Id, survey.Id);
    }
}

public sealed class DatabaseFixture : IAsyncLifetime
{
    private string _connectionString = string.Empty;

    public async Task InitializeAsync()
    {
        var source = Environment.GetEnvironmentVariable("ConnectionStrings__Default")
            ?? throw new InvalidOperationException("Chạy database test bên trong container API local.");
        var connection = new NpgsqlConnectionStringBuilder(source);
        if (connection.Host != "db" || connection.Database != "cocoon")
            throw new InvalidOperationException("Database test chỉ được chạy với host db và database local cocoon.");
        await using var admin = new NpgsqlConnection(connection.ConnectionString);
        await admin.OpenAsync();
        await using var exists = new NpgsqlCommand("SELECT 1 FROM pg_database WHERE datname = 'cocoon_tests'", admin);
        if (await exists.ExecuteScalarAsync() is null)
        {
            await using var create = new NpgsqlCommand("CREATE DATABASE cocoon_tests", admin);
            await create.ExecuteNonQueryAsync();
        }
        connection.Database = "cocoon_tests";
        _connectionString = connection.ConnectionString;
        await using var db = CreateContext();
        await db.Database.MigrateAsync();
    }

    public AppDbContext CreateContext() => new(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(_connectionString).Options);
    public Task DisposeAsync() => Task.CompletedTask;
}
