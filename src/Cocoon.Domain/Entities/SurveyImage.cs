namespace Cocoon.Domain.Entities;

/// <summary>
/// A photo a manager uploaded for a survey's questions (decision 15/11/2026). Bytes live in object storage under
/// ObjectKey; questions point at it through SurveyQuestionMedia. Unreferenced uploads are removed when the draft is saved.
/// </summary>
public sealed class SurveyImage
{
    public int Id { get; set; }
    public int SurveyId { get; set; }
    public string ObjectKey { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
