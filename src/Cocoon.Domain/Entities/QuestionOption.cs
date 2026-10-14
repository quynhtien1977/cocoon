using Cocoon.Domain.Enums;

namespace Cocoon.Domain.Entities;

public sealed class QuestionOption
{
    public int Id { get; set; }
    public int QuestionId { get; set; }
    public string Text { get; set; } = string.Empty;
    public int SortOrder { get; set; }
}

