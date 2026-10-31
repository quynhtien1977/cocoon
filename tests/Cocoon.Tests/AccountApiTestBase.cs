using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Cocoon.Api.Auth;
using Cocoon.Domain.Entities;
using Cocoon.Domain.Enums;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Cocoon.Tests;

public abstract class AccountApiTestBase : IAsyncLifetime
{
    protected readonly DemoSeedDatabaseFixture Database = new();
    protected WebApplicationFactory<Program> Factory = null!;
    protected const string Password = "AccountTest123!";

    public async Task InitializeAsync()
    {
        await Database.InitializeAsync();
        await using var db = Database.CreateContext();
        var connection = db.Database.GetConnectionString();
        Factory = new FoundationFactory().WithWebHostBuilder(builder => builder
            .UseSetting("ConnectionStrings:Default", connection)
            .ConfigureServices(services => services.AddScoped<IAccountGate, DbAccountGate>()));
    }

    public async Task DisposeAsync()
    {
        await Factory.DisposeAsync();
        await Database.DisposeAsync();
    }

    protected async Task<int> Actor(AccountRole role, string name = "Nguyễn Tiến An")
    {
        await using var db = Database.CreateContext();
        var account = new Account { Email = $"{Guid.NewGuid():N}@example.test", Role = role };
        account.PasswordHash = new PasswordHasher<Account>().HashPassword(account, Password);
        if (role == AccountRole.Customer)
            db.Add(new CustomerProfile { Account = account, FullName = name, FullNameNormalized = Cocoon.Domain.SearchText.Normalize(name) });
        else db.Add(new StaffProfile { Account = account, FullName = name });
        await db.SaveChangesAsync();
        return account.Id;
    }

    protected async Task<HttpResponseMessage> Send(HttpMethod method, string path, string? role = null, int id = 0, object? body = null)
    {
        using var client = Factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });
        using var request = new HttpRequestMessage(method, path);
        if (role is not null) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", FoundationFactory.Token(role, id));
        if (body is not null) request.Content = JsonContent.Create(body);
        return await client.SendAsync(request);
    }

    protected static async Task<JsonElement> Json(HttpResponseMessage response)
    {
        Assert.True(response.IsSuccessStatusCode, $"HTTP {(int)response.StatusCode}");
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).Clone();
    }

    protected static async Task Problem(HttpResponseMessage response, HttpStatusCode status, string code)
    {
        Assert.Equal(status, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(code, json.GetProperty("code").GetString());
    }
}
