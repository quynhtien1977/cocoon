using Cocoon.Domain.Enums;

namespace Cocoon.Domain.Entities;

public sealed class Survey
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public SurveyPurpose Purpose { get; set; } = SurveyPurpose.Other;
    public SurveyStatus Status { get; set; } = SurveyStatus.Draft;
    public DateTime? OpenAt { get; set; }
    public DateTime? CloseAt { get; set; }
    public int? ProductId { get; set; }
    /// <summary>Optional cover photo in object storage; key and content type are set together.</summary>
    public string? ImageObjectKey { get; set; }
    public string? ImageContentType { get; set; }
    /// <summary>Optional preview video: the 11-character YouTube id only, embedded with youtube-nocookie.com.</summary>
    public string? YoutubeVideoId { get; set; }
    public int CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsDeleted { get; set; }
}

