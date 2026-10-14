using Cocoon.Domain.Enums;

namespace Cocoon.Domain.Entities;

public sealed class StaffProfile
{
    public int AccountId { get; set; }
    public Account Account { get; set; } = null!;
    public string FullName { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Position { get; set; }
}

