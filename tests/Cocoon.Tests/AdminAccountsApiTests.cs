using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using Cocoon.Application.Email;
using Cocoon.Domain.Entities;
using Cocoon.Domain.Enums;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Cocoon.Tests;

public sealed class AdminAccountsApiTests : AccountApiTestBase
{
    [Theory]
    [InlineData(true, true)]
    [InlineData(false, true)]
    [InlineData(true, false)]
    public async Task Unlock_clears_login_lockout_and_failure_count_even_when_account_is_already_active(bool active, bool temporaryLockout)
    {
        var admin = await Actor(AccountRole.Admin);
        var staff = await Actor(AccountRole.Staff);
        string email;
        await using (var setup = Database.CreateContext())
        {
            var account = await setup.Set<Account>().SingleAsync(a => a.Id == staff);
            email = account.Email;
            account.IsActive = active;
            account.LockoutEnd = temporaryLockout ? DateTime.UtcNow.AddMinutes(15) : null;
            account.FailedLoginCount = 3;
            setup.Add(new RefreshToken { AccountId = staff, TokenHash = "lockout-test-session", ExpiresAt = DateTime.UtcNow.AddDays(1) });
            await setup.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Patch, $"/api/v1/admin/accounts/{staff}/status", "Admin", admin,
            new { isActive = true })).StatusCode);
        await using (var verify = Database.CreateContext())
        {
            var saved = await verify.Set<Account>().SingleAsync(a => a.Id == staff);
            Assert.True(saved.IsActive);
            Assert.Null(saved.LockoutEnd);
            Assert.Equal(0, saved.FailedLoginCount);
            Assert.NotNull((await verify.Set<RefreshToken>().SingleAsync(t => t.AccountId == staff)).RevokedAt);
            Assert.Single(await verify.Set<ActivityLog>().Where(l => l.EntityId == staff && l.Action == "AccountUnlocked").ToListAsync());
        }
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Patch, $"/api/v1/admin/accounts/{staff}/status", "Admin", admin,
            new { isActive = true })).StatusCode);
        await using (var verify = Database.CreateContext())
            Assert.Equal(1, await verify.Set<ActivityLog>().CountAsync(l => l.EntityId == staff && l.Action == "AccountUnlocked"));
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Post, "/api/v1/auth/login", body: new { email, password = Password })).StatusCode);
    }

    [Fact]
    public async Task Managers_must_have_a_phone_on_create_and_on_profile_save()
    {
        var admin = await Actor(AccountRole.Admin);
        await Problem(await Send(HttpMethod.Post, "/api/v1/admin/accounts", "Admin", admin,
            new { email = "manager-no-phone@example.test", fullName = "Quản lý", role = "Manager", phone = "  " }), HttpStatusCode.BadRequest, "VALIDATION_ERROR");
        var manager = await Actor(AccountRole.Manager);
        await Problem(await Send(HttpMethod.Put, "/api/v1/me", "Manager", manager,
            new { fullName = "Quản lý", phone = (string?)null, consentPersonalData = false }), HttpStatusCode.BadRequest, "VALIDATION_ERROR");
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Put, "/api/v1/me", "Manager", manager,
            new { fullName = "Quản lý", phone = "0901234567", consentPersonalData = false })).StatusCode);
    }

    [Fact]
    public async Task Profile_updates_use_current_role_even_when_old_customer_profile_remains()
    {
        var customer = await Actor(AccountRole.Customer, "Tên hồ sơ khách cũ");
        // Releases before 17/11/2026 let an admin turn a customer into staff; such rows keep both profiles.
        await using (var legacy = Database.CreateContext())
        {
            (await legacy.Set<Account>().SingleAsync(a => a.Id == customer)).Role = AccountRole.Staff;
            legacy.Add(new StaffProfile { AccountId = customer, FullName = "Tên hồ sơ khách cũ", Position = "Staff" });
            await legacy.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Put, "/api/v1/me", "Staff", customer,
            new { fullName = "Tên nhân viên mới", phone = "0901234567", consentPersonalData = false })).StatusCode);
        var me = await Json(await Send(HttpMethod.Get, "/api/v1/me", "Staff", customer));
        Assert.Equal("Tên nhân viên mới", me.GetProperty("fullName").GetString());
        Assert.False(me.GetProperty("mustChangePassword").GetBoolean());
        await using var db = Database.CreateContext();
        Assert.Equal("Tên hồ sơ khách cũ", (await db.Set<CustomerProfile>().SingleAsync(c => c.AccountId == customer)).FullName);
    }

    [Fact]
    public async Task Admin_creates_profiles_and_emails_temporary_password_once_then_searches_without_secrets()
    {
        var admin = await Actor(AccountRole.Admin);
        var outbox = new Outbox();
        using var mailFactory = Factory.WithWebHostBuilder(builder => builder.ConfigureServices(services => services.AddSingleton<IEmailSender>(outbox)));
        using var client = mailFactory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });
        foreach (var role in Enum.GetValues<AccountRole>().Where(r => r != AccountRole.Customer))
        {
            var email = $"{role}@example.test";
            using var req = new HttpRequestMessage(HttpMethod.Post, "/api/v1/admin/accounts") { Content = JsonContent.Create(new { email = email.ToUpperInvariant(), fullName = "  Đặng Ánh  ", role = role.ToString(), phone = "0912345678" }) };
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", FoundationFactory.Token("Admin", admin));
            using var response = await client.SendAsync(req);
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            Assert.Equal("no-store", response.Headers.CacheControl?.ToString());
            var created = await Json(response);
            var id = created.GetProperty("id").GetInt32();
            Assert.False(created.TryGetProperty("temporaryPassword", out _));
            Assert.True(created.GetProperty("mustChangePassword").GetBoolean());
            Assert.True(created.GetProperty("invitationSent").GetBoolean());
            var mail = Assert.Single(outbox.To(email));
            var temporary = Regex.Match(mail.Text, @"Mật khẩu: ([^\r\n]+)").Groups[1].Value;
            Assert.False(string.IsNullOrWhiteSpace(temporary));
            Assert.Contains(role == AccountRole.Admin ? "/admin/login" : "/login", mail.Text);
            await using var db = Database.CreateContext();
            var saved = await db.Set<Account>().SingleAsync(a => a.Id == id);
            Assert.NotEqual(PasswordVerificationResult.Failed, new PasswordHasher<Account>().VerifyHashedPassword(saved, saved.PasswordHash, temporary));
            Assert.Equal(email.ToLowerInvariant(), saved.Email);
            Assert.True(saved.MustChangePassword);
            Assert.True(await db.Set<StaffProfile>().AnyAsync(p => p.AccountId == id));
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
    public async Task Admin_manages_internal_accounts_only_and_never_moves_one_across_the_customer_line()
    {
        var admin = await Actor(AccountRole.Admin);
        var manager = await Actor(AccountRole.Manager);
        var staff = await Actor(AccountRole.Staff);
        var customer = await Actor(AccountRole.Customer);
        var list = await Json(await Send(HttpMethod.Get, "/api/v1/admin/accounts?pageSize=100", "Admin", admin));
        Assert.All(list.GetProperty("items").EnumerateArray(), row => Assert.NotEqual("Customer", row.GetProperty("role").GetString()));
        Assert.DoesNotContain(list.GetProperty("items").EnumerateArray(), row => row.GetProperty("id").GetInt32() == customer);
        await Problem(await Send(HttpMethod.Get, "/api/v1/admin/accounts?role=Customer", "Admin", admin), HttpStatusCode.BadRequest, "VALIDATION_ERROR");
        await Problem(await Send(HttpMethod.Post, "/api/v1/admin/accounts", "Admin", admin,
            new { email = "admin-made-customer@example.test", fullName = "Khách do admin tạo", role = "Customer" }), HttpStatusCode.Forbidden, "FORBIDDEN");
        await Problem(await Send(HttpMethod.Patch, $"/api/v1/admin/accounts/{staff}/role", "Admin", admin, new { role = "Customer" }), HttpStatusCode.Forbidden, "FORBIDDEN");
        await Problem(await Send(HttpMethod.Patch, $"/api/v1/admin/accounts/{customer}/role", "Admin", admin, new { role = "Staff" }), HttpStatusCode.Forbidden, "FORBIDDEN");
        await Problem(await Send(HttpMethod.Patch, $"/api/v1/admin/accounts/{customer}/status", "Admin", admin, new { isActive = false }), HttpStatusCode.Forbidden, "FORBIDDEN");
        await Problem(await Send(HttpMethod.Delete, $"/api/v1/admin/accounts/{customer}", "Admin", admin), HttpStatusCode.Forbidden, "FORBIDDEN");
        await Problem(await Send(HttpMethod.Post, $"/api/v1/admin/accounts/{customer}/invitation", "Admin", admin), HttpStatusCode.Forbidden, "FORBIDDEN");
        await using (var db = Database.CreateContext())
        {
            Assert.False(await db.Set<Account>().AnyAsync(a => a.Email == "admin-made-customer@example.test"));
            Assert.Equal(AccountRole.Staff, (await db.Set<Account>().SingleAsync(a => a.Id == staff)).Role);
            var untouched = await db.Set<Account>().SingleAsync(a => a.Id == customer);
            Assert.Equal(AccountRole.Customer, untouched.Role);
            Assert.True(untouched.IsActive);
        }
        // Internal moves still work, and the manager keeps full control of customer accounts.
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Patch, $"/api/v1/admin/accounts/{staff}/role", "Admin", admin, new { role = "Manager" })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Post, $"/api/v1/customers/{customer}/lock", "Manager", manager)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Delete, $"/api/v1/customers/{customer}", "Manager", manager)).StatusCode);
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
            (HttpMethod.Post, $"/{actor}/invitation", null),
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
        await Problem(await Send(HttpMethod.Patch, $"/api/v1/admin/accounts/{admin}/role", "Admin", admin, new { role = "Manager" }), HttpStatusCode.Conflict, "LAST_ADMIN");
    }

    [Fact]
    public async Task Changes_revoke_sessions_preserve_profiles_and_write_secret_free_audit()
    {
        var admin = await Actor(AccountRole.Admin);
        var staff = await Actor(AccountRole.Staff);
        await using var db = Database.CreateContext();
        db.Add(new RefreshToken { AccountId = staff, TokenHash = "test-session", ExpiresAt = DateTime.UtcNow.AddDays(1) });
        await db.SaveChangesAsync();
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Patch, $"/api/v1/admin/accounts/{staff}/role", "Admin", admin, new { role = "Manager" })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Send(HttpMethod.Get, "/api/v1/me", "Staff", staff)).StatusCode);
        db.ChangeTracker.Clear();
        Assert.True(await db.Set<StaffProfile>().AnyAsync(p => p.AccountId == staff));
        var roleChanged = await db.Set<RefreshToken>().SingleAsync(t => t.AccountId == staff);
        Assert.NotNull(roleChanged.RevokedAt);
        // Expired too, so the refresh rotation overlap cannot keep a re-roled session alive for a few more seconds.
        Assert.True(roleChanged.ExpiresAt <= DateTime.UtcNow);
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Patch, $"/api/v1/admin/accounts/{staff}/status", "Admin", admin, new { isActive = false })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Send(HttpMethod.Get, "/api/v1/me", "Manager", staff)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Delete, $"/api/v1/admin/accounts/{staff}", "Admin", admin)).StatusCode);
        db.ChangeTracker.Clear();
        Assert.True((await db.Set<Account>().IgnoreQueryFilters().SingleAsync(a => a.Id == staff)).IsDeleted);
        var logs = await db.Set<ActivityLog>().Where(l => l.EntityId == staff).ToListAsync();
        Assert.Equal(3, logs.Count);
        Assert.All(logs, l => { Assert.Equal(admin, l.AccountId); Assert.DoesNotContain("password", l.Detail ?? "", StringComparison.OrdinalIgnoreCase); });
    }

    [Fact]
    public async Task Emailed_password_works_right_away_and_changing_it_clears_the_flag_and_old_sessions()
    {
        var admin = await Actor(AccountRole.Admin);
        var outbox = new Outbox();
        using var mailFactory = Factory.WithWebHostBuilder(builder => builder.ConfigureServices(services => services.AddSingleton<IEmailSender>(outbox)));
        using var client = mailFactory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });
        var email = "first-password@example.test";
        using var createReq = new HttpRequestMessage(HttpMethod.Post, "/api/v1/admin/accounts") { Content = JsonContent.Create(new { email, fullName = "Nhân viên mới", role = "Staff" }) };
        createReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", FoundationFactory.Token("Admin", admin));
        var created = await Json(await client.SendAsync(createReq));
        var id = created.GetProperty("id").GetInt32();
        Assert.False(created.TryGetProperty("temporaryPassword", out _));
        Assert.True(created.GetProperty("invitationSent").GetBoolean());
        var mail = Assert.Single(outbox.To(email));
        Assert.DoesNotContain("yêu cầu bạn đổi", mail.Text);
        var temporary = Regex.Match(mail.Text, @"Mật khẩu: ([^\r\n]+)").Groups[1].Value;
        var login = await Send(HttpMethod.Post, "/api/v1/auth/login", body: new { email, password = temporary });
        Assert.True((await Json(login)).GetProperty("mustChangePassword").GetBoolean());
        // The emailed password is a real password: every screen works before (and without) changing it.
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Get, "/api/v1/staff/feedback", "Staff", id)).StatusCode);
        await Problem(await Send(HttpMethod.Post, "/api/v1/auth/change-password", "Staff", id, new { currentPassword = "Wrong12345", newPassword = Password }), HttpStatusCode.BadRequest, "INVALID_CURRENT_PASSWORD");
        await Problem(await Send(HttpMethod.Post, "/api/v1/auth/change-password", "Staff", id, new { currentPassword = temporary, newPassword = "weak" }), HttpStatusCode.BadRequest, "VALIDATION_ERROR");
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Post, "/api/v1/auth/change-password", "Staff", id, new { currentPassword = temporary, newPassword = Password })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Get, "/api/v1/staff/feedback", "Staff", id)).StatusCode);
        await using var db = Database.CreateContext();
        Assert.False((await db.Set<Account>().SingleAsync(a => a.Id == id)).MustChangePassword);
        Assert.All(await db.Set<RefreshToken>().Where(t => t.AccountId == id).ToListAsync(), t =>
        {
            Assert.NotNull(t.RevokedAt);
            Assert.True(t.ExpiresAt <= DateTime.UtcNow);
        });
    }

    private sealed class Outbox : IEmailSender
    {
        private readonly ConcurrentQueue<EmailMessage> _sent = new();
        public IReadOnlyList<EmailMessage> To(string email) => _sent.Where(m => m.To.Equals(email, StringComparison.OrdinalIgnoreCase)).ToList();
        public Task SendAsync(EmailMessage message, CancellationToken ct) { _sent.Enqueue(message); return Task.CompletedTask; }
    }
}
