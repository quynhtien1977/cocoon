using Cocoon.Domain.Enums;

namespace Cocoon.Domain.Entities;

public sealed class SurveyAnswer
{
    public int Id { get; set; }
    public int ResponseId { get; set; }
    public int QuestionId { get; set; }
    public int? OptionId { get; set; }
    public decimal? NumericValue { get; set; }
    public string? TextValue { get; set; }
}

