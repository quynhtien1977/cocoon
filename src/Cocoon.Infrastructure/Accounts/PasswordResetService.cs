using System.Net;
using System.Security.Cryptography;
using System.Text;
using Cocoon.Application.Accounts;
using Cocoon.Application.Email;
using Cocoon.Domain.Entities;
using Cocoon.Domain.Enums;
using Cocoon.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Cocoon.Infrastructure.Accounts;

public sealed class PasswordResetOptions
{
    /// <summary>HMAC key for stored codes; the API sets it from Jwt:Key so no extra secret is needed.</summary>
    public string Secret { get; set; } = string.Empty;
    /// <summary>Web:Origin, for the "đặt mật khẩu" link in the email.</summary>
    public string WebOrigin { get; set; } = "http://localhost:3000";
    public TimeSpan InvitationLifetime { get; set; } = TimeSpan.FromHours(24);
    public TimeSpan ResetLifetime { get; set; } = TimeSpan.FromMinutes(15);
    public int MaxAttempts { get; set; } = 5;
    public TimeSpan Cooldown { get; set; } = TimeSpan.FromSeconds(60);
    public int MaxCodesPerHour { get; set; } = 5;
    /// <summary>How long the ticket from a verified code may set the password.</summary>
    public TimeSpan TicketLifetime { get; set; } = TimeSpan.FromMinutes(10);
}

/// <summary>Proof that the code was right; POST /auth/password/reset spends it once with the new password.</summary>
public sealed record PasswordTicket(string Ticket, DateTime ExpiresAt);

/// <summary>
/// Email one-time codes (decision 15/11/2026). A manager-created customer gets an invitation code instead of a password
/// shown on screen; anyone can ask for a reset code ("Quên mật khẩu"). The code is 6 digits, stored only as an HMAC,
/// used once, cancelled by a newer code, and dies after <see cref="PasswordResetOptions.MaxAttempts"/> tries.
/// </summary>
public sealed class PasswordResetService(AppDbContext db, IAccountPasswords passwords, IEmailSender email,
    IOptions<PasswordResetOptions> options, ILogger<PasswordResetService> logger)
{
    public const string InvalidCodeMessage = "Mã xác nhận không đúng hoặc đã hết hạn. Hãy yêu cầu mã mới.";
    private PasswordResetOptions Options => options.Value;

    /// <summary>
    /// Invitation for an account that still has its generated password. With <paramref name="quiet"/> a delivery failure
    /// returns false (the account was already created); otherwise it is a 503 the caller can retry.
    /// </summary>
    public async Task<bool> InviteAsync(int accountId, CancellationToken ct, bool quiet = false)
    {
        var account = await db.Set<Account>().SingleOrDefaultAsync(a => a.Id == accountId, ct)
            ?? throw new AccountOperationException(404, "NOT_FOUND", "Không tìm thấy tài khoản.");
        if (!account.IsActive)
            throw new AccountOperationException(409, "ACCOUNT_LOCKED", "Tài khoản đang bị khóa; mở khóa trước khi gửi mã.");
        if (!account.MustChangePassword)
            throw new AccountOperationException(409, "ALREADY_ACTIVATED", "Khách đã tự đặt mật khẩu. Khách có thể dùng \"Quên mật khẩu\" nếu cần.");
        if (await TooSoonAsync(account.Id, ct))
            throw new AccountOperationException(429, "TOO_MANY_REQUESTS", "Vừa gửi mã cho tài khoản này. Hãy chờ một phút rồi thử lại.");
        return await IssueAsync(account, PasswordTokenPurpose.Invitation, quiet, ct);
    }

    /// <summary>"Quên mật khẩu": always silent, so the response never tells whether the email has an account.</summary>
    public async Task RequestResetAsync(string address, CancellationToken ct)
    {
        var normalized = address.Trim().ToLowerInvariant();
        var account = await db.Set<Account>().SingleOrDefaultAsync(a => a.Email.ToLower() == normalized && a.IsActive, ct);
        if (account is null || await TooSoonAsync(account.Id, ct)) return;
        await IssueAsync(account, PasswordTokenPurpose.Reset, quiet: true, ct);
    }

    /// <summary>
    /// Step 2 of "Quên mật khẩu": checks the code against the newest live code of the account without using it up, so the
    /// form can ask for the new password only after a right code. Every wrong case gives the same 400 INVALID_CODE, and
    /// each check counts toward <see cref="PasswordResetOptions.MaxAttempts"/>.
    /// </summary>
    public async Task<PasswordTicket> VerifyAsync(string address, string code, CancellationToken ct)
    {
        code = code.Trim();
        var normalized = address.Trim().ToLowerInvariant();
        var now = DateTime.UtcNow;
        var account = await db.Set<Account>().AsNoTracking().SingleOrDefaultAsync(a => a.Email.ToLower() == normalized && a.IsActive, ct);
        var token = account is null ? null : await db.Set<PasswordResetToken>().AsNoTracking()
            .Where(t => t.AccountId == account.Id && t.UsedAt == null && t.ExpiresAt > now)
            .OrderByDescending(t => t.Id).FirstOrDefaultAsync(ct);
        if (account is null || token is null || code.Length != 6 || !code.All(char.IsAsciiDigit)) throw InvalidCode();

        // Claiming the attempt first, conditionally, keeps parallel guesses within MaxAttempts.
        var claimed = await db.Set<PasswordResetToken>()
            .Where(t => t.Id == token.Id && t.UsedAt == null && t.ExpiresAt > now && t.Attempts < Options.MaxAttempts)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.Attempts, t => t.Attempts + 1), ct);
        var expected = Encoding.ASCII.GetBytes(Hash(token.Id, code));
        if (claimed == 0 || !CryptographicOperations.FixedTimeEquals(expected, Encoding.ASCII.GetBytes(token.TokenHash))) throw InvalidCode();

        var issued = (long)(now - DateTime.UnixEpoch).TotalSeconds;
        var expiresAt = now + Options.TicketLifetime < token.ExpiresAt ? now + Options.TicketLifetime : token.ExpiresAt;
        return new PasswordTicket($"{token.Id}.{issued}.{TicketMac(token.Id, issued, token.TokenHash)}", expiresAt);
    }

    /// <summary>
    /// Step 3: sets the password with a ticket from <see cref="VerifyAsync"/>. The ticket is signed over the stored code
    /// hash, so it cannot be forged, and dies with its code: once used, when a newer code is sent, or after
    /// <see cref="PasswordResetOptions.TicketLifetime"/>. A dead ticket gives 400 RESET_EXPIRED; the form asks for the code again.
    /// Success clears the generated-password flag and login lockout and ends every session.
    /// </summary>
    public async Task ResetAsync(string ticket, string newPassword, CancellationToken ct)
    {
        if (AccountManagementService.PasswordProblem(newPassword) is { } problem)
            throw new AccountOperationException(400, "VALIDATION_ERROR", problem, "newPassword");
        var now = DateTime.UtcNow;
        var parts = ticket.Trim().Split('.');
        if (parts.Length != 3 || !int.TryParse(parts[0], out var tokenId) || !long.TryParse(parts[1], out var issued)) throw ExpiredTicket();
        var issuedAt = DateTime.UnixEpoch.AddSeconds(Math.Clamp(issued, 0, 4_102_444_800));
        if (issuedAt + Options.TicketLifetime <= now || issuedAt > now.AddMinutes(1)) throw ExpiredTicket();
        var token = await db.Set<PasswordResetToken>().AsNoTracking()
            .SingleOrDefaultAsync(t => t.Id == tokenId && t.UsedAt == null && t.ExpiresAt > now, ct);
        if (token is null || !CryptographicOperations.FixedTimeEquals(
                Encoding.ASCII.GetBytes(TicketMac(token.Id, issued, token.TokenHash)), Encoding.ASCII.GetBytes(parts[2]))) throw ExpiredTicket();
        var account = await db.Set<Account>().SingleOrDefaultAsync(a => a.Id == token.AccountId && a.IsActive, ct) ?? throw ExpiredTicket();

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var used = await db.Set<PasswordResetToken>().Where(t => t.Id == token.Id && t.UsedAt == null && t.ExpiresAt > now)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.UsedAt, now), ct);
        if (used == 0) throw ExpiredTicket();
        await db.Set<PasswordResetToken>().Where(t => t.AccountId == account.Id && t.UsedAt == null && t.ExpiresAt > now)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.ExpiresAt, now), ct);
        account.PasswordHash = passwords.Hash(account, newPassword);
        (account.MustChangePassword, account.FailedLoginCount, account.LockoutEnd) = (false, 0, null);
        await db.Set<RefreshToken>().Where(t => t.AccountId == account.Id && t.ExpiresAt > now)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, t => t.RevokedAt ?? now).SetProperty(t => t.ExpiresAt, now), ct);
        db.Add(new ActivityLog
        {
            AccountId = account.Id, EntityId = account.Id, EntityType = "Account",
            Action = token.Purpose == PasswordTokenPurpose.Invitation ? "PasswordSetFromInvitation" : "PasswordReset",
        });
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
    }

    private async Task<bool> TooSoonAsync(int accountId, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var recent = await db.Set<PasswordResetToken>().Where(t => t.AccountId == accountId && t.CreatedAt > now.AddHours(-1))
            .Select(t => t.CreatedAt).ToListAsync(ct);
        return recent.Count >= Options.MaxCodesPerHour || recent.Any(at => at > now - Options.Cooldown);
    }

    private async Task<bool> IssueAsync(Account account, PasswordTokenPurpose purpose, bool quiet, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var lifetime = purpose == PasswordTokenPurpose.Invitation ? Options.InvitationLifetime : Options.ResetLifetime;
        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        await using (var transaction = await db.Database.BeginTransactionAsync(ct))
        {
            await db.Set<PasswordResetToken>().Where(t => t.AccountId == account.Id && t.UsedAt == null && t.ExpiresAt > now)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.ExpiresAt, now), ct);
            // The hash binds the code to the row id, so the row goes in first with a random placeholder.
            var token = new PasswordResetToken
            {
                AccountId = account.Id, Purpose = purpose, CreatedAt = now, ExpiresAt = now + lifetime,
                TokenHash = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)),
            };
            db.Add(token);
            await db.SaveChangesAsync(ct);
            token.TokenHash = Hash(token.Id, code);
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            try
            {
                await email.SendAsync(await MessageAsync(account, purpose, code, lifetime, ct), ct);
                return true;
            }
            catch (EmailDeliveryException e)
            {
                // A code nobody received must not hold the cooldown; nothing else references the row.
                logger.LogWarning(e, "One-time code email for account {AccountId} was not sent", account.Id);
                await db.Set<PasswordResetToken>().Where(t => t.Id == token.Id).ExecuteDeleteAsync(CancellationToken.None);
                if (quiet) return false;
                throw new AccountOperationException(503, e.NotConfigured ? "EMAIL_NOT_CONFIGURED" : "EMAIL_SEND_FAILED",
                    e.NotConfigured ? "Máy chủ chưa cấu hình gửi email (SMTP)." : "Chưa gửi được email. Hãy thử lại sau ít phút.");
            }
        }
    }

    private async Task<EmailMessage> MessageAsync(Account account, PasswordTokenPurpose purpose, string code, TimeSpan lifetime, CancellationToken ct)
    {
        var name = await db.Set<CustomerProfile>().Where(p => p.AccountId == account.Id).Select(p => p.FullName).FirstOrDefaultAsync(ct)
            ?? await db.Set<StaffProfile>().Where(p => p.AccountId == account.Id).Select(p => p.FullName).FirstOrDefaultAsync(ct)
            ?? account.Email;
        var link = $"{Options.WebOrigin.TrimEnd('/')}/reset-password?email={Uri.EscapeDataString(account.Email)}";
        var validity = lifetime.TotalHours >= 1 ? $"{lifetime.TotalHours:0} giờ" : $"{lifetime.TotalMinutes:0} phút";
        var invitation = purpose == PasswordTokenPurpose.Invitation;
        var subject = invitation ? "Kích hoạt tài khoản Cocoon của bạn" : "Mã đặt lại mật khẩu Cocoon";
        var intro = invitation
            ? "Cocoon đã tạo tài khoản cho bạn. Dùng mã dưới đây để tự đặt mật khẩu và đăng nhập."
            : "Bạn vừa yêu cầu đặt lại mật khẩu tài khoản Cocoon. Dùng mã dưới đây để đặt mật khẩu mới.";
        var text = $"Xin chào {name},\n\n{intro}\n\nMã xác nhận: {code}\nMã có hiệu lực trong {validity} và chỉ dùng được một lần.\n\n"
            + $"Đặt mật khẩu tại: {link}\n\nNếu bạn không yêu cầu, hãy bỏ qua email này; mật khẩu hiện tại không đổi.\n\n— Cocoon Việt Nam";
        var html = $"""
            <div style="font-family:Arial,sans-serif;color:#2b261d;max-width:520px">
              <p>Xin chào {WebUtility.HtmlEncode(name)},</p>
              <p>{WebUtility.HtmlEncode(intro)}</p>
              <p style="font-size:28px;letter-spacing:6px;font-weight:bold;margin:24px 0">{code}</p>
              <p>Mã có hiệu lực trong {validity} và chỉ dùng được một lần.</p>
              <p><a href="{WebUtility.HtmlEncode(link)}" style="color:#806b3f">Đặt mật khẩu</a></p>
              <p style="color:#827a67;font-size:13px">Nếu bạn không yêu cầu, hãy bỏ qua email này; mật khẩu hiện tại không đổi.</p>
              <p>— Cocoon Việt Nam</p>
            </div>
            """;
        return new EmailMessage(account.Email, subject, text, html);
    }

    private string Hash(int tokenId, string code)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes("password-code:" + Options.Secret));
        return Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes($"{tokenId}:{code}")));
    }

    private string TicketMac(int tokenId, long issued, string tokenHash)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes("password-ticket:" + Options.Secret));
        return Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes($"{tokenId}:{issued}:{tokenHash}")));
    }

    private static AccountOperationException InvalidCode() => new(400, "INVALID_CODE", InvalidCodeMessage, "code");

    private static AccountOperationException ExpiredTicket() =>
        new(400, "RESET_EXPIRED", "Phiên đặt mật khẩu đã hết hạn. Hãy nhập lại mã xác nhận hoặc yêu cầu mã mới.");
}
