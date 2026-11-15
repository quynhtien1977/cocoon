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
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Cocoon.Tests;

/// <summary>Optional photos and YouTube videos on survey questions (decision 15/11/2026), with MinIO replaced in memory.</summary>
public sealed class SurveyMediaApiTests : IClassFixture<DatabaseFixture>, IDisposable
{
    private static readonly byte[] Jpeg = [0xFF, 0xD8, 0xFF, 0xE0, 1, 2, 3, 4];
    private static readonly byte[] Png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 9, 9];
    private const string Video = "https://youtu.be/dQw4w9WgXcQ?si=x";
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
    public async Task Text_only_surveys_stay_valid_and_videos_need_no_upload()
    {
        var shop = await Seed();
        var manager = FoundationFactory.Token("Manager", shop.ManagerId);
        var plain = await Json(await Send(HttpMethod.Post, "/api/v1/surveys", manager, Draft(Question("Bạn chấm mấy sao?"))));
        Assert.Empty(plain.GetProperty("questions")[0].GetProperty("media").EnumerateArray());

        var withVideo = await Json(await Send(HttpMethod.Post, "/api/v1/surveys", manager,
            Draft(Question("Xem video rồi chấm điểm", new { type = "Video", videoUrl = Video }))));
        var media = Assert.Single(withVideo.GetProperty("questions")[0].GetProperty("media").EnumerateArray());
        Assert.Equal("Video", media.GetProperty("type").GetString());
        Assert.Equal("dQw4w9WgXcQ", media.GetProperty("youtubeVideoId").GetString());
        Assert.Equal("https://www.youtube.com/watch?v=dQw4w9WgXcQ", media.GetProperty("videoUrl").GetString());
        Assert.Equal(JsonValueKind.Null, media.GetProperty("url").ValueKind);
        Assert.Empty(_storage.Objects);
    }

    [Fact]
    public async Task Manager_puts_several_photos_and_a_video_on_a_question_and_only_recipients_see_them()
    {
        var shop = await Seed();
        var manager = FoundationFactory.Token("Manager", shop.ManagerId);
        var id = (await Json(await Send(HttpMethod.Post, "/api/v1/surveys", manager, Draft(Question("Bạn thích mẫu nào?"))))).GetProperty("id").GetInt32();
        var first = await Json(await Upload(id, manager, "a.png", "image/png", Png));
        var second = await Json(await Upload(id, manager, "b.jpg", "image/jpeg", Jpeg));
        var (firstId, secondId) = (first.GetProperty("id").GetInt32(), second.GetProperty("id").GetInt32());

        var saved = await Json(await Send(HttpMethod.Put, $"/api/v1/surveys/{id}", manager, Draft(Question("Bạn thích mẫu nào?",
            new { type = "Image", imageId = secondId }, new { type = "Image", imageId = firstId }, new { type = "Video", videoUrl = Video }))));
        var media = saved.GetProperty("questions")[0].GetProperty("media").EnumerateArray().ToList();
        Assert.Equal(["Image", "Image", "Video"], media.Select(m => m.GetProperty("type").GetString()));
        Assert.Equal([secondId, firstId], media.Take(2).Select(m => m.GetProperty("imageId").GetInt32()));
        var url = media[0].GetProperty("url").GetString()!;
        Assert.Equal(second.GetProperty("url").GetString(), url);
        using (var read = await Send(HttpMethod.Get, url, manager))
        {
            Assert.Equal(HttpStatusCode.OK, read.StatusCode);
            Assert.Equal("image/jpeg", read.Content.Headers.ContentType!.MediaType);
            Assert.Equal(Jpeg, await read.Content.ReadAsByteArrayAsync());
        }

        var customer = FoundationFactory.Token("Customer", shop.CustomerId);
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Get, url, customer)).StatusCode);  // draft, not sent
        Assert.Equal(HttpStatusCode.Forbidden, (await Send(HttpMethod.Get, url, FoundationFactory.Token("Staff", shop.StaffId))).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Post, $"/api/v1/surveys/{id}/publish", manager)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Post, $"/api/v1/surveys/{id}/recipients", manager, new { customerIds = new[] { shop.CustomerId } })).StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Get, url, customer)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Get, url, FoundationFactory.Token("Customer", shop.OtherCustomerId))).StatusCode);
        var mine = await Json(await Send(HttpMethod.Get, $"/api/v1/me/surveys/{id}", customer));
        var shown = mine.GetProperty("questions")[0].GetProperty("media").EnumerateArray().ToList();
        Assert.Equal([url, first.GetProperty("url").GetString(), null], shown.Select(m => m.GetProperty("url").GetString()));
        Assert.Equal("dQw4w9WgXcQ", shown[2].GetProperty("youtubeVideoId").GetString());
        Assert.False(mine.TryGetProperty("imageUrl", out _));  // no survey-level cover any more

        // A sent survey keeps the media it was sent with.
        await AssertProblem(await Upload(id, manager, "c.png", "image/png", Png), HttpStatusCode.Conflict, "SURVEY_NOT_DRAFT");
    }

    [Fact]
    public async Task Bad_files_foreign_photos_and_too_much_media_are_refused()
    {
        var shop = await Seed();
        var manager = FoundationFactory.Token("Manager", shop.ManagerId);
        var id = (await Json(await Send(HttpMethod.Post, "/api/v1/surveys", manager, Draft(Question("Câu 1"))))).GetProperty("id").GetInt32();
        var other = (await Json(await Send(HttpMethod.Post, "/api/v1/surveys", manager, Draft(Question("Câu 1"))))).GetProperty("id").GetInt32();
        Assert.Equal(HttpStatusCode.BadRequest, (await Upload(id, manager, "fake.jpg", "image/jpeg", "not an image"u8.ToArray())).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Upload(id, manager, "big.png", "image/png", [.. Png, .. new byte[2 * 1024 * 1024]])).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Upload(id, FoundationFactory.Token("Staff", shop.StaffId), "a.png", "image/png", Png)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Upload(2147483000, manager, "a.png", "image/png", Png)).StatusCode);
        var foreign = (await Json(await Upload(other, manager, "a.png", "image/png", Png))).GetProperty("id").GetInt32();
        var mine = (await Json(await Upload(id, manager, "a.png", "image/png", Png))).GetProperty("id").GetInt32();

        async Task Refused(object body, string path) =>
            await AssertProblem(await Send(path == "create" ? HttpMethod.Post : HttpMethod.Put, path == "create" ? "/api/v1/surveys" : $"/api/v1/surveys/{id}", manager, body),
                HttpStatusCode.BadRequest, "VALIDATION_ERROR");
        await Refused(Draft(Question("Câu 1", new { type = "Image", imageId = mine })), "create");  // photos need a saved draft
        await Refused(Draft(Question("Câu 1", new { type = "Image", imageId = foreign })), "update");
        await Refused(Draft(Question("Câu 1", new { type = "Image" })), "update");
        await Refused(Draft(Question("Câu 1", new { type = "Video", videoUrl = "https://vimeo.com/1" })), "update");
        await Refused(Draft(Question("Câu 1", Enumerable.Repeat<object>(new { type = "Video", videoUrl = Video }, 7).ToArray())), "update");
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Put, $"/api/v1/surveys/{id}", manager,
            Draft(Question("Câu 1", Enumerable.Repeat<object>(new { type = "Image", imageId = mine }, 6).ToArray())))).StatusCode);
    }

    [Fact]
    public async Task Saving_the_draft_removes_old_photos_no_question_uses()
    {
        var shop = await Seed();
        var manager = FoundationFactory.Token("Manager", shop.ManagerId);
        var id = (await Json(await Send(HttpMethod.Post, "/api/v1/surveys", manager, Draft(Question("Câu 1"))))).GetProperty("id").GetInt32();
        var kept = (await Json(await Upload(id, manager, "a.png", "image/png", Png))).GetProperty("id").GetInt32();
        var dropped = (await Json(await Upload(id, manager, "b.png", "image/png", Png))).GetProperty("id").GetInt32();
        var fresh = (await Json(await Upload(id, manager, "c.png", "image/png", Png))).GetProperty("id").GetInt32();
        await using (var db = _database.CreateContext())
            await db.Set<SurveyImage>().Where(i => i.Id == kept || i.Id == dropped)
                .ExecuteUpdateAsync(s => s.SetProperty(i => i.CreatedAt, i => i.CreatedAt.AddHours(-1)));

        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Put, $"/api/v1/surveys/{id}", manager,
            Draft(Question("Câu 1", new { type = "Image", imageId = kept })))).StatusCode);
        await using (var db = _database.CreateContext())
            Assert.Equal([kept, fresh], await db.Set<SurveyImage>().Where(i => i.SurveyId == id).OrderBy(i => i.Id).Select(i => i.Id).ToListAsync());
        Assert.Equal(2, _storage.Objects.Count);  // the dropped photo left storage; the fresh one may still be in a form
    }

    private static object Question(string text, params object[] media) =>
        new { text, type = "Rating", isRequired = true, options = Array.Empty<object>(), media };

    private static object Draft(object question) => new
    {
        title = "Ý kiến về bao bì mới", description = "Xem ảnh rồi trả lời giúp Cocoon.", purpose = "Satisfaction",
        productId = (int?)null, openAt = (DateTime?)null, closeAt = DateTime.UtcNow.AddDays(7), questions = new[] { question },
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
        using var request = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/surveys/{surveyId}/images") { Content = form };
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
