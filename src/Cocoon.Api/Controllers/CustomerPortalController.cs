using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Cocoon.Api.Controllers;

/// <summary>Customer self-service. Customer id always comes from the token, never from the URL.</summary>
[Route("api/v1/me")]
[Authorize(Policy = "RequireCustomer")]
public sealed class CustomerPortalController : ApiStubController
{
    [HttpGet("home")] public IActionResult Home() => NotImplementedYet();

    [HttpGet("orders")] public IActionResult Orders([FromQuery] ListQuery query) => NotImplementedYet();
    [HttpGet("orders/{id:int}")] public IActionResult Order(int id) => NotImplementedYet();
    [HttpGet("reviewable-items")] public IActionResult ReviewableItems() => NotImplementedYet();

    [HttpGet("feedback")] public IActionResult Feedback([FromQuery] ListQuery query) => NotImplementedYet();
    [HttpGet("feedback/{id:int}")] public IActionResult FeedbackDetail(int id) => NotImplementedYet();
    [HttpPost("feedback")] public IActionResult CreateFeedback(CreateFeedbackRequest request) => NotImplementedYet();

    [HttpGet("surveys")] public IActionResult Surveys([FromQuery] ListQuery query) => NotImplementedYet();
    [HttpGet("surveys/{id:int}")] public IActionResult Survey(int id) => NotImplementedYet();
    [HttpPost("surveys/{id:int}/responses")]
    public IActionResult SubmitSurvey(int id, SubmitSurveyRequest request) => NotImplementedYet();

    [HttpGet("recommendations")] public IActionResult Recommendations() => NotImplementedYet();
    [HttpPost("recommendations/{id:int}/click")] public IActionResult Click(int id) => NotImplementedYet();
    [HttpPost("recommendations/{id:int}/dismiss")] public IActionResult Dismiss(int id) => NotImplementedYet();

    [HttpGet("notifications")] public IActionResult Notifications() => NotImplementedYet();
    [HttpPost("notifications/{id:int}/read")] public IActionResult MarkRead(int id) => NotImplementedYet();
}

public sealed record CreateFeedbackRequest(int OrderItemId, int Rating, string Content);
public sealed record SubmitSurveyRequest(SurveyAnswerInput[] Answers);
public sealed record SurveyAnswerInput(int QuestionId, int[]? OptionIds, decimal? NumericValue, string? TextValue);
