using Cocoon.Domain.Enums;

namespace Cocoon.Domain.Entities;

public sealed class ActivityLog
{
    public int Id { get; set; }
    public int? AccountId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public int? EntityId { get; set; }
    public string? Detail { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

