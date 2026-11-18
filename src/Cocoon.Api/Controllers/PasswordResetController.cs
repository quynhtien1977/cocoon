using System.ComponentModel.DataAnnotations;
using Cocoon.Infrastructure.Accounts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Cocoon.Api.Controllers;

/// <summary>
/// "Quên mật khẩu" and first password of an invited account, with a 6-digit code sent by email (decision 15/11/2026).
/// Anonymous; neither endpoint tells whether an email has an account.
/// </summary>
[Route("api/v1/auth/password")]
[AllowAnonymous]
public sealed class PasswordResetController(PasswordResetService resets) : ApiStubController
{
    public const string ForgotMessage = "Nếu email này có tài khoản Cocoon, mã xác nhận đã được gửi tới hộp thư. Mã có hiệu lực 15 phút.";

    /// <summary>202 with the same message whether or not the email exists, is locked or asked a moment ago.</summary>
    [HttpPost("forgot"), ProducesResponseType<PasswordMessage>(StatusCodes.Status202Accepted)]
    public async Task<IActionResult> Forgot(ForgotPasswordRequest request, CancellationToken ct)
    {
        await resets.RequestResetAsync(request.Email, ct);
        return Accepted(new PasswordMessage(ForgotMessage));
    }

    /// <summary>
    /// Checks the code before the form asks for a new password: 200 with a ticket valid up to 10 minutes, or
    /// 400 INVALID_CODE (field code). Each check counts toward the 5 tries of the code.
    /// </summary>
    [HttpPost("verify"), ProducesResponseType<PasswordTicket>(StatusCodes.Status200OK)]
    public async Task<ActionResult<PasswordTicket>> Verify(VerifyPasswordCodeRequest request, CancellationToken ct)
    {
        Response.Headers.CacheControl = "no-store";
        return await resets.VerifyAsync(request.Email, request.Code, ct);
    }

    /// <summary>204, or 400 RESET_EXPIRED (ticket used, replaced by a newer code or too old) / VALIDATION_ERROR (field newPassword).</summary>
    [HttpPost("reset"), ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Reset(ResetPasswordRequest request, CancellationToken ct)
    {
        await resets.ResetAsync(request.Ticket, request.NewPassword, ct);
        return NoContent();
    }
}

public sealed record ForgotPasswordRequest([Required, EmailAddress, StringLength(256)] string Email);
public sealed record VerifyPasswordCodeRequest([Required, EmailAddress, StringLength(256)] string Email,
    [Required, StringLength(6, MinimumLength = 6)] string Code);
public sealed record ResetPasswordRequest([Required, StringLength(200)] string Ticket, [Required, StringLength(128)] string NewPassword);
public sealed record PasswordMessage(string Message);
