using System.ComponentModel.DataAnnotations;

namespace Cocoon.Application.Reports;

/// <summary>Event timestamps use [from, to); omitted bounds mean all history through the current UTC instant.</summary>
public sealed record ReportPeriod(DateTimeOffset? From = null, DateTimeOffset? To = null) : IValidatableObject
{
    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (From is { } from && To is { } to && from >= to)
            yield return new ValidationResult("Thời điểm kết thúc phải sau thời điểm bắt đầu.", ["to"]);
    }
}

public interface IReportService
{
    Task<RecommendationReport> RecommendationsAsync(ReportPeriod period, CancellationToken ct);
    Task<ReportOverview> OverviewAsync(ReportPeriod period, CancellationToken ct);
    Task<CustomerAgeReport> CustomersByAgeAsync(CancellationToken ct);
    Task<CustomerGenderReport> CustomersByGenderAsync(CancellationToken ct);
    Task<CustomerPreferenceReport> CustomersByPreferenceAsync(CancellationToken ct);
    Task<FeedbackRatingReport> FeedbackRatingsAsync(ReportPeriod period, CancellationToken ct);
    Task<CategoryPurchaseReport> PurchasesByCategoryAsync(ReportPeriod period, CancellationToken ct);
}

/// <summary>Rates are 0–1 fractions of the generated cohort, based on latest stored statuses, not an event log.</summary>
public sealed record RecommendationReport(int EligibleCustomers, int CoveredCustomers, decimal Coverage,
    int RecommendationCount, int ClickedCount, int DismissedCount, decimal ClickRate, decimal DismissRate,
    int ActivePlans, DateTime? LastBuiltAt, IReadOnlyList<RecommendationProductRow> TopProducts, IReadOnlyList<RecommendationPlanRow> ByPlan);
public sealed record RecommendationProductRow(int Id, string Name, int RecommendationCount, int Clicks, int Dismissals, decimal ClickRate, decimal DismissRate);
public sealed record RecommendationPlanRow(int? PlanId, string? PlanName, int CustomerCount, int RecommendationCount, int Clicks, int Dismissals, decimal ClickRate, decimal DismissRate);

public sealed record ReportOverview(int TotalCustomers, int NewCustomers30d, int NewFeedback, decimal? AvgRating,
    int OpenSurveys, int NewCustomersThisMonth, int RatingCount, int CompletedResponses);

public sealed record CustomerAgeRow(string Group, int Customers, decimal Percentage);
public sealed record CustomerAgeReport(IReadOnlyList<CustomerAgeRow> Items, int TotalCustomers, DateOnly AsOf);
public sealed record CustomerGenderRow(string Gender, int Customers, decimal Percentage);
public sealed record CustomerGenderReport(IReadOnlyList<CustomerGenderRow> Items, int TotalCustomers, DateOnly AsOf);
public sealed record CustomerPreferenceRow(int PreferenceId, string Preference, int Customers, decimal Percentage);
public sealed record CustomerPreferenceReport(IReadOnlyList<CustomerPreferenceRow> Items, int ConsentingCustomers, bool MultiSelect = true);

public sealed record RatingDistributionRow(int Rating, int FeedbackCount, decimal Percentage);
public sealed record MonthlyRatingRow(string Month, int FeedbackCount, decimal AvgRating, decimal LowRatingRate);
public sealed record ProductRatingRow(int ProductId, string Product, int FeedbackCount, decimal AvgRating);
public sealed record CategoryRatingRow(int CategoryId, string Category, int FeedbackCount, decimal AvgRating);
public sealed record FeedbackRatingReport(int FeedbackCount, decimal? AvgRating,
    IReadOnlyList<RatingDistributionRow> Distribution, IReadOnlyList<MonthlyRatingRow> ByMonth,
    IReadOnlyList<ProductRatingRow> ByProduct, IReadOnlyList<CategoryRatingRow> ByCategory);

public sealed record CategoryPurchaseRow(int CategoryId, string Category, string AgeGroup, decimal Revenue, long Quantity, int OrderCount);
public sealed record CategoryPurchaseReport(IReadOnlyList<CategoryPurchaseRow> Items, DateOnly AsOf);
