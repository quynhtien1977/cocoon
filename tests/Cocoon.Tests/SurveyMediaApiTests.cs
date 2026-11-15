using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Cocoon.Api.Auth;
using Cocoon.Application.Storage;
using Cocoon.Domain;
using Cocoon.Domain.Entities;
using Cocoon.Domain.Enums;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace Cocoon.Tests;

/// <summary>Survey cover photo and YouTube preview (decision 15/11/2026) against cocoon_tests, with MinIO replaced in memory.</summary>
public sealed class SurveyMediaApiTests : IClassFixture<DatabaseFixture>, IDisposable
{
    private static readonly byte[] Jpeg = [0xFF, 0xD8, 0xFF, 0xE0, 1, 2, 3, 4];
    private static readonly byte[] Png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 9, 9];
    private readonly DatabaseFixture _database;
    private readonly MemoryStorage _storage = new();
    private readonly WebApplicationFactory<Program> _factory;

    public SurveyMediaApiTests(DatabaseFixture database)
    {
        _database = database;
        _factory = new FoundationFactory().WithWebHostBuilder(builder => builder
            .UseSetting("ConnectionStrings:Default", database.ConnectionString)
            .ConfigureServices(services =>
            {
                services.AddScoped<IAccountGate, DbAccountGate>();
                services.AddSingleton<IObjectStorage>(_storage);
            }));
    }

    public void Dispose() => _factory.Dispose();

    [Theory]
    [InlineData("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s")]
    [InlineData("https://youtu.be/dQw4w9WgXcQ?si=abc")]
    [InlineData("https://m.youtube.com/shorts/dQw4w9WgXcQ")]
    [InlineData("http://youtube.com/embed/dQw4w9WgXcQ")]
    [InlineData("https://www.youtube.com/live/dQw4w9WgXcQ")]
    [InlineData(" dQw4w9WgXcQ ")]
    public void Youtube_links_people_paste_give_the_video_id(string link) => Assert.Equal("dQw4w9WgXcQ", YoutubeLink.VideoId(link));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("https://vimeo.com/123456")]
    [InlineData("https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ")]
    [InlineData("https://user:pass@youtube.com/watch?v=dQw4w9WgXcQ")]
    [InlineData("javascript:alert(1)")]
    [InlineData("https://www.youtube.com/watch?v=short")]
    [InlineData("https://www.youtube.com/channel/dQw4w9WgXcQ")]
    [InlineData("ftp://youtu.be/dQw4w9WgXcQ")]
    public void Anything_else_is_rejected(string? link) => Assert.Null(YoutubeLink.VideoId(link));

    [Fact]
    public async Task Manager_sets_photo_and_video_on_a_draft_and_only_recipients_see_them_once_sent()
    {
        var shop = await Seed();
        var manager = FoundationFactory.Token("Manager", shop.ManagerId);
        Assert.Equal(HttpStatusCode.BadRequest, (await Send(HttpMethod.Post, "/api/v1/surveys", manager, Draft("https://vimeo.com/1"))).StatusCode);
        var survey = await Json(await Send(HttpMethod.Post, "/api/v1/surveys", manager, Draft("https://youtu.be/dQw4w9WgXcQ?si=x")));
        var id = survey.GetProperty("id").GetInt32();
        Assert.Equal("dQw4w9WgXcQ", survey.GetProperty("youtubeVideoId").GetString());
        Assert.Equal("https://www.youtube.com/watch?v=dQw4w9WgXcQ", survey.GetProperty("videoUrl").GetString());
        Assert.Equal(JsonValueKind.Null, survey.GetProperty("imageUrl").ValueKind);

        Assert.Equal(HttpStatusCode.BadRequest, (await Upload(id, manager, "fake.jpg", "image/jpeg", "not an image"u8.ToArray())).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Upload(id, manager, "big.png", "image/png", [.. Png, .. new byte[2 * 1024 * 1024]])).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Upload(id, FoundationFactory.Token("Staff", shop.StaffId), "a.png", "image/png", Png)).StatusCode);
        var first = (await Json(await Upload(id, manager, "a.png", "image/png", Png))).GetProperty("imageUrl").GetString()!;
        var second = (await Json(await Upload(id, manager, "b.jpg", "image/jpeg", Jpeg))).GetProperty("imageUrl").GetString()!;
        Assert.NotEqual(first, second);
        Assert.Single(_storage.Objects);  // replacing the photo removes the old object
        using (var read = await Send(HttpMethod.Get, second, manager))
        {
            Assert.Equal(HttpStatusCode.OK, read.StatusCode);
            Assert.Equal("image/jpeg", read.Content.Headers.ContentType!.MediaType);
            Assert.Equal(Jpeg, await read.Content.ReadAsByteArrayAsync());
        }
        Assert.Equal(second, (await Json(await Send(HttpMethod.Get, $"/api/v1/surveys/{id}", manager))).GetProperty("imageUrl").GetString());

        var customer = FoundationFactory.Token("Customer", shop.CustomerId);
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Get, second, customer)).StatusCode);  // draft, not sent
        Assert.Equal(HttpStatusCode.Forbidden, (await Send(HttpMethod.Get, second, FoundationFactory.Token("Staff", shop.StaffId))).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Post, $"/api/v1/surveys/{id}/publish", manager)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Post, $"/api/v1/surveys/{id}/recipients", manager, new { customerIds = new[] { shop.CustomerId } })).StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Get, second, customer)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Get, second, FoundationFactory.Token("Customer", shop.OtherCustomerId))).StatusCode);
        var mine = await Json(await Send(HttpMethod.Get, $"/api/v1/me/surveys/{id}", customer));
        Assert.Equal(second, mine.GetProperty("imageUrl").GetString());
        Assert.Equal("dQw4w9WgXcQ", mine.GetProperty("youtubeVideoId").GetString());

        // Published surveys keep the media they were sent with.
        await AssertProblem(await Upload(id, manager, "c.png", "image/png", Png), HttpStatusCode.Conflict, "SURVEY_NOT_DRAFT");
        await AssertProblem(await Send(HttpMethod.Delete, $"/api/v1/surveys/{id}/image", manager), HttpStatusCode.Conflict, "SURVEY_NOT_DRAFT");
        Assert.Single(_storage.Objects);
    }

    [Fact]
    public async Task Removing_the_photo_or_clearing_the_link_leaves_a_plain_draft()
    {
        var shop = await Seed();
        var manager = FoundationFactory.Token("Manager", shop.ManagerId);
        var id = (await Json(await Send(HttpMethod.Post, "/api/v1/surveys", manager, Draft("dQw4w9WgXcQ")))).GetProperty("id").GetInt32();
        await Json(await Upload(id, manager, "a.png", "image/png", Png));
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Delete, $"/api/v1/surveys/{id}/image", manager)).StatusCode);
        Assert.Empty(_storage.Objects);
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Delete, $"/api/v1/surveys/{id}/image", manager)).StatusCode);
        var updated = await Json(await Send(HttpMethod.Put, $"/api/v1/surveys/{id}", manager, Draft("")));
        Assert.Equal(JsonValueKind.Null, updated.GetProperty("imageUrl").ValueKind);
        Assert.Equal(JsonValueKind.Null, updated.GetProperty("youtubeVideoId").ValueKind);
        Assert.Equal(HttpStatusCode.NotFound, (await Upload(2147483000, manager, "a.png", "image/png", Png)).StatusCode);
    }

    private static object Draft(string? videoUrl) => new
    {
        title = "Trải nghiệm gel bí đao", description = "Xem video rồi trả lời giúp Cocoon.", purpose = "Satisfaction",
        productId = (int?)null, openAt = (DateTime?)null, closeAt = DateTime.UtcNow.AddDays(7), videoUrl,
        questions = new[] { new { text = "Bạn chấm sản phẩm mấy sao?", type = "Rating", isRequired = true, options = Array.Empty<object>() } },
    };

    private sealed record Shop(int ManagerId, int StaffId, int CustomerId, int OtherCustomerId);

    private async Task<Shop> Seed()
    {
        await using var db = _database.CreateContext();
        Account Account(AccountRole role) => new() { Email = $"{role}-{Guid.NewGuid():N}@cocoon.demo", Role = role };
        var (manager, staff, customer, other) = (Account(AccountRole.Manager), Account(AccountRole.Staff), Account(AccountRole.Customer), Account(AccountRole.Customer));
        db.AddRange(new StaffProfile { Account = manager, FullName = "Quản lý" }, new StaffProfile { Account = staff, FullName = "Nhân viên" },
            new CustomerProfile { Account = customer, FullName = "Khách nhận" }, new CustomerProfile { Account = other, FullName = "Khách khác" });
        await db.SaveChangesAsync();
        return new Shop(manager.Id, staff.Id, customer.Id, other.Id);
    }

    private async Task<HttpResponseMessage> Upload(int surveyId, string token, string name, string type, byte[] bytes)
    {
        using var form = new MultipartFormDataContent();
        var part = new ByteArrayContent(bytes);
        part.Headers.ContentType = new MediaTypeHeaderValue(type);
        form.Add(part, "image", name);
        using var client = _factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/surveys/{surveyId}/image") { Content = form };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return await client.SendAsync(request);
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

    private sealed class MemoryStorage : IObjectStorage
    {
        public ConcurrentDictionary<string, byte[]> Objects { get; } = new();

        public async Task PutAsync(string key, Stream content, long size, string contentType, CancellationToken ct)
        {
            using var copy = new MemoryStream();
            await content.CopyToAsync(copy, ct);
            Objects[key] = copy.ToArray();
        }

        public async Task<bool> CopyToAsync(string key, Stream destination, CancellationToken ct)
        {
            if (!Objects.TryGetValue(key, out var bytes)) return false;
            await destination.WriteAsync(bytes, ct);
            return true;
        }

        public Task DeleteAsync(string key, CancellationToken ct)
        {
            Objects.TryRemove(key, out _);
            return Task.CompletedTask;
        }
    }
}
