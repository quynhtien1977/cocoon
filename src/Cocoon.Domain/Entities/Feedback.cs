using Cocoon.Domain.Enums;

namespace Cocoon.Domain.Entities;

public sealed class Feedback
{
    public int Id { get; set; }
    public int CustomerId { get; set; }
    public int ProductId { get; set; }
    public int Rating { get; set; }
    public string Content { get; set; } = string.Empty;
    public FeedbackStatus Status { get; set; } = FeedbackStatus.New;
    public int? AcceptedBy { get; set; }
    public DateTime? AcceptedAt { get; set; }
    public int? AssignedStaffId { get; set; }
    public DateTime? RepliedAt { get; set; }
    public DateTime? ClosedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

