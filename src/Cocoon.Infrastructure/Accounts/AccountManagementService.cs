using System.ComponentModel.DataAnnotations;
using System.Data;
using System.Security.Cryptography;
using Cocoon.Application.Accounts;
using Cocoon.Domain;
using Cocoon.Domain.Entities;
using Cocoon.Domain.Enums;
using Cocoon.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Cocoon.Infrastructure.Accounts;

public sealed class AccountManagementService(AppDbContext db, IAccountPasswords passwords)
{
    public async Task<AccountPage> ListAsync(AccountQuery query, CancellationToken ct)
    {
        if (query.Role is not null && !Enum.IsDefined(query.Role.Value)) Invalid("role", "Vai trò không hợp lệ.");
        if (query.Status is not (null or "Active" or "Locked")) Invalid("status", "Trạng thái không hợp lệ.");
        if (query.Order is not (null or "asc" or "desc")) Invalid("order", "Thứ tự không hợp lệ.");
        if (query.Sort is not (null or "fullName" or "email" or "role" or "status" or "lastLoginAt" or "createdAt"))
            Invalid("sort", "Cột sắp xếp không hợp lệ.");
        var rows = from a in db.Set<Account>().AsNoTracking()
                   join c in db.Set<CustomerProfile>() on a.Id equals c.AccountId into customers
                   from c in customers.DefaultIfEmpty()
                   join s in db.Set<StaffProfile>() on a.Id equals s.AccountId into staff
                   from s in staff.DefaultIfEmpty()
                   select new { A = a, Name = a.Role == AccountRole.Customer ? c.FullName : s.FullName,
                       Normalized = c.FullNameNormalized, Phone = a.Role == AccountRole.Customer ? c.Phone : s.Phone };
        if (query.Role is not null) rows = rows.Where(x => x.A.Role == query.Role);
        if (query.Status is not null) rows = rows.Where(x => x.A.IsActive == (query.Status == "Active"));
        var term = query.Search?.Trim().ToLowerInvariant();
        var normalized = SearchText.Normalize(term ?? "");
        if (!string.IsNullOrEmpty(term)) rows = rows.Where(x => x.Name.ToLower().Contains(term)
            || x.Normalized.Contains(normalized) || x.A.Email.ToLower().Contains(term) || (x.Phone != null && x.Phone.Contains(term)));
        var descending = query.Order == "desc";
        var result = query.Sort switch
        {
            "email" => descending ? rows.OrderByDescending(x => x.A.Email) : rows.OrderBy(x => x.A.Email),
            "role" => descending ? rows.OrderByDescending(x => x.A.Role) : rows.OrderBy(x => x.A.Role),
            "status" => descending ? rows.OrderBy(x => x.A.IsActive) : rows.OrderByDescending(x => x.A.IsActive),
            "lastLoginAt" => descending ? rows.OrderByDescending(x => x.A.LastLoginAt) : rows.OrderBy(x => x.A.LastLoginAt),
            "createdAt" => descending ? rows.OrderByDescending(x => x.A.CreatedAt) : rows.OrderBy(x => x.A.CreatedAt),
            _ => descending ? rows.OrderByDescending(x => x.Name) : rows.OrderBy(x => x.Name)
        };
        var (page, size) = (Math.Max(1, query.Page), Math.Clamp(query.PageSize, 1, 100));
        var total = await rows.CountAsync(ct);
        if ((long)(page - 1) * size > int.MaxValue) return new([], total, page, size);
        var items = await result.ThenBy(x => x.A.Id).Skip((page - 1) * size).Take(size)
            .Select(x => new AccountRow(x.A.Id, x.A.Email, x.Name ?? "", x.Phone, x.A.Role,
                x.A.IsActive ? "Active" : "Locked", x.A.LastLoginAt)).ToListAsync(ct);
        return new(items, total, page, size);
    }

    public Task<AccountCreated> CreateAsync(int actor, string email, string fullName, AccountRole role, CancellationToken ct) =>
        Write(async () =>
        {
            email = email.Trim().ToLowerInvariant();
            fullName = fullName.Trim();
            if (email.Length > 256 || !new EmailAddressAttribute().IsValid(email)) Invalid("email", "Email không hợp lệ.");
            if (fullName.Length is < 2 or > 200) Invalid("fullName", "Họ tên cần từ 2 đến 200 ký tự.");
            if (!Enum.IsDefined(role)) Invalid("role", "Vai trò không hợp lệ.");
            if (await db.Set<Account>().IgnoreQueryFilters().AnyAsync(a => a.Email.ToLower() == email, ct))
                throw new AccountOperationException(409, "EMAIL_TAKEN", "Email này đã được sử dụng.", "email");
            var temporary = "Coc!" + Convert.ToHexString(RandomNumberGenerator.GetBytes(16)) + "9a";
            var account = new Account { Email = email, Role = role, MustChangePassword = true };
            account.PasswordHash = passwords.Hash(account, temporary);
            if (role == AccountRole.Customer)
                db.Add(new CustomerProfile { Account = account, FullName = fullName, FullNameNormalized = SearchText.Normalize(fullName) });
            else db.Add(new StaffProfile { Account = account, FullName = fullName, Position = role.ToString() });
            await db.SaveChangesAsync(ct);
            Audit(actor, account.Id, "AccountCreated");
            return new AccountCreated(account.Id, email, role, temporary, true);
        }, ct);

    public Task<bool> ChangeRoleAsync(int actor, int id, AccountRole role, CancellationToken ct) => Write(async () =>
    {
        if (!Enum.IsDefined(role)) Invalid("role", "Vai trò không hợp lệ.");
        var account = await Find(id, ct);
        if (account.Role == role) return true;
        await KeepAdmin(account, role == AccountRole.Admin && account.IsActive, ct);
        var customer = await db.Set<CustomerProfile>().IgnoreQueryFilters().SingleOrDefaultAsync(p => p.AccountId == id, ct);
        var staff = await db.Set<StaffProfile>().IgnoreQueryFilters().SingleOrDefaultAsync(p => p.AccountId == id, ct);
        if (role == AccountRole.Customer && customer is null)
        {
            var name = staff?.FullName ?? "";
            db.Add(new CustomerProfile { AccountId = id, FullName = name, FullNameNormalized = SearchText.Normalize(name), Phone = staff?.Phone });
        }
        if (role != AccountRole.Customer && staff is null)
            db.Add(new StaffProfile { AccountId = id, FullName = customer?.FullName ?? "", Phone = customer?.Phone, Position = role.ToString() });
        account.Role = role;
        await Revoke(id, ct);
        Audit(actor, id, "AccountRoleChanged");
        return true;
    }, ct);

    public Task<bool> ChangeStatusAsync(int actor, int id, bool active, CancellationToken ct) => Write(async () =>
    {
        if (actor == id && !active) throw new AccountOperationException(409, "SELF_MODIFICATION_FORBIDDEN", "Không thể tự khóa tài khoản.");
        var account = await Find(id, ct);
        if (account.IsActive == active) return true;
        await KeepAdmin(account, active && account.Role == AccountRole.Admin, ct);
        account.IsActive = active;
        if (active) { account.LockoutEnd = null; account.FailedLoginCount = 0; }
        await Revoke(id, ct);
        Audit(actor, id, active ? "AccountUnlocked" : "AccountLocked");
        return true;
    }, ct);

    public Task<bool> DeleteAsync(int actor, int id, CancellationToken ct) => Write(async () =>
    {
        if (actor == id) throw new AccountOperationException(409, "SELF_MODIFICATION_FORBIDDEN", "Không thể tự xóa tài khoản.");
        var account = await Find(id, ct);
        await KeepAdmin(account, false, ct);
        account.IsDeleted = true;
        await Revoke(id, ct);
        Audit(actor, id, "AccountDeleted");
        return true;
    }, ct);

    public Task<bool> ChangePasswordAsync(int actor, string current, string next, CancellationToken ct) => Write(async () =>
    {
        if (next.Length is < 8 or > 128 || !next.Any(char.IsLetter) || !next.Any(char.IsDigit))
            Invalid("newPassword", "Mật khẩu cần 8–128 ký tự, có chữ và số.");
        var account = await Find(actor, ct);
        if (!passwords.Verify(account, current)) throw new AccountOperationException(400, "INVALID_CURRENT_PASSWORD", "Mật khẩu hiện tại không đúng.", "currentPassword");
        if (current == next) Invalid("newPassword", "Mật khẩu mới phải khác mật khẩu hiện tại.");
        account.PasswordHash = passwords.Hash(account, next);
        account.MustChangePassword = false;
        await Revoke(actor, ct);
        Audit(actor, actor, "PasswordChanged");
        return true;
    }, ct);

    private async Task<Account> Find(int id, CancellationToken ct) =>
        await db.Set<Account>().SingleOrDefaultAsync(a => a.Id == id, ct)
        ?? throw new AccountOperationException(404, "NOT_FOUND", "Không tìm thấy tài khoản.");

    private async Task KeepAdmin(Account account, bool remainsActiveAdmin, CancellationToken ct)
    {
        if (account.Role == AccountRole.Admin && account.IsActive && !remainsActiveAdmin
            && await db.Set<Account>().CountAsync(a => a.Role == AccountRole.Admin && a.IsActive, ct) <= 1)
            throw new AccountOperationException(409, "LAST_ADMIN", "Phải giữ ít nhất một Admin đang hoạt động.");
    }

    private Task<int> Revoke(int id, CancellationToken ct) => db.Set<RefreshToken>()
        .Where(t => t.AccountId == id && t.RevokedAt == null)
        .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, DateTime.UtcNow), ct);

    private void Audit(int actor, int id, string action) => db.Add(new ActivityLog
        { AccountId = actor, EntityId = id, EntityType = "Account", Action = action });

    private async Task<T> Write<T>(Func<Task<T>> action, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        try
        {
            var value = await action();
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return value;
        }
        catch (Exception e) when (AsPostgres(e)?.SqlState == PostgresErrorCodes.UniqueViolation)
        { throw new AccountOperationException(409, "EMAIL_TAKEN", "Email này đã được sử dụng.", "email"); }
        catch (Exception e) when (e is DbUpdateConcurrencyException || AsPostgres(e)?.SqlState is PostgresErrorCodes.SerializationFailure or PostgresErrorCodes.DeadlockDetected)
        { throw new AccountOperationException(409, "ACCOUNT_CONFLICT", "Tài khoản vừa thay đổi. Hãy tải lại và thử lại."); }
    }

    private static PostgresException? AsPostgres(Exception e)
    {
        for (var cur = e; cur != null; cur = cur.InnerException)
            if (cur is PostgresException pg) return pg;
        return null;
    }

    private static void Invalid(string field, string detail) => throw new AccountOperationException(400, "VALIDATION_ERROR", detail, field);
}
