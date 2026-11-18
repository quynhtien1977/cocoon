namespace Cocoon.Domain.Entities;

/// <summary>A photo attached to a feedback. The bytes live in object storage under ObjectKey.</summary>
public sealed class FeedbackPhoto
{
    public int Id { get; set; }
    public int FeedbackId { get; set; }
    public string ObjectKey { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
