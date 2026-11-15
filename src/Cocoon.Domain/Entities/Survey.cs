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
    public int CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsDeleted { get; set; }
}

