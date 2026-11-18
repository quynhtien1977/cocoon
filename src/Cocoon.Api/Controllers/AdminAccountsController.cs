using System.ComponentModel.DataAnnotations;
using Cocoon.Application.Accounts;
using Cocoon.Domain.Enums;
using Cocoon.Infrastructure.Accounts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Cocoon.Api.Controllers;

[Route("api/v1/admin/accounts")]
[Authorize(Policy = "RequireAdmin")]
[ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
[ProducesResponseType<ProblemDetails>(StatusCodes.Status401Unauthorized)]
[ProducesResponseType<ProblemDetails>(StatusCodes.Status403Forbidden)]
[ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
[ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
public sealed class AdminAccountsController(AccountManagementService accounts, PasswordResetService resets) : ApiStubController
{
    [HttpGet]
    [ProducesResponseType<AccountPage>(StatusCodes.Status200OK)]
    public async Task<ActionResult<AccountPage>> List([FromQuery] AccountQuery query, CancellationToken ct) =>
        Ok(await accounts.ListAsync(query, ct));

    /// <summary>
    /// The generated password never leaves the server in HTTP responses: the user receives it by email and can use it right
    /// away (changing it is optional). invitationSent=false means the account exists but the email failed; resend with POST {id}/invitation.
    /// </summary>
    [HttpPost]
    [ProducesResponseType<AccountCreated>(StatusCodes.Status201Created)]
    public async Task<ActionResult<AccountCreated>> Create(CreateAccountRequest request, CancellationToken ct)
    {
        var result = await accounts.CreateAsync(AccountId, request.Email, request.FullName, request.Role!.Value, request.Phone, ct);
        var sent = await resets.SendTemporaryPasswordAsync(result.Id, result.TemporaryPassword, ct);
        Response.Headers.CacheControl = "no-store";
        return StatusCode(StatusCodes.Status201Created, new AccountCreated(result.Id, result.Email, result.Role, result.MustChangePassword, sent));
    }

    /// <summary>
    /// Issues a new temporary password and emails it to an account that has not changed its initial password yet.
    /// 409 ALREADY_ACTIVATED / ACCOUNT_LOCKED, 429 TOO_MANY_REQUESTS, 503 EMAIL_NOT_CONFIGURED / EMAIL_SEND_FAILED.
    /// </summary>
    [HttpPost("{id:int}/invitation"), ProducesResponseType<InvitationSent>(StatusCodes.Status202Accepted)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status429TooManyRequests)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> Invite(int id, CancellationToken ct)
    {
        await accounts.EnsureScopeAsync(id, AccountScope.Internal, ct);  // 404 / 403 for a customer account
        await resets.ResendTemporaryPasswordAsync(id, ct);
        return Accepted(new InvitationSent(true));
    }

    [HttpPatch("{id:int}/role")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> ChangeRole(int id, ChangeRoleRequest request, CancellationToken ct)
    { await accounts.ChangeRoleAsync(AccountId, id, request.Role!.Value, ct); return NoContent(); }

    [HttpPatch("{id:int}/status")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> ChangeStatus(int id, ChangeStatusRequest request, CancellationToken ct)
    { await accounts.ChangeStatusAsync(AccountId, id, request.IsActive!.Value, AccountScope.Internal, ct); return NoContent(); }

    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    { await accounts.DeleteAsync(AccountId, id, AccountScope.Internal, ct); return NoContent(); }
}

public sealed record CreateAccountRequest([Required, EmailAddress, StringLength(256)] string Email,
    [Required, StringLength(200, MinimumLength = 2)] string FullName, [Required, EnumDataType(typeof(AccountRole))] AccountRole? Role,
    [StringLength(32)] string? Phone = null);
public sealed record ChangeRoleRequest([Required, EnumDataType(typeof(AccountRole))] AccountRole? Role);
public sealed record ChangeStatusRequest([Required] bool? IsActive);
