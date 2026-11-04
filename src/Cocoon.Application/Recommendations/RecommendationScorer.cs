using System.Globalization;
using Cocoon.Domain.Enums;

namespace Cocoon.Application.Recommendations;

/// <summary>Spec 7.2 weights, bound from appsettings `Recommendation:Weights` so the team can tune them for a demo.</summary>
public sealed class RecommendationWeights
{
    public decimal Preference { get; set; } = 0.30m;
    public decimal Survey { get; set; } = 0.15m;
    public decimal Category { get; set; } = 0.20m;
    public decimal CoPurchase { get; set; } = 0.15m;
    public decimal Rating { get; set; } = 0.10m;
    public decimal Plan { get; set; } = 0.10m;
}

public sealed record CandidateProduct(int Id, string Name, int CategoryId, string CategoryName, ProductStatus Status,
    IReadOnlyCollection<int> PreferenceIds, decimal? AvgRating, int FeedbackCount);

public sealed record CoPurchaseSignal(decimal Confidence, string FromProductName);
public sealed record PlanSignal(int PlanId, string PlanName);

/// <summary>Everything the scorer knows about one customer. Preference maps are id → display name.</summary>
public sealed record CustomerSignals(
    IReadOnlyDictionary<int, string> DeclaredPreferences,
    IReadOnlySet<int> SurveyPreferences,
    IReadOnlyDictionary<int, decimal> CategoryShare,
    IReadOnlyDictionary<int, CoPurchaseSignal> CoPurchase,
    IReadOnlyDictionary<int, PlanSignal> Plans,
    IReadOnlySet<int> RecentlyPurchased,
    IReadOnlySet<int> Dismissed,
    IReadOnlySet<int> LowRatedCategories,
    IReadOnlySet<int> LowRatedProducts);

public sealed record RecommendationReason(string Code, string Label);

/// <summary>Breakdown holds weighted contributions (weight × value), as stored in Recommendation.Breakdown.</summary>
public sealed record ScoredProduct(int ProductId, decimal Score, IReadOnlyDictionary<string, decimal> Breakdown,
    IReadOnlyList<RecommendationReason> Reasons, int? PlanId);

public static class RecommendationScorer
{
    public const decimal Threshold = 0.25m;
    public const int MaxPerCustomer = 6;
    private static readonly CultureInfo Vietnamese = CultureInfo.GetCultureInfo("vi-VN");

    /// <summary>Top products for one customer: candidates filtered by spec 7.2, score ≥ 0.25, at most 6, best first.</summary>
    public static IReadOnlyList<ScoredProduct> Score(CustomerSignals customer, IEnumerable<CandidateProduct> products, RecommendationWeights weights) =>
        products.Where(p => IsCandidate(customer, p))
            .Select(p => ScoreOne(customer, p, weights))
            .Where(s => s.Score >= Threshold)
            .OrderByDescending(s => s.Score).ThenBy(s => s.ProductId)
            .Take(MaxPerCustomer)
            .ToList();

    public static bool IsCandidate(CustomerSignals c, CandidateProduct p) =>
        p.Status == ProductStatus.Active && !c.RecentlyPurchased.Contains(p.Id) && !c.Dismissed.Contains(p.Id)
        && !c.LowRatedCategories.Contains(p.CategoryId) && !c.LowRatedProducts.Contains(p.Id);

    public static ScoredProduct ScoreOne(CustomerSignals c, CandidateProduct p, RecommendationWeights w)
    {
        var declared = p.PreferenceIds.Where(c.DeclaredPreferences.ContainsKey).ToList();
        var tagCount = p.PreferenceIds.Count;
        var coPurchase = c.CoPurchase.GetValueOrDefault(p.Id);
        var plan = c.Plans.GetValueOrDefault(p.Id);
        // Fewer than 3 reviews says little either way, so the rating counts as neutral.
        var rated = p.FeedbackCount >= 3 && p.AvgRating is not null;
        // Order matters: on equal contributions the earlier component wins the reason slot (spec 7.2).
        var parts = new (string Key, string Code, decimal Weight, decimal Value, string? Label)[]
        {
            ("preference", "PREFERENCE", w.Preference, tagCount == 0 ? 0 : (decimal)declared.Count / tagCount,
                declared.Count > 0 ? $"Hợp với sở thích {c.DeclaredPreferences[declared[0]]}" : null),
            ("survey", "SURVEY", w.Survey, tagCount == 0 ? 0 : (decimal)p.PreferenceIds.Count(c.SurveyPreferences.Contains) / tagCount,
                "Từ câu trả lời khảo sát của bạn"),
            ("category", "CATEGORY", w.Category, Math.Clamp(c.CategoryShare.GetValueOrDefault(p.CategoryId), 0, 1), $"Bạn hay chọn {p.CategoryName}"),
            ("coPurchase", "CO_PURCHASE", w.CoPurchase, Math.Clamp(coPurchase?.Confidence ?? 0, 0, 1),
                coPurchase is null ? null : $"Khách mua {coPurchase.FromProductName} cũng mua"),
            ("rating", "RATING", w.Rating, rated ? Math.Clamp((p.AvgRating!.Value - 1) / 4, 0, 1) : 0.5m,
                rated ? $"Được đánh giá {p.AvgRating!.Value.ToString("0.#", Vietnamese)}/5" : null),
            ("plan", "PLAN", w.Plan, plan is null ? 0 : 1, plan?.PlanName),
        };
        var breakdown = parts.ToDictionary(x => x.Key, x => Math.Round(x.Weight * x.Value, 4));
        var score = Math.Clamp(Math.Round(parts.Sum(x => x.Weight * x.Value), 4), 0, 1);
        var reasons = parts.Select((x, order) => (x, order, Contribution: x.Weight * x.Value))
            .Where(x => x.Contribution > 0 && x.x.Label is not null)
            .OrderByDescending(x => x.Contribution).ThenBy(x => x.order)
            .Take(2).Select(x => new RecommendationReason(x.x.Code, x.x.Label!)).ToList();
        return new ScoredProduct(p.Id, score, breakdown, reasons, plan?.PlanId);
    }
}
