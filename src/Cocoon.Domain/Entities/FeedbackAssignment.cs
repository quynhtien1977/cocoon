using Cocoon.Domain.Enums;

namespace Cocoon.Domain.Entities;

public sealed class FeedbackAssignment
{
    public int Id { get; set; }
    public int FeedbackId { get; set; }
    public int StaffId { get; set; }
    public int AssignedBy { get; set; }
    public DateTime AssignedAt { get; set; } = DateTime.UtcNow;
}

