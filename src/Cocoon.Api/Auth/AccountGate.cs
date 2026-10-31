using Cocoon.Domain.Entities;
using Cocoon.Domain.Enums;
using Cocoon.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Cocoon.Api.Auth;

/// <summary>Per-request check that a signed token still belongs to a usable account with the same role.</summary>
public interface IAccountGate
{
    Task<bool> IsAllowedAsync(int accountId, string role, CancellationToken cancellationToken = default);
}

public sealed class DbAccountGate(AppDbContext db, IHttpContextAccessor context) : IAccountGate
{
    public async Task<bool> IsAllowedAsync(int accountId, string role, CancellationToken cancellationToken = default)
    {
        if (!Enum.TryParse<AccountRole>(role, out var expected)) return false;
        var account = await db.Set<Account>().Where(a => a.Id == accountId && a.IsActive && a.Role == expected
            && (a.LockoutEnd == null || a.LockoutEnd <= DateTime.UtcNow))
            .Select(a => new { a.MustChangePassword }).SingleOrDefaultAsync(cancellationToken);
        if (account is null) return false;
        if (context.HttpContext is { } http) http.Items[nameof(Account.MustChangePassword)] = account.MustChangePassword;
        return true;
    }
}
