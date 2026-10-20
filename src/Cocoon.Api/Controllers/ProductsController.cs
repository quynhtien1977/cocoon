using Cocoon.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Cocoon.Api.Controllers;

[Route("api/v1")]
public sealed class ProductsController : ApiStubController
{
    [HttpGet("products/{id:int}"), Authorize(Roles = "Customer,Manager")]
    public IActionResult Get(int id) => NotImplementedYet();

    [HttpGet("products"), Authorize(Policy = "RequireManager")]
    public IActionResult List([FromQuery] ListQuery query, int? categoryId, bool? untagged) => NotImplementedYet();

    [HttpPatch("products/{id:int}/status"), Authorize(Policy = "RequireManager")]
    public IActionResult ChangeStatus(int id, ProductStatusRequest request) => NotImplementedYet();

    [HttpPut("products/{id:int}/preferences"), Authorize(Policy = "RequireManager")]
    public IActionResult SetPreferences(int id, PreferenceIdsRequest request) => NotImplementedYet();

    [HttpGet("products/{id:int}/insights"), Authorize(Policy = "RequireManager")]
    public IActionResult Insights(int id) => NotImplementedYet();
}

[Route("api/v1")]
[Authorize(Policy = "RequireManager")]
public sealed class RecommendationsController : ApiStubController
{
    [HttpGet("recommendation-plans")] public IActionResult ListPlans([FromQuery] ListQuery query) => NotImplementedYet();
    [HttpPost("recommendation-plans")] public IActionResult CreatePlan(PlanUpsertRequest request) => NotImplementedYet();
    [HttpGet("recommendation-plans/{id:int}")] public IActionResult GetPlan(int id) => NotImplementedYet();
    [HttpPut("recommendation-plans/{id:int}")]
    public IActionResult UpdatePlan(int id, PlanUpsertRequest request) => NotImplementedYet();
    [HttpDelete("recommendation-plans/{id:int}")] public IActionResult DeletePlan(int id) => NotImplementedYet();
    [HttpPost("recommendation-plans/{id:int}/activate")] public IActionResult Activate(int id) => NotImplementedYet();
    [HttpPost("recommendation-plans/{id:int}/end")] public IActionResult End(int id) => NotImplementedYet();
    [HttpPost("recommendations/rebuild")] public IActionResult Rebuild() => NotImplementedYet();
}

public sealed record ProductStatusRequest(ProductStatus Status);
public sealed record PlanUpsertRequest(string Name, string? Goal, DateTime StartAt, DateTime EndAt,
    SegmentFilter Segment, int[] ProductIds);
