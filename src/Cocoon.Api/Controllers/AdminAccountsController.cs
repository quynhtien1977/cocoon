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
public sealed class AdminAccountsController(AccountManagementService accounts) : ApiStubController
{
    [HttpGet]
    [ProducesResponseType<AccountPage>(StatusCodes.Status200OK)]
    public async Task<ActionResult<AccountPage>> List([FromQuery] AccountQuery query, CancellationToken ct) =>
        Ok(await accounts.ListAsync(query, ct));

    [HttpPost]
    [ProducesResponseType<AccountCreated>(StatusCodes.Status201Created)]
    public async Task<ActionResult<AccountCreated>> Create(CreateAccountRequest request, CancellationToken ct)
    {
        var result = await accounts.CreateAsync(AccountId, request.Email, request.FullName, request.Role!.Value, ct);
        Response.Headers.CacheControl = "no-store";
        return StatusCode(StatusCodes.Status201Created, result);
    }

    [HttpPatch("{id:int}/role")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> ChangeRole(int id, ChangeRoleRequest request, CancellationToken ct)
    { await accounts.ChangeRoleAsync(AccountId, id, request.Role!.Value, ct); return NoContent(); }

    [HttpPatch("{id:int}/status")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> ChangeStatus(int id, ChangeStatusRequest request, CancellationToken ct)
    { await accounts.ChangeStatusAsync(AccountId, id, request.IsActive!.Value, ct); return NoContent(); }

    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    { await accounts.DeleteAsync(AccountId, id, ct); return NoContent(); }
}

public sealed record CreateAccountRequest([Required, EmailAddress, StringLength(256)] string Email,
    [Required, StringLength(200, MinimumLength = 2)] string FullName, [Required, EnumDataType(typeof(AccountRole))] AccountRole? Role);
public sealed record ChangeRoleRequest([Required, EnumDataType(typeof(AccountRole))] AccountRole? Role);
public sealed record ChangeStatusRequest([Required] bool? IsActive);
