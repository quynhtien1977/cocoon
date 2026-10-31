using System.ComponentModel.DataAnnotations;
using Cocoon.Infrastructure.Accounts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Cocoon.Api.Controllers;

[Route("api/v1/auth/change-password")]
[Authorize]
public sealed class ChangePasswordController(AccountManagementService accounts) : ApiStubController
{
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Change(ChangePasswordRequest request, CancellationToken ct)
    {
        await accounts.ChangePasswordAsync(AccountId, request.CurrentPassword, request.NewPassword, ct);
        Auth.TokenService.SignOut(Response);
        return NoContent();
    }
}

public sealed record ChangePasswordRequest([Required, StringLength(128)] string CurrentPassword,
    [Required, StringLength(128, MinimumLength = 8)] string NewPassword);
