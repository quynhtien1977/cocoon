using Cocoon.Domain.Enums;

namespace Cocoon.Domain.Entities;

public sealed class Feedback
{
    public int Id { get; set; }
    public int CustomerId { get; set; }
    public int ProductId { get; set; }
    public int? OrderItemId { get; set; }
    public int Rating { get; set; }
    public string Content { get; set; } = string.Empty;
    public FeedbackStatus Status { get; set; } = FeedbackStatus.New;
    public int? AcceptedBy { get; set; }
    public DateTime? AcceptedAt { get; set; }
    public int? AssignedStaffId { get; set; }
    public DateTime? RepliedAt { get; set; }
    public DateTime? ClosedAt { get; set; }
    /// <summary>The customer's one follow-up after the first reply; it sends the feedback back to its staff.</summary>
    public string? FollowUpContent { get; set; }
    public DateTime? FollowUpAt { get; set; }
    /// <summary>A Replied feedback closes itself at this time; null means it waits for a manager.</summary>
    public DateTime? AutoCloseAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

