using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using Cocoon.Api.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

namespace Cocoon.Tests;

public sealed class ApiFoundationTests : IClassFixture<FoundationFactory>
{
    private readonly HttpClient _client;

    public ApiFoundationTests(FoundationFactory factory) => _client = factory.CreateClient();

    [Fact]
    public async Task Health_is_public_and_returns_ok()
    {
        var response = await _client.GetAsync("/api/v1/health");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        Assert.Equal("ok", body!["status"]);
    }

    [Fact]
    public async Task Missing_route_returns_problem_details_with_code()
    {
        var response = await _client.GetAsync("/api/v1/missing");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.Equal("NOT_FOUND", problem!.Extensions["code"]?.ToString());
    }

    [Theory]
    [InlineData(null, HttpStatusCode.Unauthorized)]
    [InlineData("Customer", HttpStatusCode.Forbidden)]
    [InlineData("Staff", HttpStatusCode.Forbidden)]
    [InlineData("Manager", HttpStatusCode.Forbidden)]
    [InlineData("Admin", HttpStatusCode.OK)]
    public async Task Admin_policy_checks_signed_role(string? role, HttpStatusCode expected)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/test-only/admin");
        if (role is not null)
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", FoundationFactory.Token(role));
        using var response = await _client.SendAsync(request);
        Assert.Equal(expected, response.StatusCode);
    }

    [Fact]
    public async Task Invalid_token_is_rejected()
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/test-only/admin");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", "invalid-token");
        using var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("Manager", HttpStatusCode.NotImplemented)]
    [InlineData("Customer", HttpStatusCode.Forbidden)]
    public async Task Stub_endpoints_enforce_policy_then_report_not_implemented(string role, HttpStatusCode expected)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/customers");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", FoundationFactory.Token(role));
        using var response = await _client.SendAsync(request);
        Assert.Equal(expected, response.StatusCode);
        if (expected == HttpStatusCode.NotImplemented)
        {
            var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
            Assert.Equal("NOT_IMPLEMENTED", problem!.Extensions["code"]?.ToString());
        }
    }

    [Fact]
    public async Task Signed_token_can_be_read_from_http_only_cookie_transport()
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/test-only/admin");
        request.Headers.Add("Cookie", $"access_token={FoundationFactory.Token("Admin")}");
        using var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}

public sealed class FoundationFactory : WebApplicationFactory<Program>
{
    private static readonly string TestKey = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(48));

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Jwt:Key"] = TestKey,
            ["Jwt:Issuer"] = "cocoon-tests",
            ["Jwt:Audience"] = "cocoon-tests",
            ["Web:Origin"] = "http://localhost:3000"
        }));
        builder.ConfigureServices(services =>
        {
            services.AddControllers().AddApplicationPart(typeof(PolicyProbeController).Assembly);
            // Policy tests sign tokens for account 1 without a database row; DB-backed tests re-register DbAccountGate.
            services.AddScoped<IAccountGate, AllowAllAccountGate>();
        });
    }

    private sealed class AllowAllAccountGate : IAccountGate
    {
        public Task<bool> IsAllowedAsync(int accountId, string role, CancellationToken cancellationToken = default) => Task.FromResult(true);
    }

    public static string Token(string role)
    {
        var token = new JwtSecurityToken("cocoon-tests", "cocoon-tests",
            [new Claim("sub", "1"), new Claim("role", role)],
            expires: DateTime.UtcNow.AddMinutes(5),
            signingCredentials: new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(TestKey)), SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

[ApiController]
[Route("test-only/admin")]
public sealed class PolicyProbeController : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = "RequireAdmin")]
    public IActionResult Get() => Ok();
}
