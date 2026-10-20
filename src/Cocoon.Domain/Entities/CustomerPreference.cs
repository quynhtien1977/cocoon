using Cocoon.Domain.Enums;

namespace Cocoon.Domain.Entities;

public sealed class CustomerPreference
{
    public int CustomerId { get; set; }
    public int PreferenceId { get; set; }
    public PreferenceSource Source { get; set; } = PreferenceSource.Declared;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

