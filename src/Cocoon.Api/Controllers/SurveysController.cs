using Cocoon.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Cocoon.Api.Controllers;

[Route("api/v1")]
[Authorize(Policy = "RequireManager")]
public sealed class SurveysController : ApiStubController
{
    [HttpGet("surveys")] public IActionResult List([FromQuery] ListQuery query) => NotImplementedYet();
    [HttpPost("surveys")] public IActionResult Create(SurveyUpsertRequest request) => NotImplementedYet();
    [HttpGet("surveys/{id:int}")] public IActionResult Get(int id) => NotImplementedYet();
    [HttpPut("surveys/{id:int}")] public IActionResult Update(int id, SurveyUpsertRequest request) => NotImplementedYet();
    [HttpDelete("surveys/{id:int}")] public IActionResult Delete(int id) => NotImplementedYet();
    [HttpPost("surveys/{id:int}/publish")] public IActionResult Publish(int id) => NotImplementedYet();
    [HttpPost("surveys/{id:int}/close")] public IActionResult Close(int id) => NotImplementedYet();
    [HttpPost("surveys/{id:int}/recipients")]
    public IActionResult AddRecipients(int id, RecipientsRequest request) => NotImplementedYet();
    [HttpGet("surveys/{id:int}/results")] public IActionResult Results(int id) => NotImplementedYet();
    [HttpPost("segments/preview")] public IActionResult PreviewSegment(SegmentFilter filter) => NotImplementedYet();
}

public sealed record SurveyUpsertRequest(string Title, string? Description, SurveyPurpose Purpose, int? ProductId,
    DateTime? OpenAt, DateTime? CloseAt, QuestionInput[] Questions);
public sealed record QuestionInput(string Text, QuestionType Type, bool IsRequired, OptionInput[] Options);
public sealed record OptionInput(string Text, int? PreferenceId);
public sealed record RecipientsRequest(SegmentFilter? Segment, int[]? CustomerIds);

/// <summary>Shared by survey recipients, segment preview and recommendation plans (spec 6.3).</summary>
public sealed record SegmentFilter(int? AgeMin, int? AgeMax, string[]? Genders, int[]? PreferenceIds,
    int[]? PurchasedCategoryIds, int? LastPurchaseWithinDays, int[]? ExcludeLowRatedCategoryIds);
