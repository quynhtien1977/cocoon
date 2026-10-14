using Cocoon.Domain.Enums;

namespace Cocoon.Domain.Entities;

public sealed class FeedbackReply
{
    public int Id { get; set; }
    public int FeedbackId { get; set; }
    public int StaffId { get; set; }
    public string Content { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

