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

public sealed class DbAccountGate(AppDbContext db) : IAccountGate
{
    public async Task<bool> IsAllowedAsync(int accountId, string role, CancellationToken cancellationToken = default) =>
        Enum.TryParse<AccountRole>(role, out var expected)
        // Soft-deleted accounts are hidden by the query filter, so they fail here too.
        && await db.Set<Account>().AnyAsync(a => a.Id == accountId && a.IsActive && a.Role == expected
            && (a.LockoutEnd == null || a.LockoutEnd <= DateTime.UtcNow), cancellationToken);
}
