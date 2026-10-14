using Cocoon.Domain.Enums;

namespace Cocoon.Domain.Entities;

public sealed class SurveyResponse
{
    public int Id { get; set; }
    public int SurveyId { get; set; }
    public int CustomerId { get; set; }
    public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;
}

