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

[Route("api/v1/admin/accounts")]
[Authorize(Policy = "RequireAdmin")]
public sealed class AdminAccountsController : ApiStubController
{
    [HttpGet] public IActionResult List([FromQuery] ListQuery query, AccountRole? role) => NotImplementedYet();
    [HttpPost] public IActionResult Create(CreateAccountRequest request) => NotImplementedYet();
    [HttpPatch("{id:int}/role")] public IActionResult ChangeRole(int id, ChangeRoleRequest request) => NotImplementedYet();
    [HttpPatch("{id:int}/status")] public IActionResult ChangeStatus(int id, ChangeStatusRequest request) => NotImplementedYet();
    [HttpDelete("{id:int}")] public IActionResult Delete(int id) => NotImplementedYet();
}

public sealed record CreateAccountRequest(string Email, string FullName, AccountRole Role);
public sealed record ChangeRoleRequest(AccountRole Role);
public sealed record ChangeStatusRequest(bool IsActive);
