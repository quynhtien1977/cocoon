using Cocoon.Domain.Enums;

namespace Cocoon.Domain.Entities;

public sealed class FeedbackReply
{
    public int Id { get; set; }
    public int FeedbackId { get; set; }
    public int StaffId { get; set; }
    /// <summary>1 answers the feedback, 2 answers the customer's follow-up.</summary>
    public int Round { get; set; } = 1;
    public string Content { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

