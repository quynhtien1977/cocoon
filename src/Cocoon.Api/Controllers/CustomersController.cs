using System.ComponentModel.DataAnnotations;
using Cocoon.Application.Accounts;
using Cocoon.Application.Recommendations;
using Cocoon.Infrastructure.Accounts;
using Cocoon.Infrastructure.Recommendations;
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
public sealed class CustomersController(AccountManagementService accounts, RecommendationService recommendations,
    PasswordResetService resets) : ApiStubController
{
    [HttpGet, ProducesResponseType<CustomerPage<CustomerRow>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<CustomerPage<CustomerRow>>> List([FromQuery] CustomerQuery query, CancellationToken ct) =>
        Ok(await accounts.CustomersAsync(query, ct));

    /// <summary>
    /// The generated password never leaves the server: the customer gets an email code to set their own (decision
    /// 15/11/2026). invitationSent=false means the account exists but the email failed; resend with POST {id}/invitation.
    /// </summary>
    [HttpPost, ProducesResponseType<CustomerCreated>(StatusCodes.Status201Created)]
    public async Task<ActionResult<CustomerCreated>> Create(CreateCustomerRequest request, CancellationToken ct)
    {
        var result = await accounts.CreateCustomerAsync(AccountId, request.Email, new CustomerInput(request.FullName, request.Phone,
            request.DateOfBirth, request.Gender, request.Address, request.ConsentPersonalData, request.PreferenceIds), ct);
        var sent = await resets.InviteAsync(result.Id, ct, quiet: true);
        Response.Headers.CacheControl = "no-store";
        return CreatedAtAction(nameof(Get), new { id = result.Id }, new CustomerCreated(result.Id, result.Email, result.Role, result.MustChangePassword, sent));
    }

    /// <summary>
    /// A new code for a customer who has not set a password yet. 409 ALREADY_ACTIVATED afterwards (the customer uses
    /// "Quên mật khẩu"), 429 within a minute of the last code, 503 EMAIL_NOT_CONFIGURED / EMAIL_SEND_FAILED.
    /// </summary>
    [HttpPost("{id:int}/invitation"), ProducesResponseType<InvitationSent>(StatusCodes.Status202Accepted)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status429TooManyRequests)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> Invite(int id, CancellationToken ct)
    {
        await accounts.CustomerAsync(id, ct);  // 404 / 403 unless id is a customer
        await resets.InviteAsync(id, ct);
        return Accepted(new InvitationSent(true));
    }

    [HttpGet("{id:int}"), ProducesResponseType<CustomerDetails>(StatusCodes.Status200OK)]
    public async Task<ActionResult<CustomerDetails>> Get(int id, CancellationToken ct) => Ok(await accounts.CustomerAsync(id, ct));

    [HttpPut("{id:int}"), ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Update(int id, CustomerInput request, CancellationToken ct)
    {
        await accounts.UpdateCustomerAsync(AccountId, id, request, ct);
        // Consent or preferences may have changed; recommendations must follow them (spec 7.3).
        await recommendations.RebuildAsync([id], ct);
        return NoContent();
    }

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

    /// <summary>M4 tab: current suggestions with reasons and the weighted breakdown for ScoreBreakdown.</summary>
    [HttpGet("{id:int}/recommendations"), ProducesResponseType<List<CustomerRecommendationRow>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<List<CustomerRecommendationRow>>> Recommendations(int id, CancellationToken ct)
    {
        await accounts.CustomerAsync(id, ct); // 404 for unknown or deleted customers.
        return Ok(await recommendations.CustomerRowsAsync(id, ct));
    }
}

// Simple contact rules, mirrored by customerDraftSchema in apps/web/features/customers/schemas.ts.
public sealed record CreateCustomerRequest(
    [Required, StringLength(256), RegularExpression(@"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$", ErrorMessage = "Email không hợp lệ.")] string Email,
    [Required, StringLength(200, MinimumLength = 2)] string FullName,
    [Required, RegularExpression(@"^0\d{9}$", ErrorMessage = "Số điện thoại gồm 10 chữ số, bắt đầu bằng 0.")] string? Phone = null,
    DateOnly? DateOfBirth = null, string? Gender = null,
    [Required, StringLength(500, MinimumLength = 5, ErrorMessage = "Địa chỉ cần 5–500 ký tự.")] string? Address = null, bool ConsentPersonalData = false, int[]? PreferenceIds = null);

/// <summary>No temporary password: the customer sets one from the emailed code.</summary>
public sealed record CustomerCreated(int Id, string Email, Cocoon.Domain.Enums.AccountRole Role, bool MustChangePassword, bool InvitationSent);
public sealed record InvitationSent(bool Sent);
