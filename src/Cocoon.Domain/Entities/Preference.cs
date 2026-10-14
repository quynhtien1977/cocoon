using Cocoon.Domain.Enums;

namespace Cocoon.Domain.Entities;

public sealed class Preference
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}

