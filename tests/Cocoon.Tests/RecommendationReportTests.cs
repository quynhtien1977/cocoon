using System.Text.Json;
using Cocoon.Domain.Entities;
using Cocoon.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Cocoon.Tests;

public sealed partial class ReportsApiTests
{
    [Fact]
    public async Task Empty_recommendation_report_has_zero_denominators_and_no_build_date()
    {
        var manager = await Actor(AccountRole.Manager);
        var report = await Get("recommendations", manager);
        foreach (var field in new[] { "eligibleCustomers", "coveredCustomers", "recommendationCount", "clickedCount", "dismissedCount", "activePlans", "coverage", "clickRate", "dismissRate" })
            Assert.Equal(0, report.GetProperty(field).GetDecimal());
        Assert.Equal(JsonValueKind.Null, report.GetProperty("lastBuiltAt").ValueKind);
        Assert.Empty(report.GetProperty("topProducts").EnumerateArray());
        Assert.Empty(report.GetProperty("byPlan").EnumerateArray());
        await AssertReportSqlMatchesApi(manager);
    }

    [Fact]
    public async Task Recommendation_report_uses_generated_cohort_current_eligibility_and_retained_history()
    {
        var manager = await Actor(AccountRole.Manager);
        var yes = await Customer(null, null, consent: true);
        await Customer(null, null, consent: true); // Eligible but has never received a recommendation.
        var no = await Customer(null, null);
        var locked = await Customer(null, null, active: false, consent: true);
        var deleted = await Customer(null, null, deleted: true, consent: true);
        var former = await Customer(null, null, consent: true);
        var start = new DateTime(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc);
        var end = start.AddDays(1);
        var now = DateTime.UtcNow;
        int firstId, secondId, activePlanId, endedPlanId, clickedId;
        await using (var db = Database.CreateContext())
        {
            (await db.Set<Account>().SingleAsync(a => a.Id == former)).Role = AccountRole.Staff;
            var category = new Category { Name = "Chăm sóc da" };
            db.Add(category); await db.SaveChangesAsync();
            var first = new Product { Name = "Sản phẩm A", CategoryId = category.Id };
            var second = new Product { Name = "Sản phẩm đã xóa", CategoryId = category.Id, IsDeleted = true };
            var active = new RecommendationPlan { Name = "Đang chạy", CreatedBy = manager, Status = RecommendationPlanStatus.Active, StartAt = now.AddDays(-1), EndAt = now.AddDays(1) };
            var ended = new RecommendationPlan { Name = "Đã kết thúc", CreatedBy = manager, Status = RecommendationPlanStatus.Ended, StartAt = now.AddDays(-10), EndAt = now.AddDays(-2) };
            db.AddRange(first, second, active, ended,
                new RecommendationPlan { Name = "Chưa đến hạn", CreatedBy = manager, Status = RecommendationPlanStatus.Active, StartAt = now.AddDays(1), EndAt = now.AddDays(2) },
                new RecommendationPlan { Name = "Quá hạn", CreatedBy = manager, Status = RecommendationPlanStatus.Active, StartAt = now.AddDays(-2), EndAt = now.AddDays(-1) });
            await db.SaveChangesAsync();
            (firstId, secondId, activePlanId, endedPlanId) = (first.Id, second.Id, active.Id, ended.Id);
            var clicked = new Recommendation { CustomerId = yes, ProductId = first.Id, PlanId = active.Id, Status = RecommendationStatus.Clicked, GeneratedAt = start, InteractedAt = end.AddDays(1) };
            db.AddRange(clicked,
                new Recommendation { CustomerId = yes, ProductId = second.Id, Status = RecommendationStatus.Expired, GeneratedAt = start.AddHours(1) },
                new Recommendation { CustomerId = no, ProductId = first.Id, PlanId = ended.Id, Status = RecommendationStatus.Dismissed, GeneratedAt = start.AddHours(2) },
                new Recommendation { CustomerId = locked, ProductId = second.Id, PlanId = active.Id, Status = RecommendationStatus.Clicked, GeneratedAt = start.AddHours(3) },
                new Recommendation { CustomerId = deleted, ProductId = first.Id, GeneratedAt = start.AddHours(4) },
                new Recommendation { CustomerId = former, ProductId = second.Id, GeneratedAt = start.AddHours(5) },
                new Recommendation { CustomerId = yes, ProductId = first.Id, Status = RecommendationStatus.Expired, GeneratedAt = start.AddTicks(-1) },
                new Recommendation { CustomerId = yes, ProductId = first.Id, Status = RecommendationStatus.Expired, GeneratedAt = end });
            await db.SaveChangesAsync(); clickedId = clicked.Id;
        }
        const string route = "recommendations?from=2026-11-01T00:00:00Z&to=2026-11-02T00:00:00Z";
        var report = await Get(route, manager);
        Assert.Equal(2, report.GetProperty("eligibleCustomers").GetInt32());
        Assert.Equal(1, report.GetProperty("coveredCustomers").GetInt32());
        Assert.Equal(.5m, report.GetProperty("coverage").GetDecimal());
        Assert.Equal(6, report.GetProperty("recommendationCount").GetInt32());
        Assert.Equal(2, report.GetProperty("clickedCount").GetInt32());
        Assert.Equal(1, report.GetProperty("dismissedCount").GetInt32());
        Assert.Equal(.333333m, report.GetProperty("clickRate").GetDecimal());
        Assert.Equal(.166667m, report.GetProperty("dismissRate").GetDecimal());
        Assert.Equal(1, report.GetProperty("activePlans").GetInt32());
        Assert.Equal(start.AddHours(5), report.GetProperty("lastBuiltAt").GetDateTime());
        var products = report.GetProperty("topProducts").EnumerateArray().ToArray();
        Assert.Equal(new[] { firstId, secondId }, products.Select(p => p.GetProperty("id").GetInt32()));
        Assert.All(products, p => Assert.Equal(3, p.GetProperty("recommendationCount").GetInt32()));
        Assert.Equal("Sản phẩm đã xóa", products[1].GetProperty("name").GetString());
        var plans = report.GetProperty("byPlan").EnumerateArray().ToArray();
        Assert.Equal(JsonValueKind.Null, plans[0].GetProperty("planId").ValueKind);
        Assert.Equal(3, plans[0].GetProperty("customerCount").GetInt32());
        Assert.Equal(activePlanId, plans[1].GetProperty("planId").GetInt32());
        Assert.Equal(2, plans[1].GetProperty("customerCount").GetInt32());
        Assert.Equal(endedPlanId, plans[2].GetProperty("planId").GetInt32());
        var offset = await Get("recommendations?from=2026-11-01T07:00:00%2B07:00&to=2026-11-02T07:00:00%2B07:00", manager);
        Assert.Equal(report.GetRawText(), offset.GetRawText());
        await AssertReportSqlMatchesApi(manager, start, end);

        // No event log exists: a later dismiss replaces the stored click, without changing the generated cohort.
        await using (var db = Database.CreateContext())
        {
            (await db.Set<Recommendation>().SingleAsync(r => r.Id == clickedId)).Status = RecommendationStatus.Dismissed;
            await db.SaveChangesAsync();
        }
        var changed = await Get(route, manager);
        Assert.Equal(6, changed.GetProperty("recommendationCount").GetInt32());
        Assert.Equal(1, changed.GetProperty("clickedCount").GetInt32());
        Assert.Equal(2, changed.GetProperty("dismissedCount").GetInt32());
        await AssertReportSqlMatchesApi(manager, start, end);
    }

    [Fact]
    public async Task Recommendation_report_has_stable_top_ten_and_safe_zero_eligible_coverage()
    {
        var manager = await Actor(AccountRole.Manager);
        var customer = await Customer(null, null); // No consent: history counts, coverage denominator is zero.
        int[] ids;
        await using (var db = Database.CreateContext())
        {
            var category = new Category { Name = "Danh mục" };
            db.Add(category); await db.SaveChangesAsync();
            var products = Enumerable.Range(0, 12).Select(i => new Product { Name = $"SP {i}", CategoryId = category.Id }).ToArray();
            db.AddRange(products); await db.SaveChangesAsync();
            ids = products.Select(p => p.Id).ToArray();
            db.AddRange(products.Select(p => new Recommendation { CustomerId = customer, ProductId = p.Id, Status = RecommendationStatus.Clicked, GeneratedAt = DateTime.UtcNow.AddMinutes(-1) }));
            await db.SaveChangesAsync();
        }
        var report = await Get("recommendations", manager);
        Assert.Equal(0, report.GetProperty("coverage").GetDecimal());
        Assert.Equal(12, report.GetProperty("recommendationCount").GetInt32());
        Assert.Equal(1, report.GetProperty("clickRate").GetDecimal());
        Assert.Equal(ids.Take(10), report.GetProperty("topProducts").EnumerateArray().Select(p => p.GetProperty("id").GetInt32()));
        await AssertReportSqlMatchesApi(manager);
    }
}
