using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Cocoon.Api.Controllers;

[Route("api/v1")]
public sealed class FeedbackController : ApiStubController
{
    [HttpGet("feedback"), Authorize(Policy = "RequireManager")]
    public IActionResult List([FromQuery] ListQuery query, int? rating, int? productId, int? categoryId) => NotImplementedYet();

    [HttpGet("feedback/{id:int}"), Authorize(Roles = "Manager,Staff")]
    public IActionResult Get(int id) => NotImplementedYet();

    [HttpPost("feedback/{id:int}/accept"), Authorize(Policy = "RequireManager")]
    public IActionResult Accept(int id) => NotImplementedYet();

    [HttpPost("feedback/{id:int}/assign"), Authorize(Policy = "RequireManager")]
    public IActionResult Assign(int id, AssignFeedbackRequest request) => NotImplementedYet();

    [HttpPost("feedback/{id:int}/close"), Authorize(Policy = "RequireManager")]
    public IActionResult Close(int id) => NotImplementedYet();

    [HttpPost("feedback/{id:int}/replies"), Authorize(Roles = "Manager,Staff")]
    public IActionResult Reply(int id, ReplyFeedbackRequest request) => NotImplementedYet();

    [HttpGet("staff/feedback"), Authorize(Policy = "RequireStaff")]
    public IActionResult AssignedToMe([FromQuery] ListQuery query) => NotImplementedYet();
}

public sealed record AssignFeedbackRequest(int StaffId);
public sealed record ReplyFeedbackRequest(string Content);
