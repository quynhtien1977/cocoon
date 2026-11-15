using Cocoon.Domain.Enums;

namespace Cocoon.Domain.Entities;

/// <summary>
/// A one-time 6-digit code sent by email (decision 15/11/2026). Invitation sets the first password of an account a
/// manager created; Reset is "Quên mật khẩu". Only an HMAC of the code is stored. A newer code of the same account
/// cancels the older ones, and Attempts counts every try, right or wrong, so the code dies after a few guesses.
/// </summary>
public sealed class PasswordResetToken
{
    public int Id { get; set; }
    public int AccountId { get; set; }
    public PasswordTokenPurpose Purpose { get; set; } = PasswordTokenPurpose.Reset;
    public string TokenHash { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }
    public DateTime? UsedAt { get; set; }
    public int Attempts { get; set; }
}
