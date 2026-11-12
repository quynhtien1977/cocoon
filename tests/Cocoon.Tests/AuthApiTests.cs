using System.Net;
using System.Net.Http.Json;
using Cocoon.Api.Auth;
using Cocoon.Domain.Entities;
using Cocoon.Domain.Enums;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Cocoon.Tests;

/// <summary>End-to-end auth against the cocoon_tests database. Each test uses a fresh email, so rows never collide.</summary>
public sealed class AuthApiTests : IClassFixture<DatabaseFixture>, IDisposable
{
    private const string Password = "Demo12345";
    private readonly DatabaseFixture _database;
    private readonly WebApplicationFactory<Program> _factory;

    public AuthApiTests(DatabaseFixture database)
    {
        _database = database;
        _factory = new FoundationFactory().WithWebHostBuilder(builder => builder
            .UseSetting("ConnectionStrings:Default", database.ConnectionString)
            .ConfigureServices(services => services.AddScoped<IAccountGate, DbAccountGate>()));
    }

    public void Dispose() => _factory.Dispose();

    [Fact]
    public async Task Register_creates_customer_signs_in_and_saves_declared_preferences()
    {
        var preference = await AddPreference();
        var email = NewEmail();
        using var register = await Post("/api/v1/auth/register", new
        {
            email = email.ToUpperInvariant(), password = Password, fullName = "Nguyễn Thị Lan", preferenceIds = new[] { preference }
        });
        Assert.Equal(HttpStatusCode.Created, register.StatusCode);
        var cookies = Cookies(register);
        Assert.Contains("access_token", cookies.Keys);
        Assert.Contains("refresh_token", cookies.Keys);
        Assert.All(register.Headers.GetValues("Set-Cookie"), header => Assert.Contains("httponly", header.ToLowerInvariant()));

        using var me = await Send(HttpMethod.Get, "/api/v1/me", cookies);
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);
        var body = await me.Content.ReadFromJsonAsync<Dictionary<string, object?>>();
        Assert.Equal(email, body!["email"]?.ToString());
        Assert.Equal("Customer", body["role"]?.ToString());

        await using var db = _database.CreateContext();
        var profile = await db.Set<CustomerProfile>().SingleAsync(x => x.Account.Email == email);
        Assert.Equal("nguyen thi lan", profile.FullNameNormalized);
        var saved = await db.Set<CustomerPreference>().SingleAsync(x => x.CustomerId == profile.AccountId);
        Assert.Equal(PreferenceSource.Declared, saved.Source);
    }

    [Fact]
    public async Task Register_rejects_duplicate_email_case_insensitively()
    {
        var email = NewEmail();
        (await Register(email)).Dispose();
        using var duplicate = await Post("/api/v1/auth/register", new { email = email.ToUpperInvariant(), password = Password, fullName = "Khách trùng", preferenceIds = Array.Empty<int>() });
        await AssertProblem(duplicate, HttpStatusCode.Conflict, "EMAIL_TAKEN");
    }

    [Theory]
    [InlineData("short1")]
    [InlineData("onlyletters")]
    [InlineData("1234567890")]
    public async Task Register_rejects_weak_password(string password)
    {
        using var response = await Post("/api/v1/auth/register", new { email = NewEmail(), password, fullName = "Khách", preferenceIds = Array.Empty<int>() });
        await AssertProblem(response, HttpStatusCode.BadRequest, "VALIDATION_ERROR");
    }

    [Fact]
    public async Task Five_wrong_passwords_lock_the_account()
    {
        var email = NewEmail();
        (await Register(email)).Dispose();
        for (var i = 0; i < 5; i++)
        {
            using var wrong = await Post("/api/v1/auth/login", new { email, password = "WrongPass9" });
            await AssertProblem(wrong, HttpStatusCode.Unauthorized, "INVALID_CREDENTIALS");
        }
        using var locked = await Post("/api/v1/auth/login", new { email, password = Password });
        await AssertProblem(locked, HttpStatusCode.Forbidden, "ACCOUNT_LOCKED");
    }

    [Fact]
    public async Task Locked_out_account_with_wrong_password_looks_like_an_unknown_email()
    {
        var email = NewEmail();
        (await Register(email)).Dispose();
        for (var i = 0; i < 5; i++)
            (await Post("/api/v1/auth/login", new { email, password = "WrongPass9" })).Dispose();
        DateTime? lockoutEnd;
        await using (var db = _database.CreateContext())
            lockoutEnd = (await db.Set<Account>().SingleAsync(x => x.Email == email)).LockoutEnd;

        using var probe = await Post("/api/v1/auth/login", new { email, password = "WrongPass9" });
        await AssertProblem(probe, HttpStatusCode.Unauthorized, "INVALID_CREDENTIALS");
        using var unknown = await Post("/api/v1/auth/login", new { email = NewEmail(), password = "WrongPass9" });
        await AssertProblem(unknown, HttpStatusCode.Unauthorized, "INVALID_CREDENTIALS");

        await using (var db = _database.CreateContext())
        {
            var account = await db.Set<Account>().SingleAsync(x => x.Email == email);
            Assert.Equal(lockoutEnd, account.LockoutEnd);
            Assert.Equal(0, account.FailedLoginCount);
        }
        using var stillLocked = await Post("/api/v1/auth/login", new { email, password = Password });
        await AssertProblem(stillLocked, HttpStatusCode.Forbidden, "ACCOUNT_LOCKED");
    }

    [Fact]
    public async Task Disabled_account_reveals_its_state_only_to_the_right_password()
    {
        var email = NewEmail();
        (await Register(email)).Dispose();
        await using (var db = _database.CreateContext())
        {
            (await db.Set<Account>().SingleAsync(x => x.Email == email)).IsActive = false;
            await db.SaveChangesAsync();
        }
        using var wrong = await Post("/api/v1/auth/login", new { email, password = "WrongPass9" });
        await AssertProblem(wrong, HttpStatusCode.Unauthorized, "INVALID_CREDENTIALS");
        using var right = await Post("/api/v1/auth/login", new { email, password = Password });
        await AssertProblem(right, HttpStatusCode.Forbidden, "ACCOUNT_DISABLED");
        Assert.False(right.Headers.Contains("Set-Cookie"));
    }

    [Fact]
    public async Task Refresh_cookie_is_site_wide_and_replaces_the_legacy_path()
    {
        using var login = await Post("/api/v1/auth/login", new { email = await Registered(), password = Password });
        var setCookies = login.Headers.GetValues("Set-Cookie").Select(h => h.ToLowerInvariant()).ToList();
        // The Next.js proxy reads it on page requests, so it cannot stay scoped to /api/v1/auth.
        Assert.Contains(setCookies, h => h.StartsWith("refresh_token=") && !h.StartsWith("refresh_token=;") && h.Contains("path=/;") && h.Contains("httponly"));
        Assert.Contains(setCookies, h => h.StartsWith("refresh_token=;") && h.Contains("path=/api/v1/auth"));
    }

    [Fact]
    public async Task Refresh_rotates_and_tolerates_a_concurrent_reuse_but_not_a_late_replay()
    {
        var email = await Registered();
        using var login = await Post("/api/v1/auth/login", new { email, password = Password });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var first = Cookies(login);

        using var refreshed = await Send(HttpMethod.Post, "/api/v1/auth/refresh", first);
        Assert.Equal(HttpStatusCode.NoContent, refreshed.StatusCode);
        var second = Cookies(refreshed);
        Assert.NotEqual(first["refresh_token"], second["refresh_token"]);

        // A parallel prefetch or a second tab sends the same token before the new cookie lands: still a valid session.
        using var concurrent = await Send(HttpMethod.Post, "/api/v1/auth/refresh", first);
        Assert.Equal(HttpStatusCode.NoContent, concurrent.StatusCode);

        // After the overlap window the same replay means the token was copied: refused, and every session ends.
        await using (var db = _database.CreateContext())
        {
            var id = (await db.Set<Account>().SingleAsync(a => a.Email == email)).Id;
            var past = DateTime.UtcNow - TokenService.RotationOverlap - TimeSpan.FromSeconds(1);
            await db.Set<RefreshToken>().Where(t => t.AccountId == id && t.RevokedAt != null)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, past));
        }
        using var replay = await Send(HttpMethod.Post, "/api/v1/auth/refresh", first);
        await AssertProblem(replay, HttpStatusCode.Unauthorized, "UNAUTHENTICATED");
        using var afterTheft = await Send(HttpMethod.Post, "/api/v1/auth/refresh", second);
        await AssertProblem(afterTheft, HttpStatusCode.Unauthorized, "UNAUTHENTICATED");
    }

    [Fact]
    public async Task Logout_revokes_the_refresh_token_without_an_overlap()
    {
        var cookies = Cookies(await Register(NewEmail()));
        using var logout = await Send(HttpMethod.Post, "/api/v1/auth/logout", cookies);
        Assert.Equal(HttpStatusCode.NoContent, logout.StatusCode);
        // Immediately, inside what would be the rotation overlap: a logged-out token must not come back.
        using var refresh = await Send(HttpMethod.Post, "/api/v1/auth/refresh", cookies);
        Assert.Equal(HttpStatusCode.Unauthorized, refresh.StatusCode);
    }

    private async Task<string> Registered()
    {
        var email = NewEmail();
        (await Register(email)).Dispose();
        return email;
    }

    [Fact]
    public async Task Disabled_account_is_rejected_on_the_next_request()
    {
        var email = NewEmail();
        var cookies = Cookies(await Register(email));
        await using (var db = _database.CreateContext())
        {
            var account = await db.Set<Account>().SingleAsync(x => x.Email == email);
            account.IsActive = false;
            await db.SaveChangesAsync();
        }
        using var me = await Send(HttpMethod.Get, "/api/v1/me", cookies);
        Assert.Equal(HttpStatusCode.Unauthorized, me.StatusCode);
    }

    [Fact]
    public async Task Updating_preferences_replaces_declared_and_keeps_survey_ones()
    {
        var (a, b, fromSurvey) = (await AddPreference(), await AddPreference(), await AddPreference());
        var email = NewEmail();
        var cookies = Cookies(await Register(email, a));
        await using (var db = _database.CreateContext())
        {
            var id = (await db.Set<Account>().SingleAsync(x => x.Email == email)).Id;
            db.Add(new CustomerPreference { CustomerId = id, PreferenceId = fromSurvey, Source = PreferenceSource.Survey });
            await db.SaveChangesAsync();
        }

        using var put = await Send(HttpMethod.Put, "/api/v1/me/preferences", cookies, new { preferenceIds = new[] { b } });
        Assert.Equal(HttpStatusCode.NoContent, put.StatusCode);

        using var get = await Send(HttpMethod.Get, "/api/v1/me/preferences", cookies);
        var items = await get.Content.ReadFromJsonAsync<List<MyPreference>>(JsonOptions);
        Assert.Equal([(b, PreferenceSource.Declared), (fromSurvey, PreferenceSource.Survey)],
            items!.OrderBy(x => x.Source).Select(x => (x.Id, x.Source)));
    }

    private sealed record MyPreference(int Id, string Name, PreferenceSource Source);

    private static readonly System.Text.Json.JsonSerializerOptions JsonOptions =
        new(System.Text.Json.JsonSerializerDefaults.Web) { Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() } };

    private static string NewEmail() => $"khach-{Guid.NewGuid():N}@cocoon.demo";

    private async Task<int> AddPreference()
    {
        await using var db = _database.CreateContext();
        var preference = new Preference { Name = $"Sở thích {Guid.NewGuid():N}"[..20] };
        db.Add(preference);
        await db.SaveChangesAsync();
        return preference.Id;
    }

    private Task<HttpResponseMessage> Register(string email, params int[] preferenceIds) =>
        Post("/api/v1/auth/register", new { email, password = Password, fullName = "Khách thử nghiệm", preferenceIds });

    private Task<HttpResponseMessage> Post(string path, object body) => Send(HttpMethod.Post, path, new(), body);

    private async Task<HttpResponseMessage> Send(HttpMethod method, string path, Dictionary<string, string> cookies, object? body = null)
    {
        // Cookies are sent by hand so a test can replay an old refresh token.
        using var client = _factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });
        using var request = new HttpRequestMessage(method, path);
        if (cookies.Count > 0)
            request.Headers.Add("Cookie", string.Join("; ", cookies.Select(x => $"{x.Key}={x.Value}")));
        if (body is not null) request.Content = JsonContent.Create(body);
        return await client.SendAsync(request);
    }

    private static Dictionary<string, string> Cookies(HttpResponseMessage response) =>
        response.Headers.TryGetValues("Set-Cookie", out var headers)
            ? headers.Select(h => h.Split(';')[0].Split('=', 2)).Where(p => p[1].Length > 0).ToDictionary(p => p[0], p => p[1])
            : [];

    private static async Task AssertProblem(HttpResponseMessage response, HttpStatusCode status, string code)
    {
        Assert.Equal(status, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.Equal(code, problem!.Extensions["code"]?.ToString());
    }
}
