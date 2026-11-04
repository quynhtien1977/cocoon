using Cocoon.Application.Reports;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Cocoon.Api.Controllers;

[Route("api/v1/reports")]
[Authorize(Policy = "RequireManager")]
[ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
[ProducesResponseType<ProblemDetails>(StatusCodes.Status401Unauthorized)]
[ProducesResponseType<ProblemDetails>(StatusCodes.Status403Forbidden)]
public sealed class ReportsController(IReportService reports) : ApiStubController
{
    [HttpGet("overview"), ProducesResponseType<ReportOverview>(StatusCodes.Status200OK)]
    public async Task<ActionResult<ReportOverview>> Overview([FromQuery] ReportPeriod period, CancellationToken ct) =>
        Ok(await reports.OverviewAsync(period, ct));

    [HttpGet("customers/age"), ProducesResponseType<CustomerAgeReport>(StatusCodes.Status200OK)]
    public async Task<ActionResult<CustomerAgeReport>> CustomersByAge(CancellationToken ct) =>
        Ok(await reports.CustomersByAgeAsync(ct));

    [HttpGet("customers/gender"), ProducesResponseType<CustomerGenderReport>(StatusCodes.Status200OK)]
    public async Task<ActionResult<CustomerGenderReport>> CustomersByGender(CancellationToken ct) =>
        Ok(await reports.CustomersByGenderAsync(ct));

    [HttpGet("customers/preferences"), ProducesResponseType<CustomerPreferenceReport>(StatusCodes.Status200OK)]
    public async Task<ActionResult<CustomerPreferenceReport>> CustomersByPreference(CancellationToken ct) =>
        Ok(await reports.CustomersByPreferenceAsync(ct));

    [HttpGet("feedback/ratings"), ProducesResponseType<FeedbackRatingReport>(StatusCodes.Status200OK)]
    public async Task<ActionResult<FeedbackRatingReport>> FeedbackRatings([FromQuery] ReportPeriod period, CancellationToken ct) =>
        Ok(await reports.FeedbackRatingsAsync(period, ct));

    [HttpGet("purchases/categories"), ProducesResponseType<CategoryPurchaseReport>(StatusCodes.Status200OK)]
    public async Task<ActionResult<CategoryPurchaseReport>> PurchasesByCategory([FromQuery] ReportPeriod period, CancellationToken ct) =>
        Ok(await reports.PurchasesByCategoryAsync(period, ct));

    [HttpGet("recommendations")] public IActionResult Recommendations() => NotImplementedYet();
}
