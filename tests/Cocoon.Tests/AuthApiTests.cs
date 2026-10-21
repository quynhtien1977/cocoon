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
    public async Task Refresh_rotates_token_and_rejects_the_old_one()
    {
        var email = NewEmail();
        (await Register(email)).Dispose();
        using var login = await Post("/api/v1/auth/login", new { email, password = Password });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var first = Cookies(login);

        using var refreshed = await Send(HttpMethod.Post, "/api/v1/auth/refresh", first);
        Assert.Equal(HttpStatusCode.NoContent, refreshed.StatusCode);
        Assert.NotEqual(first["refresh_token"], Cookies(refreshed)["refresh_token"]);

        using var reused = await Send(HttpMethod.Post, "/api/v1/auth/refresh", first);
        await AssertProblem(reused, HttpStatusCode.Unauthorized, "UNAUTHENTICATED");
    }

    [Fact]
    public async Task Logout_revokes_the_refresh_token()
    {
        var cookies = Cookies(await Register(NewEmail()));
        using var logout = await Send(HttpMethod.Post, "/api/v1/auth/logout", cookies);
        Assert.Equal(HttpStatusCode.NoContent, logout.StatusCode);
        using var refresh = await Send(HttpMethod.Post, "/api/v1/auth/refresh", cookies);
        Assert.Equal(HttpStatusCode.Unauthorized, refresh.StatusCode);
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
