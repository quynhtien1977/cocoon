using System.ComponentModel.DataAnnotations;
using Cocoon.Api.Auth;
using Cocoon.Domain;
using Cocoon.Domain.Entities;
using Cocoon.Domain.Enums;
using Cocoon.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Cocoon.Api.Controllers;

[Route("api/v1/auth")]
[AllowAnonymous]
public sealed class AuthController(AppDbContext db, TokenService tokens, IPasswordHasher<Account> hasher) : ApiStubController
{
    private const int MaxFailedLogins = 5;
    private static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(15);

    [HttpPost("register")]
    [ProducesResponseType<AuthUser>(StatusCodes.Status201Created)]
    public async Task<IActionResult> Register(RegisterRequest request, CancellationToken cancellationToken)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        if (await db.Set<Account>().IgnoreQueryFilters().AnyAsync(a => a.Email == email, cancellationToken))
            return EmailTaken();
        var preferenceIds = request.PreferenceIds.Distinct().ToArray();
        if (!await PreferencesExist(db, preferenceIds, cancellationToken))
            return Fail(StatusCodes.Status400BadRequest, "VALIDATION_ERROR", "Có sở thích không còn tồn tại. Hãy tải lại trang.");

        var account = new Account { Email = email, Role = AccountRole.Customer };
        account.PasswordHash = hasher.HashPassword(account, request.Password);
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        db.Add(new CustomerProfile
        {
            Account = account, FullName = request.FullName.Trim(), FullNameNormalized = SearchText.Normalize(request.FullName),
            Phone = request.Phone, DateOfBirth = request.DateOfBirth, Gender = request.Gender,
        });
        try { await db.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return EmailTaken(); // Lost a race with a concurrent registration of the same email.
        }
        db.AddRange(preferenceIds.Select(id => new CustomerPreference { CustomerId = account.Id, PreferenceId = id }));
        account.LastLoginAt = DateTime.UtcNow;
        tokens.SignIn(Response, account);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return StatusCode(StatusCodes.Status201Created, new AuthUser(account.Id, account.Email, account.Role, request.FullName.Trim()));
    }

    [HttpPost("login")]
    [ProducesResponseType<AuthUser>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Login(LoginRequest request, CancellationToken cancellationToken)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var account = await db.Set<Account>().SingleOrDefaultAsync(a => a.Email == email, cancellationToken);
        if (account is null) return InvalidCredentials();
        if (account.LockoutEnd > DateTime.UtcNow)
            return Fail(StatusCodes.Status403Forbidden, "ACCOUNT_LOCKED", "Tài khoản tạm khóa do đăng nhập sai nhiều lần. Hãy thử lại sau 15 phút.");
        if (!account.IsActive)
            return Fail(StatusCodes.Status403Forbidden, "ACCOUNT_DISABLED", "Tài khoản đã bị khóa. Hãy liên hệ Cocoon để được hỗ trợ.");

        var result = hasher.VerifyHashedPassword(account, account.PasswordHash, request.Password);
        if (result == PasswordVerificationResult.Failed)
        {
            if (++account.FailedLoginCount >= MaxFailedLogins)
                (account.FailedLoginCount, account.LockoutEnd) = (0, DateTime.UtcNow + LockoutDuration);
            await db.SaveChangesAsync(cancellationToken);
            return InvalidCredentials();
        }
        if (result == PasswordVerificationResult.SuccessRehashNeeded)
            account.PasswordHash = hasher.HashPassword(account, request.Password);
        (account.FailedLoginCount, account.LockoutEnd, account.LastLoginAt) = (0, null, DateTime.UtcNow);
        tokens.SignIn(Response, account);
        await db.SaveChangesAsync(cancellationToken);
        return Ok(new AuthUser(account.Id, account.Email, account.Role, await FullName(db, account, cancellationToken), account.MustChangePassword));
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh(CancellationToken cancellationToken)
    {
        var token = await tokens.FindActiveAsync(Request.Cookies[TokenService.RefreshCookie], cancellationToken);
        var account = token is null ? null
            : await db.Set<Account>().SingleOrDefaultAsync(a => a.Id == token.AccountId && a.IsActive
                && (a.LockoutEnd == null || a.LockoutEnd <= DateTime.UtcNow), cancellationToken);
        if (token is null || account is null)
        {
            TokenService.SignOut(Response);
            return Fail(StatusCodes.Status401Unauthorized, "UNAUTHENTICATED", "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.");
        }
        token.RevokedAt = DateTime.UtcNow;
        tokens.SignIn(Response, account);
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout(CancellationToken cancellationToken)
    {
        var token = await tokens.FindActiveAsync(Request.Cookies[TokenService.RefreshCookie], cancellationToken);
        if (token is not null)
        {
            token.RevokedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(cancellationToken);
        }
        TokenService.SignOut(Response);
        return NoContent();
    }

    private ObjectResult InvalidCredentials() =>
        Fail(StatusCodes.Status401Unauthorized, "INVALID_CREDENTIALS", "Email hoặc mật khẩu không đúng.");

    private ObjectResult EmailTaken() =>
        Fail(StatusCodes.Status409Conflict, "EMAIL_TAKEN", "Email này đã được dùng. Hãy đăng nhập hoặc dùng email khác.");

    internal static async Task<string> FullName(AppDbContext db, Account account, CancellationToken cancellationToken) =>
        account.Role == AccountRole.Customer
            ? await db.Set<CustomerProfile>().Where(p => p.AccountId == account.Id).Select(p => p.FullName).SingleOrDefaultAsync(cancellationToken) ?? ""
            : await db.Set<StaffProfile>().Where(p => p.AccountId == account.Id).Select(p => p.FullName).SingleOrDefaultAsync(cancellationToken) ?? "";

    internal static async Task<bool> PreferencesExist(AppDbContext db, int[] ids, CancellationToken cancellationToken) =>
        ids.Length == 0 || await db.Set<Preference>().CountAsync(p => ids.Contains(p.Id) && p.IsActive, cancellationToken) == ids.Length;
}

[Route("api/v1")]
public sealed class ProfileController(AppDbContext db) : ApiStubController
{
    [HttpGet("me")]
    [ProducesResponseType<MeResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMe(CancellationToken cancellationToken)
    {
        var account = await db.Set<Account>().SingleAsync(a => a.Id == AccountId, cancellationToken);
        if (account.Role == AccountRole.Customer)
        {
            var p = await db.Set<CustomerProfile>().SingleAsync(x => x.AccountId == account.Id, cancellationToken);
            return Ok(new MeResponse(account.Id, account.Email, account.Role, p.FullName, p.Phone, p.DateOfBirth, p.Gender, p.Address, p.ConsentPersonalData, account.MustChangePassword));
        }
        var s = await db.Set<StaffProfile>().SingleOrDefaultAsync(x => x.AccountId == account.Id, cancellationToken);
        return Ok(new MeResponse(account.Id, account.Email, account.Role, s?.FullName ?? "", s?.Phone, null, null, null, false, account.MustChangePassword));
    }

    [HttpPut("me")]
    public async Task<IActionResult> UpdateMe(UpdateProfileRequest request, CancellationToken cancellationToken)
    {
        var name = request.FullName.Trim();
        var customer = User.IsInRole("Customer")
            ? await db.Set<CustomerProfile>().SingleOrDefaultAsync(x => x.AccountId == AccountId, cancellationToken) : null;
        if (customer is not null)
        {
            (customer.FullName, customer.FullNameNormalized, customer.Phone, customer.DateOfBirth) =
                (name, SearchText.Normalize(name), request.Phone, request.DateOfBirth);
            (customer.Gender, customer.Address, customer.ConsentPersonalData) = (request.Gender, request.Address, request.ConsentPersonalData);
        }
        else
        {
            // Staff edit only their name and phone; position is set by an admin.
            var staff = await db.Set<StaffProfile>().SingleOrDefaultAsync(x => x.AccountId == AccountId, cancellationToken);
            if (staff is null) db.Add(staff = new StaffProfile { AccountId = AccountId });
            (staff.FullName, staff.Phone) = (name, request.Phone);
        }
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpGet("preferences")]
    public async Task<IActionResult> ListPreferences(CancellationToken cancellationToken) =>
        Ok(await db.Set<Preference>().Where(p => p.IsActive).OrderBy(p => p.Name)
            .Select(p => new PreferenceItem(p.Id, p.Name)).ToListAsync(cancellationToken));

    [HttpGet("me/preferences"), Authorize(Policy = "RequireCustomer")]
    public async Task<IActionResult> GetMyPreferences(CancellationToken cancellationToken) =>
        Ok(await db.Set<CustomerPreference>().Where(c => c.CustomerId == AccountId)
            .Join(db.Set<Preference>(), c => c.PreferenceId, p => p.Id, (c, p) => new MyPreferenceItem(p.Id, p.Name, c.Source))
            .ToListAsync(cancellationToken));

    /// <summary>Replaces the customer's declared preferences; survey-derived ones stay unless re-declared.</summary>
    [HttpPut("me/preferences"), Authorize(Policy = "RequireCustomer")]
    public async Task<IActionResult> UpdateMyPreferences(PreferenceIdsRequest request, CancellationToken cancellationToken)
    {
        var ids = request.PreferenceIds.Distinct().ToArray();
        if (!await AuthController.PreferencesExist(db, ids, cancellationToken))
            return Fail(StatusCodes.Status400BadRequest, "VALIDATION_ERROR", "Có sở thích không còn tồn tại. Hãy tải lại trang.");
        var current = await db.Set<CustomerPreference>().Where(c => c.CustomerId == AccountId).ToListAsync(cancellationToken);
        db.RemoveRange(current.Where(c => c.Source == PreferenceSource.Declared && !ids.Contains(c.PreferenceId)));
        foreach (var existing in current.Where(c => ids.Contains(c.PreferenceId)))
            existing.Source = PreferenceSource.Declared;
        db.AddRange(ids.Except(current.Select(c => c.PreferenceId))
            .Select(id => new CustomerPreference { CustomerId = AccountId, PreferenceId = id }));
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}

public sealed record RegisterRequest(
    [Required, EmailAddress, StringLength(256)] string Email,
    [Required, StringLength(128, MinimumLength = 8), RegularExpression(PasswordRule.Pattern, ErrorMessage = PasswordRule.Message)] string Password,
    [Required, StringLength(150)] string FullName,
    [StringLength(32)] string? Phone,
    DateOnly? DateOfBirth,
    [StringLength(32)] string? Gender,
    int[] PreferenceIds);
public sealed record LoginRequest([Required, StringLength(256)] string Email, [Required, StringLength(128)] string Password);
public sealed record UpdateProfileRequest(
    [Required, StringLength(150)] string FullName,
    [StringLength(32)] string? Phone,
    DateOnly? DateOfBirth,
    [StringLength(32)] string? Gender,
    [StringLength(1000)] string? Address,
    bool ConsentPersonalData);
public sealed record PreferenceIdsRequest(int[] PreferenceIds);
public sealed record AuthUser(int Id, string Email, AccountRole Role, string FullName, bool MustChangePassword = false);
public sealed record MeResponse(int Id, string Email, AccountRole Role, string FullName, string? Phone, DateOnly? DateOfBirth,
    string? Gender, string? Address, bool ConsentPersonalData, bool MustChangePassword = false);
public sealed record PreferenceItem(int Id, string Name);
public sealed record MyPreferenceItem(int Id, string Name, PreferenceSource Source);

internal static class PasswordRule
{
    public const string Pattern = @"^(?=.*\p{L})(?=.*\d).+$";
    public const string Message = "Mật khẩu cần ít nhất 8 ký tự, gồm cả chữ và số.";
}
