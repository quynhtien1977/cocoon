using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Cocoon.Api.Auth;
using Cocoon.Domain.Entities;
using Cocoon.Domain.Enums;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace Cocoon.Tests;

/// <summary>M11/M12 product APIs against cocoon_tests. Each test seeds its own category so filters isolate its rows.</summary>
public sealed class ProductsApiTests : IClassFixture<DatabaseFixture>, IDisposable
{
    private readonly DatabaseFixture _database;
    private readonly WebApplicationFactory<Program> _factory;

    public ProductsApiTests(DatabaseFixture database)
    {
        _database = database;
        _factory = new FoundationFactory().WithWebHostBuilder(builder => builder
            .UseSetting("ConnectionStrings:Default", database.ConnectionString)
            .ConfigureServices(services => services.AddScoped<IAccountGate, DbAccountGate>()));
    }

    public void Dispose() => _factory.Dispose();

    [Fact]
    public async Task List_returns_rating_tags_and_filters_by_category_tag_status_and_sku()
    {
        var shop = await Seed();
        var manager = FoundationFactory.Token("Manager", shop.ManagerId);

        var list = await Json(await Send(HttpMethod.Get, $"/api/v1/products?categoryId={shop.CategoryId}&pageSize=100", manager));
        Assert.Equal(2, list.GetProperty("totalCount").GetInt32());
        var tagged = list.GetProperty("items").EnumerateArray().Single(x => x.GetProperty("id").GetInt32() == shop.TaggedId);
        Assert.Equal(shop.Sku, tagged.GetProperty("sku").GetString());
        Assert.Equal([shop.PreferenceName], tagged.GetProperty("preferences").EnumerateArray().Select(x => x.GetString()));
        Assert.Equal(4.5, tagged.GetProperty("averageRating").GetDouble());
        Assert.Equal(2, tagged.GetProperty("feedbackCount").GetInt32());
        Assert.Equal("Active", tagged.GetProperty("status").GetString());

        var untagged = await Json(await Send(HttpMethod.Get, $"/api/v1/products?categoryId={shop.CategoryId}&untagged=true", manager));
        var row = Assert.Single(untagged.GetProperty("items").EnumerateArray());
        Assert.Equal(shop.UntaggedId, row.GetProperty("id").GetInt32());
        Assert.Equal(JsonValueKind.Null, row.GetProperty("averageRating").ValueKind);

        var bySku = await Json(await Send(HttpMethod.Get, $"/api/v1/products?search={shop.Sku.ToLowerInvariant()}", manager));
        Assert.Equal([shop.TaggedId], bySku.GetProperty("items").EnumerateArray().Select(x => x.GetProperty("id").GetInt32()));
        var upcoming = await Json(await Send(HttpMethod.Get, $"/api/v1/products?categoryId={shop.CategoryId}&status=Upcoming", manager));
        Assert.Equal(shop.UntaggedId, Assert.Single(upcoming.GetProperty("items").EnumerateArray()).GetProperty("id").GetInt32());
        Assert.Equal(HttpStatusCode.BadRequest, (await Send(HttpMethod.Get, "/api/v1/products?status=Sold", manager)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await Send(HttpMethod.Get, "/api/v1/products", FoundationFactory.Token("Customer", shop.CustomerId))).StatusCode);
    }

    [Fact]
    public async Task Status_and_preferences_are_saved_and_insights_sum_to_the_feedback_count()
    {
        var shop = await Seed();
        var manager = FoundationFactory.Token("Manager", shop.ManagerId);

        Assert.Equal(HttpStatusCode.NoContent,
            (await Send(HttpMethod.Patch, $"/api/v1/products/{shop.TaggedId}/status", manager, new { status = "Inactive" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await Send(HttpMethod.Patch, $"/api/v1/products/{shop.TaggedId}/status", manager, new { status = "Sold" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await Send(HttpMethod.Patch, "/api/v1/products/999999/status", manager, new { status = "Active" })).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Put, $"/api/v1/products/{shop.TaggedId}/preferences", manager,
            new { preferenceIds = new[] { shop.OtherPreferenceId, shop.OtherPreferenceId } })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Send(HttpMethod.Put, $"/api/v1/products/{shop.TaggedId}/preferences", manager,
            new { preferenceIds = new[] { 999999 } })).StatusCode);
        var detail = await Json(await Send(HttpMethod.Get, $"/api/v1/products/{shop.TaggedId}", manager));
        Assert.Equal("Inactive", detail.GetProperty("status").GetString());
        Assert.Equal([shop.OtherPreferenceId], detail.GetProperty("preferenceIds").EnumerateArray().Select(x => x.GetInt32()));

        var insights = await Json(await Send(HttpMethod.Get, $"/api/v1/products/{shop.TaggedId}/insights", manager));
        Assert.Equal(2, insights.GetProperty("totalFeedback").GetInt32());
        Assert.Equal(4.5, insights.GetProperty("averageRating").GetDouble());
        Assert.Equal([(5, 1), (4, 1)], insights.GetProperty("ratingDistribution").EnumerateArray()
            .Select(x => (x.GetProperty("rating").GetInt32(), x.GetProperty("count").GetInt32())));
        var empty = await Json(await Send(HttpMethod.Get, $"/api/v1/products/{shop.UntaggedId}/insights", manager));
        Assert.Equal(0, empty.GetProperty("totalFeedback").GetInt32());
        Assert.Equal(JsonValueKind.Null, empty.GetProperty("averageRating").ValueKind);
    }

    private sealed record Shop(int ManagerId, int CustomerId, int CategoryId, int TaggedId, int UntaggedId, string Sku,
        string PreferenceName, int OtherPreferenceId);

    private async Task<Shop> Seed()
    {
        var tag = Guid.NewGuid().ToString("N")[..10];
        await using var db = _database.CreateContext();
        var manager = new Account { Email = $"manager-{tag}@cocoon.demo", Role = AccountRole.Manager };
        var customer = new Account { Email = $"customer-{tag}@cocoon.demo", Role = AccountRole.Customer };
        var (preference, other) = (new Preference { Name = $"Da dầu {tag}" }, new Preference { Name = $"Da khô {tag}" });
        var category = new Category { Name = $"Danh mục {tag}" };
        db.AddRange(new StaffProfile { Account = manager, FullName = "Quản lý" }, new CustomerProfile { Account = customer, FullName = "Khách" },
            preference, other, category);
        await db.SaveChangesAsync();
        var tagged = new Product { Name = $"Gel bí đao {tag}", NameNormalized = $"gel bi dao {tag}", CategoryId = category.Id };
        var untagged = new Product { Name = $"Kem sen {tag}", NameNormalized = $"kem sen {tag}", CategoryId = category.Id, Status = ProductStatus.Upcoming };
        db.AddRange(tagged, untagged);
        await db.SaveChangesAsync();
        var sku = $"SKU-{tag}".ToUpperInvariant();
        db.AddRange(new ProductVariant { ProductId = tagged.Id, Name = "140ml", Sku = sku, Price = 145000 },
            new ProductPreference { ProductId = tagged.Id, PreferenceId = preference.Id },
            new Feedback { CustomerId = customer.Id, ProductId = tagged.Id, Rating = 5, Content = "Rất thích" },
            new Feedback { CustomerId = customer.Id, ProductId = tagged.Id, Rating = 4, Content = "Khá tốt" });
        await db.SaveChangesAsync();
        return new Shop(manager.Id, customer.Id, category.Id, tagged.Id, untagged.Id, sku, preference.Name, other.Id);
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
