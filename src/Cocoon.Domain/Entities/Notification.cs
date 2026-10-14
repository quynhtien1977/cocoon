using Cocoon.Domain.Enums;

namespace Cocoon.Domain.Entities;

public sealed class Notification
{
    public int Id { get; set; }
    public int AccountId { get; set; }
    public string Type { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string RefType { get; set; } = string.Empty;
    public int RefId { get; set; }
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

