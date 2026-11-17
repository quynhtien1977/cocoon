using Cocoon.Domain.Enums;

namespace Cocoon.Domain.Entities;

public sealed class Account
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public AccountRole Role { get; set; } = AccountRole.Customer;
    public bool IsActive { get; set; } = true;
    public bool IsDeleted { get; set; }
    /// <summary>
    /// Still on the generated password emailed when the account was created; cleared by a password change or reset.
    /// Informational only (profile reminder, resend allowed): it does not block any API (decision 17/11/2026).
    /// </summary>
    public bool MustChangePassword { get; set; }
    public int FailedLoginCount { get; set; }
    public DateTime? LockoutEnd { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginAt { get; set; }
}

