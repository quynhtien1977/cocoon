using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using Cocoon.Api.Auth;
using Cocoon.Api.Controllers;
using Cocoon.Application.Email;
using Cocoon.Domain.Entities;
using Cocoon.Domain.Enums;
using Cocoon.Infrastructure.Accounts;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Cocoon.Tests;

/// <summary>Email one-time codes (decision 15/11/2026) against cocoon_tests, with SMTP replaced by an in-memory outbox.</summary>
public sealed class PasswordResetApiTests : IClassFixture<DatabaseFixture>, IDisposable
{
    private const string NewPassword = "MatKhau2026";
    private readonly DatabaseFixture _database;
    private readonly Outbox _outbox = new();
    private readonly WebApplicationFactory<Program> _factory;

    public PasswordResetApiTests(DatabaseFixture database)
    {
        _database = database;
        _factory = new FoundationFactory().WithWebHostBuilder(builder => builder
            .UseSetting("ConnectionStrings:Default", database.ConnectionString)
            .ConfigureServices(services =>
            {
                services.AddScoped<IAccountGate, DbAccountGate>();
                services.AddSingleton<IEmailSender>(_outbox);
            }));
    }

    public void Dispose() => _factory.Dispose();

    [Fact]
    public async Task Manager_created_customer_gets_an_email_code_and_sets_their_own_password()
    {
        var manager = await Manager();
        var email = $"khach-{Guid.NewGuid():N}@example.test";
        using var created = await Send(HttpMethod.Post, "/api/v1/customers", manager, NewCustomer(email));
        var body = await Json(created);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        Assert.True(body.GetProperty("invitationSent").GetBoolean());
        Assert.False(body.TryGetProperty("temporaryPassword", out _));  // the generated password never leaves the server

        var mail = Assert.Single(_outbox.To(email));
        Assert.Equal("Kích hoạt tài khoản Cocoon của bạn", mail.Subject);
        Assert.Contains($"/reset-password?email={Uri.EscapeDataString(email)}", mail.Text);
        Assert.Contains("24 giờ", mail.Text);
        var code = Code(mail);

        var ticket = await Ticket(email.ToUpperInvariant(), code);
        // A weak password is refused without spending the ticket.
        await AssertProblem(await Reset(ticket, "ngan"), HttpStatusCode.BadRequest, "VALIDATION_ERROR");
        Assert.Equal(HttpStatusCode.NoContent, (await Reset(ticket, NewPassword)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Post("/api/v1/auth/login", new { email, password = NewPassword })).StatusCode);
        await AssertProblem(await Reset(ticket, "MatKhauKhac9"), HttpStatusCode.BadRequest, "RESET_EXPIRED");
        await AssertProblem(await Verify(email, code), HttpStatusCode.BadRequest, "INVALID_CODE");

        await using var db = _database.CreateContext();
        var account = await db.Set<Account>().SingleAsync(a => a.Email == email);
        Assert.False(account.MustChangePassword);
        Assert.Contains(await db.Set<ActivityLog>().Where(l => l.EntityId == account.Id).Select(l => l.Action).ToListAsync(), a => a == "PasswordSetFromInvitation");
        var id = body.GetProperty("id").GetInt32();
        await AssertProblem(await Send(HttpMethod.Post, $"/api/v1/customers/{id}/invitation", manager), HttpStatusCode.Conflict, "ALREADY_ACTIVATED");
    }

    [Fact]
    public async Task Resending_an_invitation_is_manager_only_rate_limited_and_cancels_the_older_code()
    {
        var manager = await Manager();
        var email = $"khach-{Guid.NewGuid():N}@example.test";
        var id = (await Json(await Send(HttpMethod.Post, "/api/v1/customers", manager, NewCustomer(email)))).GetProperty("id").GetInt32();
        var first = Code(Assert.Single(_outbox.To(email)));
        await AssertProblem(await Send(HttpMethod.Post, $"/api/v1/customers/{id}/invitation", manager), HttpStatusCode.TooManyRequests, "TOO_MANY_REQUESTS");
        Assert.Equal(HttpStatusCode.Forbidden, (await Send(HttpMethod.Post, $"/api/v1/customers/{id}/invitation", await Token(AccountRole.Staff))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Send(HttpMethod.Post, $"/api/v1/customers/{id}/invitation", await Token(AccountRole.Customer))).StatusCode);

        await Backdate(email);
        Assert.Equal(HttpStatusCode.Accepted, (await Send(HttpMethod.Post, $"/api/v1/customers/{id}/invitation", manager)).StatusCode);
        var second = Code(_outbox.To(email).Last());
        if (first != second)
            await AssertProblem(await Verify(email, first), HttpStatusCode.BadRequest, "INVALID_CODE");
        Assert.Equal(HttpStatusCode.NoContent, (await Reset(await Ticket(email, second), NewPassword)).StatusCode);
    }

    [Fact]
    public async Task Forgot_password_answers_the_same_for_any_email_and_a_code_dies_after_five_tries()
    {
        var email = await Customer();
        using var unknown = await Post("/api/v1/auth/password/forgot", new { email = $"khong-co-{Guid.NewGuid():N}@example.test" });
        using var known = await Post("/api/v1/auth/password/forgot", new { email });
        Assert.Equal(HttpStatusCode.Accepted, unknown.StatusCode);
        Assert.Equal(HttpStatusCode.Accepted, known.StatusCode);
        Assert.Equal(await unknown.Content.ReadAsStringAsync(), await known.Content.ReadAsStringAsync());
        var mail = Assert.Single(_outbox.To(email));
        Assert.Equal("Mã đặt lại mật khẩu Cocoon", mail.Subject);
        Assert.Contains("15 phút", mail.Text);
        var code = Code(mail);

        // Asking again within a minute sends nothing new but still answers 202.
        Assert.Equal(HttpStatusCode.Accepted, (await Post("/api/v1/auth/password/forgot", new { email })).StatusCode);
        Assert.Single(_outbox.To(email));

        var wrong = code == "000000" ? "000001" : "000000";
        for (var i = 0; i < 5; i++)
            await AssertProblem(await Verify(email, wrong), HttpStatusCode.BadRequest, "INVALID_CODE");
        await AssertProblem(await Verify(email, code), HttpStatusCode.BadRequest, "INVALID_CODE");
    }

    [Fact]
    public async Task A_verified_code_gives_a_ticket_that_works_once_and_dies_with_its_code()
    {
        var email = await Customer();
        await Post("/api/v1/auth/password/forgot", new { email });
        var first = await Ticket(email, Code(Assert.Single(_outbox.To(email))));

        // Changing any part of the ticket breaks its signature.
        var forged = first[..^1] + (first[^1] == '0' ? '1' : '0');
        await AssertProblem(await Reset(forged, NewPassword), HttpStatusCode.BadRequest, "RESET_EXPIRED");
        await AssertProblem(await Reset("1.2.3", NewPassword), HttpStatusCode.BadRequest, "RESET_EXPIRED");

        // A newer code cancels the older code and its ticket.
        await Backdate(email);
        await Post("/api/v1/auth/password/forgot", new { email });
        var code = Code(_outbox.To(email).Last());
        await AssertProblem(await Reset(first, NewPassword), HttpStatusCode.BadRequest, "RESET_EXPIRED");

        // A ticket older than its lifetime is refused even though the code is still live.
        using (var shortLived = _factory.WithWebHostBuilder(builder => builder.ConfigureServices(services =>
                   services.PostConfigure<PasswordResetOptions>(o => o.TicketLifetime = TimeSpan.Zero))))
        {
            using var client = shortLived.CreateClient();
            var stale = (await Json(await client.PostAsJsonAsync("/api/v1/auth/password/verify", new { email, code }))).GetProperty("ticket").GetString()!;
            await AssertProblem(await client.PostAsJsonAsync("/api/v1/auth/password/reset", new { ticket = stale, newPassword = NewPassword }),
                HttpStatusCode.BadRequest, "RESET_EXPIRED");
        }

        var ticket = await Ticket(email, code);
        Assert.Equal(HttpStatusCode.NoContent, (await Reset(ticket, NewPassword)).StatusCode);
        await AssertProblem(await Reset(ticket, "MatKhauKhac9"), HttpStatusCode.BadRequest, "RESET_EXPIRED");
        Assert.Equal(HttpStatusCode.OK, (await Post("/api/v1/auth/login", new { email, password = NewPassword })).StatusCode);
    }

    [Fact]
    public async Task Reset_clears_lockout_and_ends_sessions_and_expired_codes_are_refused()
    {
        var email = await Customer();
        await using (var db = _database.CreateContext())
        {
            var account = await db.Set<Account>().SingleAsync(a => a.Email == email);
            (account.FailedLoginCount, account.LockoutEnd) = (5, DateTime.UtcNow.AddMinutes(15));
            db.Add(new RefreshToken { AccountId = account.Id, TokenHash = Guid.NewGuid().ToString("N"), ExpiresAt = DateTime.UtcNow.AddDays(7) });
            await db.SaveChangesAsync();
        }
        await Post("/api/v1/auth/password/forgot", new { email });
        var code = Code(Assert.Single(_outbox.To(email)));
        var accountId = await IdOf(email);
        await using (var db = _database.CreateContext())
            await db.Set<PasswordResetToken>().Where(t => t.AccountId == accountId)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.ExpiresAt, DateTime.UtcNow.AddSeconds(-1)));
        await AssertProblem(await Verify(email, code), HttpStatusCode.BadRequest, "INVALID_CODE");

        await Backdate(email);
        await Post("/api/v1/auth/password/forgot", new { email });
        code = Code(_outbox.To(email).Last());
        Assert.Equal(HttpStatusCode.NoContent, (await Reset(await Ticket(email, code), NewPassword)).StatusCode);
        await using (var db = _database.CreateContext())
        {
            var account = await db.Set<Account>().SingleAsync(a => a.Email == email);
            Assert.Equal((0, null), (account.FailedLoginCount, account.LockoutEnd));
            Assert.False(await db.Set<RefreshToken>().AnyAsync(t => t.AccountId == account.Id && t.ExpiresAt > DateTime.UtcNow));
        }
        Assert.Equal(HttpStatusCode.OK, (await Post("/api/v1/auth/login", new { email, password = NewPassword })).StatusCode);
    }

    [Fact]
    public async Task A_failed_email_keeps_the_customer_and_lets_the_manager_retry()
    {
        var manager = await Manager();
        var email = $"khach-{Guid.NewGuid():N}@example.test";
        _outbox.Fail = true;
        var created = await Json(await Send(HttpMethod.Post, "/api/v1/customers", manager, NewCustomer(email)));
        Assert.False(created.GetProperty("invitationSent").GetBoolean());
        var id = created.GetProperty("id").GetInt32();
        await using (var db = _database.CreateContext())
            Assert.False(await db.Set<PasswordResetToken>().AnyAsync(t => t.AccountId == id));  // no code nobody received
        await AssertProblem(await Send(HttpMethod.Post, $"/api/v1/customers/{id}/invitation", manager), HttpStatusCode.ServiceUnavailable, "EMAIL_SEND_FAILED");
        _outbox.Fail = false;
        Assert.Equal(HttpStatusCode.Accepted, (await Send(HttpMethod.Post, $"/api/v1/customers/{id}/invitation", manager)).StatusCode);
        Assert.Single(_outbox.To(email));
    }

    [Fact]
    public async Task An_account_waiting_to_change_its_password_can_still_use_the_code_endpoints()
    {
        var email = await Customer(mustChange: true);
        var id = await IdOf(email);
        using var forgot = await Send(HttpMethod.Post, "/api/v1/auth/password/forgot", FoundationFactory.Token("Customer", id), new { email });
        Assert.Equal(HttpStatusCode.Accepted, forgot.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Send(HttpMethod.Get, "/api/v1/me/orders", FoundationFactory.Token("Customer", id))).StatusCode);
    }

    private static object NewCustomer(string email) => new
    {
        email, fullName = "Khách Được Mời", phone = "0901234567", address = "12 Lê Lợi, Quận 1, TP. Hồ Chí Minh",
        consentPersonalData = false, preferenceIds = Array.Empty<int>(),
    };

    private static string Code(EmailMessage mail) => Regex.Match(mail.Text, @"Mã xác nhận: (\d{6})").Groups[1].Value;

    private Task<HttpResponseMessage> Verify(string email, string code) => Post("/api/v1/auth/password/verify", new { email, code });

    private Task<HttpResponseMessage> Reset(string ticket, string newPassword) => Post("/api/v1/auth/password/reset", new { ticket, newPassword });

    /// <summary>Step 2 with the right code: the ticket that lets step 3 set the password.</summary>
    private async Task<string> Ticket(string email, string code)
    {
        var body = await Json(await Verify(email, code));
        var expiresAt = body.GetProperty("expiresAt").GetDateTime();
        Assert.InRange(expiresAt, DateTime.UtcNow, DateTime.UtcNow.AddMinutes(11));
        return body.GetProperty("ticket").GetString()!;
    }

    /// <summary>Moves the account's codes an hour back, past the one-minute and hourly limits.</summary>
    private async Task Backdate(string email)
    {
        await using var db = _database.CreateContext();
        var id = await db.Set<Account>().Where(a => a.Email == email).Select(a => a.Id).SingleAsync();
        await db.Set<PasswordResetToken>().Where(t => t.AccountId == id)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.CreatedAt, t => t.CreatedAt.AddHours(-2)));
    }

    private async Task<string> Customer(bool mustChange = false)
    {
        await using var db = _database.CreateContext();
        var email = $"khach-{Guid.NewGuid():N}@example.test";
        db.Add(new CustomerProfile { Account = new Account { Email = email, Role = AccountRole.Customer, MustChangePassword = mustChange }, FullName = "Khách Quên Mật Khẩu" });
        await db.SaveChangesAsync();
        return email;
    }

    private async Task<int> IdOf(string email)
    {
        await using var db = _database.CreateContext();
        return await db.Set<Account>().Where(a => a.Email == email).Select(a => a.Id).SingleAsync();
    }

    private async Task<string> Manager() => await Token(AccountRole.Manager);

    private async Task<string> Token(AccountRole role)
    {
        await using var db = _database.CreateContext();
        var account = new Account { Email = $"{role}-{Guid.NewGuid():N}@cocoon.demo", Role = role };
        if (role == AccountRole.Customer) db.Add(new CustomerProfile { Account = account, FullName = "Khách khác" });
        else db.Add(new StaffProfile { Account = account, FullName = role.ToString() });
        await db.SaveChangesAsync();
        return FoundationFactory.Token(role.ToString(), account.Id);
    }

    private async Task<HttpResponseMessage> Post(string path, object body)
    {
        using var client = _factory.CreateClient();
        return await client.PostAsJsonAsync(path, body);
    }

    private async Task<HttpResponseMessage> Send(HttpMethod method, string path, string token, object? body = null)
    {
        using var client = _factory.CreateClient();
        using var request = new HttpRequestMessage(method, path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        if (body is not null) request.Content = JsonContent.Create(body);
        return await client.SendAsync(request);
    }

    private static async Task<JsonElement> Json(HttpResponseMessage response)
    {
        Assert.True(response.IsSuccessStatusCode, $"{(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    private static async Task AssertProblem(HttpResponseMessage response, HttpStatusCode status, string code)
    {
        Assert.Equal(status, response.StatusCode);
        Assert.Equal(code, (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("code").GetString());
    }

    private sealed class Outbox : IEmailSender
    {
        private readonly ConcurrentQueue<EmailMessage> _sent = new();
        public bool Fail { get; set; }

        public IReadOnlyList<EmailMessage> To(string email) => _sent.Where(m => m.To.Equals(email, StringComparison.OrdinalIgnoreCase)).ToList();

        public Task SendAsync(EmailMessage message, CancellationToken ct)
        {
            if (Fail) throw new EmailDeliveryException("SMTP delivery failed (SmtpException).");
            _sent.Enqueue(message);
            return Task.CompletedTask;
        }
    }
}
