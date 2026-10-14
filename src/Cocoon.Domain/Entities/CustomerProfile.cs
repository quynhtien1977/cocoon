using Cocoon.Domain.Enums;

namespace Cocoon.Domain.Entities;

public sealed class CustomerProfile
{
    public int AccountId { get; set; }
    public Account Account { get; set; } = null!;
    public string FullName { get; set; } = string.Empty;
    public string FullNameNormalized { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public DateOnly? DateOfBirth { get; set; }
    public string? Gender { get; set; }
    public string? Address { get; set; }
    public bool ConsentPersonalData { get; set; }
}

