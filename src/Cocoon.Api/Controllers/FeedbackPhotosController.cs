using Cocoon.Application.Storage;
using Cocoon.Domain.Entities;
using Cocoon.Domain.Enums;
using Cocoon.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Cocoon.Api.Controllers;

/// <summary>
/// Photos attached to a feedback (C4). Bytes go to private object storage; they are read back only through
/// GET feedback-photos/{id}, which applies the same visibility as the feedback itself.
/// </summary>
[Route("api/v1")]
public sealed class FeedbackPhotosController(AppDbContext db, IObjectStorage storage, ILogger<FeedbackPhotosController> logger) : ApiStubController
{
    public const int MaxPhotos = 5;
    public const long MaxBytes = 5 * 1024 * 1024;
    private const long MaxRequestBytes = MaxPhotos * MaxBytes + 1024 * 1024;

    [HttpPost("me/feedback/{id:int}/photos"), Authorize(Policy = "RequireCustomer")]
    [RequestSizeLimit(MaxRequestBytes), RequestFormLimits(MultipartBodyLengthLimit = MaxRequestBytes)]
    public async Task<IActionResult> Upload(int id, [FromForm(Name = "photos")] List<IFormFile> photos, CancellationToken cancellationToken)
    {
        var me = AccountId;
        var status = await db.Set<Feedback>().Where(f => f.Id == id && f.CustomerId == me).Select(f => (FeedbackStatus?)f.Status)
            .SingleOrDefaultAsync(cancellationToken);
        if (status is null) return NotFound();
        if (status == FeedbackStatus.Closed)
            return Fail(StatusCodes.Status409Conflict, "FEEDBACK_CLOSED", "Phản hồi đã đóng, không thêm ảnh được nữa.");
        var existing = await db.Set<FeedbackPhoto>().CountAsync(p => p.FeedbackId == id, cancellationToken);
        if (photos.Count == 0 || existing + photos.Count > MaxPhotos)
            return Fail(StatusCodes.Status400BadRequest, "VALIDATION_ERROR", $"Mỗi phản hồi có tối đa {MaxPhotos} ảnh.");

        // Validate every file before storing any, so a bad file does not leave half the batch behind.
        var accepted = new List<(MemoryStream Data, string ContentType)>();
        foreach (var file in photos)
        {
            if (file.Length is <= 0 or > MaxBytes)
                return Fail(StatusCodes.Status400BadRequest, "VALIDATION_ERROR", "Mỗi ảnh cần lớn hơn 0 và không quá 5 MB.");
            var data = new MemoryStream((int)file.Length);
            await file.CopyToAsync(data, cancellationToken);
            // The declared type comes from the client; the first bytes decide what the file really is.
            if (Sniff(data.GetBuffer().AsSpan(0, (int)data.Length)) is not { } contentType)
                return Fail(StatusCodes.Status400BadRequest, "VALIDATION_ERROR", "Chỉ nhận ảnh JPG, PNG hoặc WebP.");
            data.Position = 0;
            accepted.Add((data, contentType));
        }

        var rows = new List<FeedbackPhoto>();
        try
        {
            foreach (var (data, contentType) in accepted)
            {
                var key = $"feedback/{id}/{Guid.NewGuid():N}{Extension(contentType)}";
                await storage.PutAsync(key, data, data.Length, contentType, cancellationToken);
                rows.Add(new FeedbackPhoto { FeedbackId = id, ObjectKey = key, ContentType = contentType, SizeBytes = data.Length, SortOrder = existing + rows.Count });
            }
            db.AddRange(rows);
            await db.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            // Nothing references these objects; remove them so storage does not fill with orphans.
            foreach (var row in rows)
                try { await storage.DeleteAsync(row.ObjectKey, CancellationToken.None); }
                catch (Exception e) { logger.LogWarning(e, "Orphan feedback photo {Key} was not removed", row.ObjectKey); }
            throw;
        }
        return StatusCode(StatusCodes.Status201Created, await Photos(db, id, cancellationToken));
    }

    /// <summary>The customer who wrote the feedback, any manager, or the staff it is assigned to; anyone else gets 404.</summary>
    [HttpGet("feedback-photos/{id:int}"), Authorize(Roles = "Customer,Manager,Staff")]
    public async Task<IActionResult> Get(int id, CancellationToken cancellationToken)
    {
        var me = AccountId;
        var (customer, staff) = (User.IsInRole("Customer"), User.IsInRole("Staff"));
        var photo = await db.Set<FeedbackPhoto>().Where(p => p.Id == id)
            .Join(db.Set<Feedback>(), p => p.FeedbackId, f => f.Id, (p, f) => new { p.ObjectKey, p.ContentType, p.SizeBytes, f.CustomerId, f.AssignedStaffId })
            .Where(x => customer ? x.CustomerId == me : !staff || x.AssignedStaffId == me)
            .SingleOrDefaultAsync(cancellationToken);
        if (photo is null) return NotFound();
        using var buffer = new MemoryStream((int)photo.SizeBytes);
        if (!await storage.CopyToAsync(photo.ObjectKey, buffer, cancellationToken)) return NotFound();
        Response.Headers.CacheControl = "private, max-age=3600";
        Response.Headers.XContentTypeOptions = "nosniff";
        return File(buffer.ToArray(), photo.ContentType);
    }

    /// <summary>The owner removes a photo they sent, until the feedback is closed. Returns the remaining photos.</summary>
    [HttpDelete("me/feedback/photos/{id:int}"), Authorize(Policy = "RequireCustomer")]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        var me = AccountId;
        var photo = await db.Set<FeedbackPhoto>().Where(p => p.Id == id)
            .Join(db.Set<Feedback>(), p => p.FeedbackId, f => f.Id, (p, f) => new { Photo = p, f.CustomerId, f.Status })
            .Where(x => x.CustomerId == me).SingleOrDefaultAsync(cancellationToken);
        if (photo is null) return NotFound();
        if (photo.Status == FeedbackStatus.Closed)
            return Fail(StatusCodes.Status409Conflict, "FEEDBACK_CLOSED", "Phản hồi đã đóng, không xóa ảnh được nữa.");
        db.Remove(photo.Photo);
        await db.SaveChangesAsync(cancellationToken);
        // The row is gone first, so a storage failure leaves an unreachable object rather than a broken photo link.
        try { await storage.DeleteAsync(photo.Photo.ObjectKey, CancellationToken.None); }
        catch (Exception e) { logger.LogWarning(e, "Deleted feedback photo {Key} is still in storage", photo.Photo.ObjectKey); }
        return Ok(await Photos(db, photo.Photo.FeedbackId, cancellationToken));
    }

    internal static Task<List<FeedbackPhotoItem>> Photos(AppDbContext db, int feedbackId, CancellationToken cancellationToken) =>
        db.Set<FeedbackPhoto>().Where(p => p.FeedbackId == feedbackId).OrderBy(p => p.SortOrder).ThenBy(p => p.Id)
            .Select(p => new FeedbackPhotoItem(p.Id, "/api/v1/feedback-photos/" + p.Id)).ToListAsync(cancellationToken);

    public static string? Sniff(ReadOnlySpan<byte> head) =>
        head is [0xFF, 0xD8, 0xFF, ..] ? "image/jpeg"
        : head is [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, ..] ? "image/png"
        : head.Length >= 12 && head[..4].SequenceEqual("RIFF"u8) && head[8..12].SequenceEqual("WEBP"u8) ? "image/webp"
        : null;

    private static string Extension(string contentType) => contentType switch
    {
        "image/png" => ".png",
        "image/webp" => ".webp",
        _ => ".jpg",
    };
}

public sealed record FeedbackPhotoItem(int Id, string Url);
