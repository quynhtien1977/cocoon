using Cocoon.Domain.Enums;

namespace Cocoon.Domain.Entities;

public sealed class PasswordResetToken
{
    public int Id { get; set; }
    public int AccountId { get; set; }
    public string TokenHash { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public DateTime? UsedAt { get; set; }
}

