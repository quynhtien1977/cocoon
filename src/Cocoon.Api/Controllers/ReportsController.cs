using Cocoon.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Cocoon.Api.Controllers;

[Route("api/v1/reports")]
[Authorize(Policy = "RequireManager")]
public sealed class ReportsController : ApiStubController
{
    [HttpGet("overview")] public IActionResult Overview() => NotImplementedYet();
    [HttpGet("customers/age")] public IActionResult CustomersByAge() => NotImplementedYet();
    [HttpGet("customers/gender")] public IActionResult CustomersByGender() => NotImplementedYet();
    [HttpGet("customers/preferences")] public IActionResult CustomersByPreference() => NotImplementedYet();
    [HttpGet("feedback/ratings")] public IActionResult FeedbackRatings() => NotImplementedYet();
    [HttpGet("purchases/categories")] public IActionResult PurchasesByCategory() => NotImplementedYet();
    [HttpGet("recommendations")] public IActionResult Recommendations() => NotImplementedYet();
}
