namespace Cocoon.Application.Recommendations;

/// <summary>Shared by survey recipients, segment preview and recommendation plans (spec 6.3).</summary>
public sealed record SegmentFilter(int? AgeMin, int? AgeMax, string[]? Genders, int[]? PreferenceIds,
    int[]? PurchasedCategoryIds, int? LastPurchaseWithinDays, int[]? ExcludeLowRatedCategoryIds);

/// <summary>What a segment can test about one active customer.</summary>
public sealed record CustomerFacts(int Id, string FullName, string Email, int? Age, string? Gender, IReadOnlySet<int> PreferenceIds,
    IReadOnlySet<int> PurchasedCategoryIds, IReadOnlySet<int> LowRatedCategoryIds, int? DaysSinceLastOrder);

public static class SegmentMatcher
{
    /// <summary>Every set criterion must hold; empty lists and nulls mean "no limit" (spec 6.3).</summary>
    public static bool Matches(CustomerFacts c, SegmentFilter? f) =>
        f is null
        || (f.AgeMin is null || c.Age >= f.AgeMin) && (f.AgeMax is null || c.Age <= f.AgeMax)
        && (f.Genders is not { Length: > 0 } || c.Gender is not null && f.Genders.Contains(c.Gender))
        && (f.PreferenceIds is not { Length: > 0 } || f.PreferenceIds.Any(c.PreferenceIds.Contains))
        && (f.PurchasedCategoryIds is not { Length: > 0 } || f.PurchasedCategoryIds.Any(c.PurchasedCategoryIds.Contains))
        && (f.LastPurchaseWithinDays is null || c.DaysSinceLastOrder <= f.LastPurchaseWithinDays)
        && (f.ExcludeLowRatedCategoryIds is not { Length: > 0 } || !f.ExcludeLowRatedCategoryIds.Any(c.LowRatedCategoryIds.Contains));

    /// <summary>A filter the API accepts: ages 0–150 in order, non-negative day window.</summary>
    public static string? Validate(SegmentFilter? f) =>
        f is null ? null
        : f.AgeMin is < 0 or > 150 || f.AgeMax is < 0 or > 150 || f.AgeMin > f.AgeMax ? "Khoảng tuổi không hợp lệ."
        : f.LastPurchaseWithinDays is < 0 ? "Số ngày mua gần nhất không hợp lệ."
        : null;
}
