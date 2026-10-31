using System.Net;
using System.Net.Http.Json;
using Cocoon.Domain.Entities;
using Cocoon.Domain.Enums;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Cocoon.Tests;

public sealed class AdminAccountsApiTests : AccountApiTestBase
{
    [Fact]
    public async Task Profile_updates_use_current_role_even_when_old_customer_profile_remains()
    {
        var admin = await Actor(AccountRole.Admin);
        var customer = await Actor(AccountRole.Customer, "Tên hồ sơ khách cũ");
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Patch, $"/api/v1/admin/accounts/{customer}/role", "Admin", admin,
            new { role = "Staff" })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Put, "/api/v1/me", "Staff", customer,
            new { fullName = "Tên nhân viên mới", phone = "0901234567", consentPersonalData = false })).StatusCode);
        var me = await Json(await Send(HttpMethod.Get, "/api/v1/me", "Staff", customer));
        Assert.Equal("Tên nhân viên mới", me.GetProperty("fullName").GetString());
        Assert.False(me.GetProperty("mustChangePassword").GetBoolean());
        await using var db = Database.CreateContext();
        Assert.Equal("Tên hồ sơ khách cũ", (await db.Set<CustomerProfile>().SingleAsync(c => c.AccountId == customer)).FullName);
    }

    [Fact]
    public async Task Admin_creates_profiles_and_password_once_then_searches_without_secrets()
    {
        var admin = await Actor(AccountRole.Admin);
        foreach (var role in Enum.GetValues<AccountRole>())
        {
            var email = $"{role}@example.test";
            using var response = await Send(HttpMethod.Post, "/api/v1/admin/accounts", "Admin", admin,
                new { email = email.ToUpperInvariant(), fullName = "  Đặng Ánh  ", role = role.ToString() });
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            Assert.Equal("no-store", response.Headers.CacheControl?.ToString());
            var created = await Json(response);
            var id = created.GetProperty("id").GetInt32();
            var temporary = created.GetProperty("temporaryPassword").GetString()!;
            Assert.True(created.GetProperty("mustChangePassword").GetBoolean());
            await using var db = Database.CreateContext();
            var saved = await db.Set<Account>().SingleAsync(a => a.Id == id);
            Assert.NotEqual(PasswordVerificationResult.Failed, new PasswordHasher<Account>().VerifyHashedPassword(saved, saved.PasswordHash, temporary));
            Assert.Equal(email.ToLowerInvariant(), saved.Email);
            Assert.True(saved.MustChangePassword);
            if (role == AccountRole.Customer) Assert.True(await db.Set<CustomerProfile>().AnyAsync(p => p.AccountId == id));
            else Assert.True(await db.Set<StaffProfile>().AnyAsync(p => p.AccountId == id));
            await Problem(await Send(HttpMethod.Post, "/api/v1/admin/accounts", "Admin", admin,
                new { email, fullName = "Trùng email", role = "Staff" }), HttpStatusCode.Conflict, "EMAIL_TAKEN");
        }
        using var list = await Send(HttpMethod.Get, "/api/v1/admin/accounts?search=" + Uri.EscapeDataString("Đặng Ánh") + "&role=Staff&status=Active&pageSize=1", "Admin", admin);
        var body = await Json(list);
        Assert.Equal(1, body.GetProperty("totalCount").GetInt32());
        Assert.Equal("Đặng Ánh", body.GetProperty("items")[0].GetProperty("fullName").GetString());
        var raw = await list.Content.ReadAsStringAsync();
        Assert.DoesNotContain("password", raw, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Concurrent_demotions_cannot_remove_both_admins()
    {
        var first = await Actor(AccountRole.Admin);
        var second = await Actor(AccountRole.Admin);
        var results = await Task.WhenAll(
            Send(HttpMethod.Patch, $"/api/v1/admin/accounts/{second}/role", "Admin", first, new { role = "Staff" }),
            Send(HttpMethod.Patch, $"/api/v1/admin/accounts/{first}/role", "Admin", second, new { role = "Staff" }));
        Assert.Contains(results, r => r.StatusCode == HttpStatusCode.NoContent);
        Assert.All(results, r => Assert.Contains(r.StatusCode, new[] { HttpStatusCode.NoContent, HttpStatusCode.Conflict, HttpStatusCode.Unauthorized }));
        await using var db = Database.CreateContext();
        Assert.Equal(1, await db.Set<Account>().CountAsync(a => a.Role == AccountRole.Admin && a.IsActive));
    }

    [Fact]
    public async Task Missing_or_unknown_roles_and_missing_status_return_field_errors()
    {
        var admin = await Actor(AccountRole.Admin);
        foreach (var body in new object[] { new { email = "one@example.test", fullName = "Họ tên" },
            new { email = "two@example.test", fullName = "Họ tên", role = 99 } })
            await Problem(await Send(HttpMethod.Post, "/api/v1/admin/accounts", "Admin", admin, body), HttpStatusCode.BadRequest, "VALIDATION_ERROR");
        await Problem(await Send(HttpMethod.Patch, $"/api/v1/admin/accounts/{admin}/status", "Admin", admin, new { }), HttpStatusCode.BadRequest, "VALIDATION_ERROR");
    }

    [Theory]
    [InlineData("Customer")]
    [InlineData("Manager")]
    [InlineData("Staff")]
    public async Task Wrong_roles_cannot_manage_accounts(string role)
    {
        var actor = await Actor(Enum.Parse<AccountRole>(role));
        foreach (var (method, route, body) in new (HttpMethod, string, object?)[] {
            (HttpMethod.Get, "", null), (HttpMethod.Post, "", new { email = "new@example.test", fullName = "Họ tên", role = "Admin" }),
            (HttpMethod.Patch, $"/{actor}/role", new { role = "Admin" }),
            (HttpMethod.Patch, $"/{actor}/status", new { isActive = false }), (HttpMethod.Delete, $"/{actor}", null) })
            Assert.Equal(HttpStatusCode.Forbidden, (await Send(method, "/api/v1/admin/accounts" + route, role, actor, body)).StatusCode);
    }

    [Fact]
    public async Task Self_and_last_active_admin_are_protected_even_with_a_disabled_second_admin()
    {
        var admin = await Actor(AccountRole.Admin);
        await Problem(await Send(HttpMethod.Patch, $"/api/v1/admin/accounts/{admin}/status", "Admin", admin, new { isActive = false }), HttpStatusCode.Conflict, "SELF_MODIFICATION_FORBIDDEN");
        await Problem(await Send(HttpMethod.Delete, $"/api/v1/admin/accounts/{admin}", "Admin", admin), HttpStatusCode.Conflict, "SELF_MODIFICATION_FORBIDDEN");
        await Problem(await Send(HttpMethod.Patch, $"/api/v1/admin/accounts/{admin}/role", "Admin", admin, new { role = "Staff" }), HttpStatusCode.Conflict, "LAST_ADMIN");
        var second = await Actor(AccountRole.Admin);
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Patch, $"/api/v1/admin/accounts/{second}/status", "Admin", admin, new { isActive = false })).StatusCode);
        await Problem(await Send(HttpMethod.Patch, $"/api/v1/admin/accounts/{admin}/role", "Admin", admin, new { role = "Customer" }), HttpStatusCode.Conflict, "LAST_ADMIN");
    }

    [Fact]
    public async Task Changes_revoke_sessions_preserve_profiles_and_write_secret_free_audit()
    {
        var admin = await Actor(AccountRole.Admin);
        var staff = await Actor(AccountRole.Staff);
        await using var db = Database.CreateContext();
        db.Add(new RefreshToken { AccountId = staff, TokenHash = "test-session", ExpiresAt = DateTime.UtcNow.AddDays(1) });
        await db.SaveChangesAsync();
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Patch, $"/api/v1/admin/accounts/{staff}/role", "Admin", admin, new { role = "Customer" })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Send(HttpMethod.Get, "/api/v1/me", "Staff", staff)).StatusCode);
        db.ChangeTracker.Clear();
        Assert.True(await db.Set<CustomerProfile>().AnyAsync(p => p.AccountId == staff));
        Assert.True(await db.Set<StaffProfile>().AnyAsync(p => p.AccountId == staff));
        Assert.NotNull((await db.Set<RefreshToken>().SingleAsync(t => t.AccountId == staff)).RevokedAt);
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Patch, $"/api/v1/admin/accounts/{staff}/status", "Admin", admin, new { isActive = false })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Send(HttpMethod.Get, "/api/v1/me", "Customer", staff)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Delete, $"/api/v1/admin/accounts/{staff}", "Admin", admin)).StatusCode);
        db.ChangeTracker.Clear();
        Assert.True((await db.Set<Account>().IgnoreQueryFilters().SingleAsync(a => a.Id == staff)).IsDeleted);
        var logs = await db.Set<ActivityLog>().Where(l => l.EntityId == staff).ToListAsync();
        Assert.Equal(3, logs.Count);
        Assert.All(logs, l => { Assert.Equal(admin, l.AccountId); Assert.DoesNotContain("password", l.Detail ?? "", StringComparison.OrdinalIgnoreCase); });
    }

    [Fact]
    public async Task Temporary_password_only_allows_change_and_old_refresh_is_revoked()
    {
        var admin = await Actor(AccountRole.Admin);
        var email = "temporary@example.test";
        var created = await Json(await Send(HttpMethod.Post, "/api/v1/admin/accounts", "Admin", admin, new { email, fullName = "Khách mới", role = "Customer" }));
        var id = created.GetProperty("id").GetInt32();
        var temporary = created.GetProperty("temporaryPassword").GetString()!;
        var login = await Send(HttpMethod.Post, "/api/v1/auth/login", body: new { email, password = temporary });
        Assert.True((await Json(login)).GetProperty("mustChangePassword").GetBoolean());
        await Problem(await Send(HttpMethod.Get, "/api/v1/me/orders", "Customer", id), HttpStatusCode.Forbidden, "PASSWORD_CHANGE_REQUIRED");
        await Problem(await Send(HttpMethod.Post, "/api/v1/auth/change-password", "Customer", id, new { currentPassword = "Wrong12345", newPassword = Password }), HttpStatusCode.BadRequest, "INVALID_CURRENT_PASSWORD");
        await Problem(await Send(HttpMethod.Post, "/api/v1/auth/change-password", "Customer", id, new { currentPassword = temporary, newPassword = "weak" }), HttpStatusCode.BadRequest, "VALIDATION_ERROR");
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Post, "/api/v1/auth/change-password", "Customer", id, new { currentPassword = temporary, newPassword = Password })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Get, "/api/v1/me/orders", "Customer", id)).StatusCode);
        await using var db = Database.CreateContext();
        Assert.False((await db.Set<Account>().SingleAsync(a => a.Id == id)).MustChangePassword);
        Assert.All(await db.Set<RefreshToken>().Where(t => t.AccountId == id).ToListAsync(), t => Assert.NotNull(t.RevokedAt));
    }
}
