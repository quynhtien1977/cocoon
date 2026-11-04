using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Cocoon.Api.Auth;
using Cocoon.Domain.Entities;
using Cocoon.Domain.Enums;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Cocoon.Tests;

/// <summary>
/// COC-44 against cocoon_tests. Each test owns fresh preferences, so other rows in the shared database stay under the
/// 0.25 threshold for its customer: they can earn at most Rating 0.10 + Plan 0.10.
/// </summary>
public sealed class RecommendationsApiTests : IClassFixture<DatabaseFixture>, IDisposable
{
    private readonly DatabaseFixture _database;
    private readonly WebApplicationFactory<Program> _factory;

    public RecommendationsApiTests(DatabaseFixture database)
    {
        _database = database;
        _factory = new FoundationFactory().WithWebHostBuilder(builder => builder
            .UseSetting("ConnectionStrings:Default", database.ConnectionString)
            .ConfigureServices(services => services.AddScoped<IAccountGate, DbAccountGate>()));
    }

    public void Dispose() => _factory.Dispose();

    [Fact]
    public async Task Saving_preferences_recommends_matching_products_and_dismiss_keeps_them_out()
    {
        var shop = await Seed();
        var customer = FoundationFactory.Token("Customer", shop.CustomerId);

        Assert.Equal(HttpStatusCode.NoContent,
            (await Send(HttpMethod.Put, "/api/v1/me/preferences", customer, new { preferenceIds = new[] { shop.PreferenceId } })).StatusCode);
        var items = await Json(await Send(HttpMethod.Get, "/api/v1/me/recommendations", customer));
        var item = Assert.Single(items.EnumerateArray());
        Assert.Equal(shop.TaggedId, item.GetProperty("product").GetProperty("id").GetInt32());
        Assert.Equal(145000, item.GetProperty("product").GetProperty("minPrice").GetDecimal());
        Assert.Equal(0.35m, item.GetProperty("score").GetDecimal());
        Assert.Equal($"Hợp với sở thích {shop.PreferenceName}", item.GetProperty("reasons")[0].GetProperty("label").GetString());
        var home = await Json(await Send(HttpMethod.Get, "/api/v1/me/home", customer));
        Assert.Equal(1, home.GetProperty("recommendations").GetArrayLength());

        var id = item.GetProperty("id").GetInt32();
        Assert.Equal(HttpStatusCode.NotFound,
            (await Send(HttpMethod.Post, $"/api/v1/me/recommendations/{id}/click", FoundationFactory.Token("Customer", shop.OtherCustomerId))).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Post, $"/api/v1/me/recommendations/{id}/click", customer)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Post, $"/api/v1/me/recommendations/{id}/dismiss", customer)).StatusCode);
        Assert.Equal(0, (await Json(await Send(HttpMethod.Get, "/api/v1/me/recommendations", customer))).GetArrayLength());

        // Rebuilding again must not bring back a product dismissed in the last 90 days.
        await Send(HttpMethod.Put, "/api/v1/me/preferences", customer, new { preferenceIds = new[] { shop.PreferenceId } });
        Assert.Equal(0, (await Json(await Send(HttpMethod.Get, "/api/v1/me/recommendations", customer))).GetArrayLength());
        var tab = await Json(await Send(HttpMethod.Get, $"/api/v1/customers/{shop.CustomerId}/recommendations", FoundationFactory.Token("Manager", shop.ManagerId)));
        var row = Assert.Single(tab.EnumerateArray());
        Assert.Equal("Dismissed", row.GetProperty("status").GetString());
        Assert.Equal(0.3m, row.GetProperty("breakdown").GetProperty("preference").GetDecimal());
    }

    [Fact]
    public async Task Plan_lifecycle_notifies_the_segment_and_adds_then_removes_the_plan_boost()
    {
        var shop = await Seed();
        var manager = FoundationFactory.Token("Manager", shop.ManagerId);
        var customer = FoundationFactory.Token("Customer", shop.CustomerId);
        await Send(HttpMethod.Put, "/api/v1/me/preferences", customer, new { preferenceIds = new[] { shop.PreferenceId } });
        var segment = new { preferenceIds = new[] { shop.PreferenceId } };
        var body = new { name = "Ra mắt", goal = (string?)null, startAt = DateTime.UtcNow.AddDays(-1), endAt = DateTime.UtcNow.AddDays(30), segment, productIds = new[] { shop.HalfTaggedId } };

        Assert.Equal(HttpStatusCode.BadRequest, (await Send(HttpMethod.Post, "/api/v1/recommendation-plans", manager,
            body with { productIds = Array.Empty<int>() })).StatusCode);
        var created = await Json(await Send(HttpMethod.Post, "/api/v1/recommendation-plans", manager, body));
        var id = created.GetProperty("id").GetInt32();
        Assert.Equal("Draft", created.GetProperty("status").GetString());
        Assert.Equal(1, created.GetProperty("recipientCount").GetInt32());
        Assert.Equal(JsonValueKind.Null, created.GetProperty("clickRate").ValueKind);
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Put, $"/api/v1/recommendation-plans/{id}", manager, body with { name = "Ra mắt gel" })).StatusCode);
        Assert.DoesNotContain(await ProductIds(customer), x => x == shop.HalfTaggedId);

        var run = await Json(await Send(HttpMethod.Post, $"/api/v1/recommendation-plans/{id}/activate", manager));
        Assert.Equal(1, run.GetProperty("audienceCount").GetInt32());
        Assert.Contains(shop.HalfTaggedId, await ProductIds(customer));
        await using (var db = _database.CreateContext())
            Assert.Equal(1, await db.Set<Notification>().CountAsync(n => n.RefType == nameof(RecommendationPlan) && n.RefId == id));
        Assert.Equal(HttpStatusCode.Conflict, (await Send(HttpMethod.Put, $"/api/v1/recommendation-plans/{id}", manager, body)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Send(HttpMethod.Post, $"/api/v1/recommendation-plans/{id}/activate", manager)).StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Post, $"/api/v1/recommendation-plans/{id}/end", manager)).StatusCode);
        Assert.DoesNotContain(await ProductIds(customer), x => x == shop.HalfTaggedId);
        var plan = await Json(await Send(HttpMethod.Get, $"/api/v1/recommendation-plans/{id}", manager));
        Assert.Equal("Ended", plan.GetProperty("status").GetString());
        Assert.Equal(0, plan.GetProperty("clickRate").GetDouble());

        var draft = await Json(await Send(HttpMethod.Post, "/api/v1/recommendation-plans", manager, body));
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Delete, $"/api/v1/recommendation-plans/{draft.GetProperty("id").GetInt32()}", manager)).StatusCode);
        var rebuild = await Json(await Send(HttpMethod.Post, "/api/v1/recommendations/rebuild", manager));
        Assert.True(rebuild.GetProperty("customerCount").GetInt32() >= 2);
        Assert.Equal(HttpStatusCode.Forbidden, (await Send(HttpMethod.Post, "/api/v1/recommendations/rebuild", customer)).StatusCode);
    }

    private async Task<List<int>> ProductIds(string customer) =>
        (await Json(await Send(HttpMethod.Get, "/api/v1/me/recommendations", customer))).EnumerateArray()
        .Select(x => x.GetProperty("product").GetProperty("id").GetInt32()).ToList();

    private sealed record Shop(int ManagerId, int CustomerId, int OtherCustomerId, int PreferenceId, string PreferenceName, int TaggedId, int HalfTaggedId);

    /// <summary>Tagged scores 0.30 + neutral rating 0.05; HalfTagged scores 0.15 + 0.05 and needs a plan to pass 0.25.</summary>
    private async Task<Shop> Seed()
    {
        var tag = Guid.NewGuid().ToString("N")[..10];
        await using var db = _database.CreateContext();
        Account Account(AccountRole role) => new() { Email = $"{role}-{Guid.NewGuid():N}@cocoon.demo", Role = role };
        var (manager, customer, other) = (Account(AccountRole.Manager), Account(AccountRole.Customer), Account(AccountRole.Customer));
        var (preference, second) = (new Preference { Name = $"Da dầu {tag}" }, new Preference { Name = $"Da khô {tag}" });
        var category = new Category { Name = $"Danh mục {tag}" };
        db.AddRange(new StaffProfile { Account = manager, FullName = "Quản lý" }, new CustomerProfile { Account = customer, FullName = "Khách A" },
            new CustomerProfile { Account = other, FullName = "Khách B" }, preference, second, category);
        await db.SaveChangesAsync();
        Product Product(string name, ProductStatus status = ProductStatus.Active) =>
            new() { Name = $"{name} {tag}", NameNormalized = $"{name} {tag}", CategoryId = category.Id, Status = status };
        var (tagged, half, upcoming) = (Product("Gel"), Product("Toner"), Product("Kem", ProductStatus.Upcoming));
        db.AddRange(tagged, half, upcoming);
        await db.SaveChangesAsync();
        db.AddRange(new ProductVariant { ProductId = tagged.Id, Name = "140ml", Sku = $"G-{tag}", Price = 145000 },
            new ProductPreference { ProductId = tagged.Id, PreferenceId = preference.Id },
            new ProductPreference { ProductId = half.Id, PreferenceId = preference.Id },
            new ProductPreference { ProductId = half.Id, PreferenceId = second.Id },
            new ProductPreference { ProductId = upcoming.Id, PreferenceId = preference.Id });
        await db.SaveChangesAsync();
        return new Shop(manager.Id, customer.Id, other.Id, preference.Id, preference.Name, tagged.Id, half.Id);
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
}
