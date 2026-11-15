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
/// Photos for survey questions (decision 15/11/2026). A manager uploads a photo to a draft and gets an id, then lists it
/// in the question's media when saving the draft (PUT surveys/{id}). Bytes live in private object storage and are read
/// through GET survey-media/{id}: any manager, or a customer the survey was sent to. Videos are YouTube links on the
/// question itself, so they need no upload.
/// </summary>
[Route("api/v1")]
public sealed class SurveyMediaController(AppDbContext db, IObjectStorage storage, ILogger<SurveyMediaController> logger) : ApiStubController
{
    [HttpPost("surveys/{id:int}/images"), Authorize(Policy = "RequireManager")]
    [RequestSizeLimit(SurveyMedia.MaxImageBytes + 64 * 1024), RequestFormLimits(MultipartBodyLengthLimit = SurveyMedia.MaxImageBytes + 64 * 1024)]
    [ProducesResponseType<SurveyImageUploaded>(StatusCodes.Status201Created)]
    public async Task<IActionResult> Upload(int id, IFormFile? image, CancellationToken cancellationToken)
    {
        if (image is null || image.Length is <= 0 or > SurveyMedia.MaxImageBytes)
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
        if (await db.Set<SurveyImage>().CountAsync(i => i.SurveyId == id, cancellationToken) >= SurveyMedia.MaxImagesPerSurvey)
            return Fail(StatusCodes.Status409Conflict, "TOO_MANY_IMAGES",
                $"Mỗi khảo sát có tối đa {SurveyMedia.MaxImagesPerSurvey} ảnh. Lưu bản nháp để dọn ảnh không dùng rồi thử lại.");

        var key = $"surveys/{id}/{Guid.NewGuid():N}{Extension(contentType)}";
        await storage.PutAsync(key, data, data.Length, contentType, cancellationToken);
        var row = new SurveyImage { SurveyId = id, ObjectKey = key, ContentType = contentType, SizeBytes = data.Length };
        try
        {
            db.Add(row);
            await db.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            try { await storage.DeleteAsync(key, CancellationToken.None); }
            catch (Exception e) { logger.LogWarning(e, "Orphan survey image {Key} was not removed", key); }
            throw;
        }
        return StatusCode(StatusCodes.Status201Created, new SurveyImageUploaded(row.Id, SurveyMedia.ImageUrl(row.Id)));
    }

    /// <summary>Any manager while the survey is not deleted; a customer only for a survey sent to them, as when opening it. Others get 404.</summary>
    [HttpGet("survey-media/{id:int}"), Authorize(Roles = "Manager,Customer")]
    public async Task<IActionResult> Get(int id, CancellationToken cancellationToken)
    {
        var me = AccountId;
        var customer = User.IsInRole("Customer");
        // Deleted surveys stay readable for customers who were sent them, as their survey history does.
        var image = await (from i in db.Set<SurveyImage>()
                           join s in db.Set<Survey>().IgnoreQueryFilters() on i.SurveyId equals s.Id
                           where i.Id == id && (customer
                               ? s.Status != SurveyStatus.Draft && db.Set<SurveyRecipient>().Any(r => r.SurveyId == s.Id && r.CustomerId == me)
                               : !s.IsDeleted)
                           select new { i.ObjectKey, i.ContentType, i.SizeBytes }).SingleOrDefaultAsync(cancellationToken);
        if (image is null) return NotFound();
        using var buffer = new MemoryStream((int)image.SizeBytes);
        if (!await storage.CopyToAsync(image.ObjectKey, buffer, cancellationToken)) return NotFound();
        // Ids are never reused and an upload never changes, so the browser may keep it.
        Response.Headers.CacheControl = "private, max-age=86400";
        Response.Headers.XContentTypeOptions = "nosniff";
        return File(buffer.ToArray(), image.ContentType);
    }

    private static string Extension(string contentType) => contentType switch
    {
        "image/png" => ".png",
        "image/webp" => ".webp",
        _ => ".jpg",
    };

    private ObjectResult NotDraft() =>
        Fail(StatusCodes.Status409Conflict, "SURVEY_NOT_DRAFT", "Chỉ thêm ảnh được khi khảo sát ở trạng thái nháp.");
}

public sealed record SurveyImageUploaded(int Id, string Url);
