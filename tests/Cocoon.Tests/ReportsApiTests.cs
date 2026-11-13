using System.Net;
using System.Text.Json;
using Cocoon.Domain.Entities;
using Cocoon.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Cocoon.Tests;

public sealed partial class ReportsApiTests : AccountApiTestBase
{
    private static readonly string[] Routes = ["overview", "customers/age", "customers/gender", "customers/preferences", "feedback/ratings", "purchases/categories", "recommendations"];

    [Theory]
    [InlineData("Admin")]
    [InlineData("Staff")]
    [InlineData("Customer")]
    public async Task Reports_require_manager_and_authentication(string role)
    {
        var actor = await Actor(Enum.Parse<AccountRole>(role));
        foreach (var route in Routes)
        {
            Assert.Equal(HttpStatusCode.Unauthorized, (await Send(HttpMethod.Get, $"/api/v1/reports/{route}")).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await Send(HttpMethod.Get, $"/api/v1/reports/{route}", role, actor)).StatusCode);
        }
    }

    [Fact]
    public async Task Empty_reports_have_zero_counts_null_averages_and_complete_buckets()
    {
        var manager = await Actor(AccountRole.Manager);
        var overview = await Get("overview", manager);
        Assert.Equal(0, overview.GetProperty("totalCustomers").GetInt32());
        Assert.Equal(0, overview.GetProperty("ratingCount").GetInt32());
        Assert.Equal(JsonValueKind.Null, overview.GetProperty("avgRating").ValueKind);
        var ages = await Get("customers/age", manager);
        Assert.Equal(6, ages.GetProperty("items").GetArrayLength());
        Assert.All(ages.GetProperty("items").EnumerateArray(), row => Assert.Equal(0, row.GetProperty("percentage").GetDecimal()));
        var preferences = await Get("customers/preferences", manager);
        Assert.Equal(0, preferences.GetProperty("consentingCustomers").GetInt32());
        var ratings = await Get("feedback/ratings", manager);
        Assert.Equal(5, ratings.GetProperty("distribution").GetArrayLength());
        Assert.Equal(JsonValueKind.Null, ratings.GetProperty("avgRating").ValueKind);
        Assert.Empty((await Get("purchases/categories", manager)).GetProperty("items").EnumerateArray());
        await AssertReportSqlMatchesApi(manager);
    }

    [Fact]
    public async Task Demographics_use_actual_birthdays_and_only_active_customer_accounts()
    {
        var manager = await Actor(AccountRole.Manager);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        foreach (var (birth, gender) in new (DateOnly?, string?)[] {
            (today.AddYears(-18).AddDays(1), "Nam"), (today.AddYears(-18), "Nữ"),
            (today.AddYears(-25), "Khác"), (today.AddYears(-35), null), (today.AddYears(-45), ""), (null, "Nữ") })
            await Customer(birth, gender);
        await Customer(today.AddYears(-20), "Nam", active: false);
        await Customer(today.AddYears(-20), "Nam", deleted: true);
        var formerCustomer = await Customer(today.AddYears(-20), "Nam");
        await using (var db = Database.CreateContext())
        {
            (await db.Set<Account>().SingleAsync(a => a.Id == formerCustomer)).Role = AccountRole.Staff;
            await db.SaveChangesAsync();
        }
        var ages = await Get("customers/age", manager);
        Assert.Equal(6, ages.GetProperty("totalCustomers").GetInt32());
        Assert.All(ages.GetProperty("items").EnumerateArray(), row => Assert.Equal(1, row.GetProperty("customers").GetInt32()));
        var genders = await Get("customers/gender", manager);
        Assert.Equal(6, genders.GetProperty("items").EnumerateArray().Sum(row => row.GetProperty("customers").GetInt32()));
        Assert.Equal(2, genders.GetProperty("items").EnumerateArray().Single(row => row.GetProperty("gender").GetString() == "Chưa cung cấp").GetProperty("customers").GetInt32());
        await AssertReportSqlMatchesApi(manager);
    }

    [Fact]
    public async Task Preferences_use_consent_denominator_and_allow_multiple_selections()
    {
        var manager = await Actor(AccountRole.Manager);
        var yes = await Customer(null, null, consent: true);
        var no = await Customer(null, null);
        var locked = await Customer(null, null, active: false, consent: true);
        var deleted = await Customer(null, null, deleted: true, consent: true);
        await using (var db = Database.CreateContext())
        {
            var first = new Preference { Name = "Da dầu" };
            var second = new Preference { Name = "Da khô" };
            db.AddRange(first, second); await db.SaveChangesAsync();
            foreach (var id in new[] { yes, no, locked, deleted })
                db.Add(new CustomerPreference { CustomerId = id, PreferenceId = first.Id });
            db.Add(new CustomerPreference { CustomerId = yes, PreferenceId = second.Id, Source = PreferenceSource.Survey });
            await db.SaveChangesAsync();
        }
        var report = await Get("customers/preferences", manager);
        Assert.Equal(1, report.GetProperty("consentingCustomers").GetInt32());
        Assert.True(report.GetProperty("multiSelect").GetBoolean());
        Assert.Equal(2, report.GetProperty("items").GetArrayLength());
        Assert.All(report.GetProperty("items").EnumerateArray(), row => {
            Assert.Equal(1, row.GetProperty("customers").GetInt32());
            Assert.Equal(100, row.GetProperty("percentage").GetDecimal());
        });
        await AssertReportSqlMatchesApi(manager);
    }

    [Fact]
    public async Task Overview_counts_available_surveys_and_customer_cohorts_without_counting_internal_roles()
    {
        var manager = await Actor(AccountRole.Manager);
        await Actor(AccountRole.Admin);
        await Actor(AccountRole.Staff);
        await Customer(null, null);
        var old = await Customer(null, null);
        await Customer(null, null, active: false);
        var now = DateTime.UtcNow;
        await using (var db = Database.CreateContext())
        {
            (await db.Set<Account>().SingleAsync(a => a.Id == old)).CreatedAt = now.AddDays(-40);
            db.AddRange(
                new Survey { Title = "Đang nhận", CreatedBy = manager, Status = SurveyStatus.Open, OpenAt = now.AddDays(-1), CloseAt = now.AddDays(1) },
                new Survey { Title = "Không giới hạn", CreatedBy = manager, Status = SurveyStatus.Open },
                new Survey { Title = "Chưa đến hạn", CreatedBy = manager, Status = SurveyStatus.Open, OpenAt = now.AddDays(1) },
                new Survey { Title = "Hết hạn", CreatedBy = manager, Status = SurveyStatus.Open, CloseAt = now.AddSeconds(-1) },
                new Survey { Title = "Đã đóng", CreatedBy = manager, Status = SurveyStatus.Closed },
                new Survey { Title = "Đã xóa", CreatedBy = manager, Status = SurveyStatus.Open, IsDeleted = true });
            await db.SaveChangesAsync();
        }
        var report = await Get("overview", manager);
        Assert.Equal(2, report.GetProperty("totalCustomers").GetInt32());
        Assert.Equal(1, report.GetProperty("newCustomers30d").GetInt32());
        Assert.Equal(2, report.GetProperty("openSurveys").GetInt32());
        await AssertReportSqlMatchesApi(manager);
    }

    [Fact]
    public async Task History_reports_keep_soft_deleted_data_and_use_half_open_utc_periods()
    {
        var manager = await Actor(AccountRole.Manager);
        var customer = await Customer(new DateOnly(2000, 1, 1), "Nữ");
        var start = new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc);
        await using (var db = Database.CreateContext())
        {
            var category = new Category { Name = "Chăm sóc da" };
            db.Add(category); await db.SaveChangesAsync();
            var product = new Product { Name = "Bí đao", CategoryId = category.Id, IsDeleted = true };
            db.Add(product); await db.SaveChangesAsync();
            var variant = new ProductVariant { ProductId = product.Id, Sku = "REPORT-V1", Price = 999, IsDeleted = true };
            db.Add(variant); await db.SaveChangesAsync();
            foreach (var (date, rating) in new[] { (start.AddTicks(-10), 1), (start, 4), (start.AddDays(1), 5), (start.AddMonths(1), 1) })
                db.Add(new Feedback { CustomerId = customer, ProductId = product.Id, Rating = rating, Content = "Phản hồi báo cáo", CreatedAt = date });
            foreach (var (date, state, qty) in new[] { (start.AddTicks(-10), OrderStatus.Completed, 99), (start, OrderStatus.Completed, 2),
                (start.AddDays(1), OrderStatus.Completed, 3), (start.AddDays(1), OrderStatus.Cancelled, 99),
                (start.AddDays(1), OrderStatus.Returned, 99), (start.AddMonths(1), OrderStatus.Completed, 99) })
            {
                var order = new Order { CustomerId = customer, Code = Guid.NewGuid().ToString("N")[..20], OrderedAt = date, Status = state, TotalAmount = qty * 100 };
                db.Add(order); await db.SaveChangesAsync();
                db.Add(new OrderItem { OrderId = order.Id, ProductVariantId = variant.Id, Quantity = qty, UnitPrice = 100 });
            }
            (await db.Set<Account>().SingleAsync(a => a.Id == customer)).IsDeleted = true;
            var survey = new Survey { Title = "Đã xóa", CreatedBy = manager, IsDeleted = true };
            db.Add(survey); await db.SaveChangesAsync();
            db.Add(new SurveyResponse { SurveyId = survey.Id, CustomerId = customer, SubmittedAt = start });
            await db.SaveChangesAsync();
        }
        const string period = "?from=2026-10-01T00:00:00Z&to=2026-11-01T00:00:00Z";
        var ratings = await Get("feedback/ratings" + period, manager);
        Assert.Equal(2, ratings.GetProperty("feedbackCount").GetInt32());
        Assert.Equal(4.5m, ratings.GetProperty("avgRating").GetDecimal());
        Assert.Single(ratings.GetProperty("byProduct").EnumerateArray());
        Assert.Single(ratings.GetProperty("byMonth").EnumerateArray());
        Assert.Equal(.5m, ratings.GetProperty("byMonth")[0].GetProperty("lowRatingRate").GetDecimal()); // 4 stars counts as low, 5 does not
        Assert.Equal(2, ratings.GetProperty("distribution").EnumerateArray().Sum(x => x.GetProperty("feedbackCount").GetInt32()));
        var purchase = Assert.Single((await Get("purchases/categories" + period, manager)).GetProperty("items").EnumerateArray());
        Assert.Equal(500, purchase.GetProperty("revenue").GetDecimal());
        Assert.Equal(5, purchase.GetProperty("quantity").GetInt64());
        Assert.Equal(2, purchase.GetProperty("orderCount").GetInt32());
        var overview = await Get("overview" + period, manager);
        Assert.Equal(0, overview.GetProperty("totalCustomers").GetInt32());
        Assert.Equal(2, overview.GetProperty("ratingCount").GetInt32());
        Assert.Equal(1, overview.GetProperty("completedResponses").GetInt32());
        var sameUtcPeriod = await Get("feedback/ratings?from=2026-10-01T07:00:00%2B07:00&to=2026-11-01T07:00:00%2B07:00", manager);
        Assert.Equal(2, sameUtcPeriod.GetProperty("feedbackCount").GetInt32());
        Assert.Equal(4.5m, sameUtcPeriod.GetProperty("avgRating").GetDecimal());
        await AssertReportSqlMatchesApi(manager, start, start.AddMonths(1));
    }

    [Theory]
    [InlineData("from=2026-11-02T00:00:00Z&to=2026-11-01T00:00:00Z")]
    [InlineData("from=2026-11-01T00:00:00Z&to=2026-11-01T00:00:00Z")]
    [InlineData("from=not-a-date")]
    public async Task Invalid_period_returns_field_validation_problem(string query)
    {
        var manager = await Actor(AccountRole.Manager);
        foreach (var route in new[] { "overview", "feedback/ratings", "purchases/categories", "recommendations" })
            await Problem(await Send(HttpMethod.Get, $"/api/v1/reports/{route}?{query}", "Manager", manager), HttpStatusCode.BadRequest, "VALIDATION_ERROR");
    }

    private async Task<JsonElement> Get(string route, int manager) => await Json(await Send(HttpMethod.Get, $"/api/v1/reports/{route}", "Manager", manager));

    private async Task<int> Customer(DateOnly? birth, string? gender, bool active = true, bool deleted = false, bool consent = false)
    {
        var id = await Actor(AccountRole.Customer);
        await using var db = Database.CreateContext();
        var profile = await db.Set<CustomerProfile>().SingleAsync(c => c.AccountId == id);
        profile.DateOfBirth = birth; profile.Gender = gender; profile.ConsentPersonalData = consent;
        var account = await db.Set<Account>().SingleAsync(a => a.Id == id);
        account.IsActive = active; account.IsDeleted = deleted;
        await db.SaveChangesAsync();
        return id;
    }
}
