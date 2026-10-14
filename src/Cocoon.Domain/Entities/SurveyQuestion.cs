using Cocoon.Domain.Enums;

namespace Cocoon.Domain.Entities;

public sealed class SurveyQuestion
{
    public int Id { get; set; }
    public int SurveyId { get; set; }
    public string Text { get; set; } = string.Empty;
    public QuestionType Type { get; set; }
    public bool IsRequired { get; set; }
    public int SortOrder { get; set; }
}

