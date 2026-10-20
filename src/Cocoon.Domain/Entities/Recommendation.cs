using Cocoon.Domain.Enums;

namespace Cocoon.Domain.Entities;

public sealed class Recommendation
{
    public int Id { get; set; }
    public int CustomerId { get; set; }
    public int ProductId { get; set; }
    public decimal Score { get; set; }
    public string Breakdown { get; set; } = "{}";
    public string Reasons { get; set; } = "[]";
    public int? PlanId { get; set; }
    public RecommendationStatus Status { get; set; } = RecommendationStatus.Active;
    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;
    public DateTime? InteractedAt { get; set; }
}

public sealed class RecommendationPlan
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Goal { get; set; }
    public string Segment { get; set; } = "{}";
    public RecommendationPlanStatus Status { get; set; } = RecommendationPlanStatus.Draft;
    public DateTime StartAt { get; set; }
    public DateTime EndAt { get; set; }
    public int CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public sealed class RecommendationPlanProduct
{
    public int PlanId { get; set; }
    public int ProductId { get; set; }
    public int SortOrder { get; set; }
}
