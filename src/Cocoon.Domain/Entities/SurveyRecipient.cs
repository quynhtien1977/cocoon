using Cocoon.Domain.Enums;

namespace Cocoon.Domain.Entities;

public sealed class SurveyRecipient
{
    public int Id { get; set; }
    public int SurveyId { get; set; }
    public int CustomerId { get; set; }
    public DateTime SentAt { get; set; } = DateTime.UtcNow;
    public RecipientStatus Status { get; set; } = RecipientStatus.NotDone;
    public DateTime? CompletedAt { get; set; }
}

