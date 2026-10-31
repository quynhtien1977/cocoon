using Cocoon.Domain.Entities;
using Cocoon.Domain.Enums;

namespace Cocoon.Application.Accounts;

public interface IAccountPasswords
{
    string Hash(Account account, string password);
    bool Verify(Account account, string password);
}

public sealed class AccountOperationException(int status, string code, string detail, string? field = null) : Exception(detail)
{
    public int Status { get; } = status;
    public string Code { get; } = code;
    public string? Field { get; } = field;
}

public sealed record AccountCreated(int Id, string Email, AccountRole Role, string TemporaryPassword, bool MustChangePassword);
public sealed record AccountRow(int Id, string Email, string FullName, string? Phone, AccountRole Role, string Status, DateTime? LastLoginAt);
public sealed record AccountPage(IReadOnlyList<AccountRow> Items, int TotalCount, int Page, int PageSize);
public sealed record AccountQuery(int Page = 1, int PageSize = 20, string? Search = null, AccountRole? Role = null,
    string? Status = null, string? Sort = null, string? Order = null);
