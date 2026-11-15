using Cocoon.Application.Storage;
using Cocoon.Application.Surveys;
using Cocoon.Domain.Entities;
using Cocoon.Domain.Enums;
using Cocoon.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Cocoon.Api.Controllers;

/// <summary>
/// Cover photo of a survey (decision 15/11/2026). Like the questions, it changes only while the survey is a Draft. The
/// bytes live in private object storage and are read back through GET survey-images/{id}: any manager, or a customer
/// the survey was sent to. The preview video is a YouTube link on the survey itself (SurveyUpsertRequest.VideoUrl).
/// </summary>
[Route("api/v1")]
public sealed class SurveyMediaController(AppDbContext db, IObjectStorage storage, ILogger<SurveyMediaController> logger) : ApiStubController
{
    /// <summary>AGENTS.md image rule: jpg/png/webp, at most 2 MB, checked by content.</summary>
    public const long MaxBytes = 2 * 1024 * 1024;

    [HttpPost("surveys/{id:int}/image"), Authorize(Policy = "RequireManager")]
    [RequestSizeLimit(MaxBytes + 64 * 1024), RequestFormLimits(MultipartBodyLengthLimit = MaxBytes + 64 * 1024)]
    public async Task<IActionResult> Upload(int id, IFormFile? image, CancellationToken cancellationToken)
    {
        if (image is null || image.Length is <= 0 or > MaxBytes)
            return Fail(StatusCodes.Status400BadRequest, "VALIDATION_ERROR", "Chọn một ảnh lớn hơn 0 và không quá 2 MB.");
        using var data = new MemoryStream((int)image.Length);
        await image.CopyToAsync(data, cancellationToken);
        // The declared type comes from the client; the first bytes decide what the file really is.
        if (FeedbackPhotosController.Sniff(data.GetBuffer().AsSpan(0, (int)data.Length)) is not { } contentType)
            return Fail(StatusCodes.Status400BadRequest, "VALIDATION_ERROR", "Chỉ nhận ảnh JPG, PNG hoặc WebP.");
        data.Position = 0;

        var survey = await db.Set<Survey>().AsNoTracking().SingleOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (survey is null) return NotFound();
        if (survey.Status != SurveyStatus.Draft) return NotDraft();
        var key = $"surveys/{id}/{Guid.NewGuid():N}{Extension(contentType)}";
        await storage.PutAsync(key, data, data.Length, contentType, cancellationToken);
        var previous = survey.ImageObjectKey;
        try
        {
            // Conditional on Draft, so a survey published meanwhile keeps the photo it was published with.
            var updated = await db.Set<Survey>().Where(s => s.Id == id && s.Status == SurveyStatus.Draft)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.ImageObjectKey, key).SetProperty(x => x.ImageContentType, contentType), cancellationToken);
            if (updated != 1)
            {
                await Forget(key);
                return NotDraft();
            }
        }
        catch
        {
            await Forget(key);
            throw;
        }
        if (previous is not null) await Forget(previous);
        return Ok(new SurveyImage(SurveyMedia.ImageUrl(id, key)!));
    }

    [HttpDelete("surveys/{id:int}/image"), Authorize(Policy = "RequireManager")]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        var survey = await db.Set<Survey>().AsNoTracking().SingleOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (survey is null) return NotFound();
        if (survey.Status != SurveyStatus.Draft) return NotDraft();
        if (survey.ImageObjectKey is not { } key) return NoContent();
        var updated = await db.Set<Survey>().Where(s => s.Id == id && s.Status == SurveyStatus.Draft && s.ImageObjectKey == key)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.ImageObjectKey, (string?)null).SetProperty(x => x.ImageContentType, (string?)null), cancellationToken);
        if (updated != 1) return NotDraft();
        await Forget(key);
        return NoContent();
    }

    /// <summary>Any manager; a customer only for a survey sent to them, the same rule as opening it. Others get 404.</summary>
    [HttpGet("survey-images/{id:int}"), Authorize(Roles = "Manager,Customer")]
    public async Task<IActionResult> Get(int id, CancellationToken cancellationToken)
    {
        var me = AccountId;
        var customer = User.IsInRole("Customer");
        // Deleted surveys stay readable for customers who already answered, as their survey history does.
        var image = await db.Set<Survey>().IgnoreQueryFilters().Where(s => s.Id == id && s.ImageObjectKey != null
                && (customer ? s.Status != SurveyStatus.Draft && db.Set<SurveyRecipient>().Any(r => r.SurveyId == s.Id && r.CustomerId == me) : !s.IsDeleted))
            .Select(s => new { s.ImageObjectKey, s.ImageContentType }).SingleOrDefaultAsync(cancellationToken);
        if (image is null) return NotFound();
        using var buffer = new MemoryStream();
        if (!await storage.CopyToAsync(image.ImageObjectKey!, buffer, cancellationToken)) return NotFound();
        Response.Headers.CacheControl = "private, max-age=3600";
        Response.Headers.XContentTypeOptions = "nosniff";
        return File(buffer.ToArray(), image.ImageContentType!);
    }

    private async Task Forget(string key)
    {
        // Nothing references the object any more; a storage failure only leaves an unreachable file.
        try { await storage.DeleteAsync(key, CancellationToken.None); }
        catch (Exception e) { logger.LogWarning(e, "Survey image {Key} is still in storage", key); }
    }

    private static string Extension(string contentType) => contentType switch
    {
        "image/png" => ".png",
        "image/webp" => ".webp",
        _ => ".jpg",
    };

    private ObjectResult NotDraft() =>
        Fail(StatusCodes.Status409Conflict, "SURVEY_NOT_DRAFT", "Chỉ đổi ảnh được khi khảo sát ở trạng thái nháp.");
}

public sealed record SurveyImage(string ImageUrl);
