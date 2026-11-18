using Cocoon.Domain.Enums;

namespace Cocoon.Domain.Entities;

/// <summary>
/// Optional photo or YouTube video shown with a question, in order (decision 15/11/2026). A question may have none
/// (text-only surveys stay valid) or several, e.g. four product photos with text answers. Image rows point at a
/// SurveyImage; Video rows keep only the 11-character YouTube id.
/// </summary>
public sealed class SurveyQuestionMedia
{
    public int Id { get; set; }
    public int QuestionId { get; set; }
    public int SortOrder { get; set; }
    public SurveyMediaKind Kind { get; set; }
    public int? ImageId { get; set; }
    public string? YoutubeVideoId { get; set; }
}
