using System.ComponentModel.DataAnnotations;
using Cocoon.Application.Accounts;
using Cocoon.Infrastructure.Accounts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Cocoon.Api.Controllers;

[Route("api/v1/customers")]
[Authorize(Policy = "RequireManager")]
[ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
[ProducesResponseType<ProblemDetails>(StatusCodes.Status401Unauthorized)]
[ProducesResponseType<ProblemDetails>(StatusCodes.Status403Forbidden)]
[ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
[ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
public sealed class CustomersController(AccountManagementService accounts) : ApiStubController
{
    [HttpGet, ProducesResponseType<CustomerPage<CustomerRow>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<CustomerPage<CustomerRow>>> List([FromQuery] CustomerQuery query, CancellationToken ct) =>
        Ok(await accounts.CustomersAsync(query, ct));

    [HttpPost, ProducesResponseType<AccountCreated>(StatusCodes.Status201Created)]
    public async Task<ActionResult<AccountCreated>> Create(CreateCustomerRequest request, CancellationToken ct)
    {
        var result = await accounts.CreateCustomerAsync(AccountId, request.Email, new CustomerInput(request.FullName, request.Phone,
            request.DateOfBirth, request.Gender, request.Address, request.ConsentPersonalData, request.PreferenceIds), ct);
        Response.Headers.CacheControl = "no-store";
        return CreatedAtAction(nameof(Get), new { id = result.Id }, result);
    }

    [HttpGet("{id:int}"), ProducesResponseType<CustomerDetails>(StatusCodes.Status200OK)]
    public async Task<ActionResult<CustomerDetails>> Get(int id, CancellationToken ct) => Ok(await accounts.CustomerAsync(id, ct));

    [HttpPut("{id:int}"), ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Update(int id, CustomerInput request, CancellationToken ct)
    { await accounts.UpdateCustomerAsync(AccountId, id, request, ct); return NoContent(); }

    [HttpPost("{id:int}/lock"), ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Lock(int id, CancellationToken ct)
    { await accounts.ChangeStatusAsync(AccountId, id, false, ct, customerOnly: true); return NoContent(); }

    [HttpPost("{id:int}/unlock"), ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Unlock(int id, CancellationToken ct)
    { await accounts.ChangeStatusAsync(AccountId, id, true, ct, customerOnly: true); return NoContent(); }

    [HttpDelete("{id:int}"), ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    { await accounts.DeleteAsync(AccountId, id, ct, customerOnly: true); return NoContent(); }

    [HttpGet("{id:int}/orders"), ProducesResponseType<CustomerPage<CustomerOrderRow>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<CustomerPage<CustomerOrderRow>>> Orders(int id, CancellationToken ct, int page = 1, int pageSize = 20) =>
        Ok(await accounts.CustomerOrdersAsync(id, page, pageSize, ct));

    [HttpGet("{id:int}/feedback"), ProducesResponseType<CustomerPage<CustomerFeedbackRow>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<CustomerPage<CustomerFeedbackRow>>> Feedback(int id, CancellationToken ct, int page = 1, int pageSize = 20) =>
        Ok(await accounts.CustomerFeedbackAsync(id, page, pageSize, ct));

    [HttpGet("{id:int}/surveys"), ProducesResponseType<CustomerPage<CustomerSurveyRow>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<CustomerPage<CustomerSurveyRow>>> Surveys(int id, CancellationToken ct, int page = 1, int pageSize = 20) =>
        Ok(await accounts.CustomerSurveysAsync(id, page, pageSize, ct));

    [HttpGet("{id:int}/recommendations")] public IActionResult Recommendations(int id) => NotImplementedYet();
}

public sealed record CreateCustomerRequest([Required, EmailAddress, StringLength(256)] string Email,
    [Required, StringLength(200, MinimumLength = 2)] string FullName, [StringLength(32)] string? Phone = null, DateOnly? DateOfBirth = null,
    string? Gender = null, [StringLength(1000)] string? Address = null, bool ConsentPersonalData = false, int[]? PreferenceIds = null);
