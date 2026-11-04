using Cocoon.Application.Recommendations;
using Cocoon.Domain.Enums;

namespace Cocoon.Tests;

/// <summary>Spec 7.4: RecommendationScorer on hand-built data, no database.</summary>
public sealed class RecommendationScorerTests
{
    private static readonly RecommendationWeights Weights = new();
    private const int DaDau = 1, LamSach = 10;

    private static CandidateProduct Product(int id, int category = LamSach, ProductStatus status = ProductStatus.Active,
        int[]? tags = null, decimal? avg = 4.6m, int feedback = 10) =>
        new(id, $"SP {id}", category, "Làm sạch", status, tags ?? [DaDau], avg, feedback);

    private static CustomerSignals Customer(decimal categoryShare = 0, Dictionary<int, CoPurchaseSignal>? coPurchase = null,
        Dictionary<int, PlanSignal>? plans = null, int[]? recent = null, int[]? dismissed = null, int[]? lowCategories = null,
        int[]? lowProducts = null, int[]? surveyPreferences = null, Dictionary<int, string>? declared = null) =>
        new(declared ?? new() { [DaDau] = "Da dầu" }, (surveyPreferences ?? []).ToHashSet(),
            new Dictionary<int, decimal> { [LamSach] = categoryShare }, coPurchase ?? [], plans ?? [],
            (recent ?? []).ToHashSet(), (dismissed ?? []).ToHashSet(), (lowCategories ?? []).ToHashSet(), (lowProducts ?? []).ToHashSet());

    [Fact]
    public void Worked_example_from_spec_scores_0_67_with_preference_and_category_reasons()
    {
        var customer = Customer(0.6m, new() { [1] = new(0.4m, "Toner bí đao") }, new() { [1] = new(5, "Ra mắt gel bí đao") });
        var result = RecommendationScorer.ScoreOne(customer, Product(1), Weights);

        Assert.Equal(0.67m, result.Score);
        Assert.Equal(new Dictionary<string, decimal>
        {
            ["preference"] = 0.30m, ["survey"] = 0m, ["category"] = 0.12m, ["coPurchase"] = 0.06m, ["rating"] = 0.09m, ["plan"] = 0.10m
        }, result.Breakdown);
        Assert.Equal(["Hợp với sở thích Da dầu", "Bạn hay chọn Làm sạch"], result.Reasons.Select(r => r.Label));
        Assert.Equal(["PREFERENCE", "CATEGORY"], result.Reasons.Select(r => r.Code));
        Assert.Equal(5, result.PlanId);
    }

    [Fact]
    public void Preference_and_survey_count_the_share_of_product_tags_and_few_reviews_rate_neutral()
    {
        var customer = Customer(surveyPreferences: [2]);
        var result = RecommendationScorer.ScoreOne(customer, Product(1, tags: [DaDau, 2, 3, 4], avg: 5, feedback: 2), Weights);

        Assert.Equal(0.075m, result.Breakdown["preference"]);
        Assert.Equal(0.0375m, result.Breakdown["survey"]);
        Assert.Equal(0.05m, result.Breakdown["rating"]);
        Assert.DoesNotContain(result.Reasons, r => r.Code == "RATING");
    }

    [Fact]
    public void Excludes_upcoming_recent_dismissed_low_rated_category_and_low_rated_product()
    {
        var customer = Customer(1m, recent: [2], dismissed: [3], lowCategories: [20], lowProducts: [5]);
        var products = new[]
        {
            Product(1), Product(2), Product(3), Product(4, category: 20), Product(5), Product(6, status: ProductStatus.Upcoming),
            Product(7, status: ProductStatus.Inactive),
        };

        Assert.Equal([1], RecommendationScorer.Score(customer, products, Weights).Select(s => s.ProductId));
    }

    [Fact]
    public void Drops_scores_under_threshold_and_keeps_the_best_six()
    {
        // Untagged product with neutral rating only: 0.05, under 0.25.
        var weak = Product(1, tags: [], feedback: 0);
        var strong = Enumerable.Range(10, 8).Select(id => Product(id, avg: 1 + (id - 10) * 0.5m));
        var result = RecommendationScorer.Score(Customer(0.5m), strong.Append(weak), Weights);

        Assert.Equal(RecommendationScorer.MaxPerCustomer, result.Count);
        Assert.DoesNotContain(result, s => s.ProductId == 1);
        Assert.All(result, s => Assert.True(s.Score >= RecommendationScorer.Threshold));
        Assert.Equal(result.OrderByDescending(s => s.Score).Select(s => s.ProductId), result.Select(s => s.ProductId));
        Assert.Equal(17, result[0].ProductId);
    }

    [Fact]
    public void Equal_contributions_keep_table_order_for_reasons()
    {
        // Category 0.5 × 0.20 = 0.10 and Plan 1 × 0.10 = 0.10 tie; Category comes first in spec 7.2.
        var customer = Customer(0.5m, plans: new() { [1] = new(9, "Kế hoạch") }, declared: []);
        var result = RecommendationScorer.ScoreOne(customer, Product(1, tags: [], feedback: 0), Weights);

        Assert.Equal(["CATEGORY", "PLAN"], result.Reasons.Select(r => r.Code));
    }

    [Fact]
    public void Segment_matches_every_set_criterion_and_treats_empty_as_no_limit()
    {
        var facts = new CustomerFacts(1, "Lan", "lan@example.com", 24, "Nữ", new HashSet<int> { 3 }, new HashSet<int> { 2 },
            new HashSet<int> { 7 }, 30);

        Assert.True(SegmentMatcher.Matches(facts, new SegmentFilter(null, null, [], [], [], null, [])));
        Assert.True(SegmentMatcher.Matches(facts, new SegmentFilter(18, 34, ["Nữ"], [3, 9], [2], 90, [8])));
        Assert.False(SegmentMatcher.Matches(facts, new SegmentFilter(25, null, null, null, null, null, null)));
        Assert.False(SegmentMatcher.Matches(facts, new SegmentFilter(null, null, null, null, null, 7, null)));
        Assert.False(SegmentMatcher.Matches(facts, new SegmentFilter(null, null, null, null, null, null, [7])));
        Assert.False(SegmentMatcher.Matches(facts with { Age = null }, new SegmentFilter(18, null, null, null, null, null, null)));
    }
}
