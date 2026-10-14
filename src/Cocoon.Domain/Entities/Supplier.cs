using Cocoon.Domain.Enums;

namespace Cocoon.Domain.Entities;

public sealed class Supplier
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsDeleted { get; set; }
}

