using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Cocoon.Api.Auth;
using Cocoon.Api.Controllers;
using Cocoon.Application.Storage;
using Cocoon.Domain.Entities;
using Cocoon.Domain.Enums;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace Cocoon.Tests;

/// <summary>Feedback photos against cocoon_tests with an in-memory object store in place of MinIO.</summary>
public sealed class FeedbackPhotosApiTests : IClassFixture<DatabaseFixture>, IDisposable
{
    private static readonly byte[] Jpeg = [0xFF, 0xD8, 0xFF, 0xE0, 1, 2, 3, 4];
    private static readonly byte[] Png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 9, 9];
    private readonly DatabaseFixture _database;
    private readonly MemoryStorage _storage = new();
    private readonly WebApplicationFactory<Program> _factory;

    public FeedbackPhotosApiTests(DatabaseFixture database)
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

    [Fact]
    public async Task Owner_uploads_photos_that_only_owner_manager_and_assigned_staff_can_read()
    {
        var shop = await Seed();
        var owner = FoundationFactory.Token("Customer", shop.CustomerId);

        using var created = await Upload(shop.FeedbackId, owner, ("a.jpg", "image/jpeg", Jpeg), ("b.png", "image/png", Png));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var photos = (await created.Content.ReadFromJsonAsync<JsonElement>()).EnumerateArray().ToList();
        Assert.Equal(2, photos.Count);
        Assert.Equal(2, _storage.Objects.Count);
        var url = photos[0].GetProperty("url").GetString()!;

        using var read = await Send(HttpMethod.Get, url, owner);
        Assert.Equal(HttpStatusCode.OK, read.StatusCode);
        Assert.Equal("image/jpeg", read.Content.Headers.ContentType!.MediaType);
        Assert.Equal(Jpeg, await read.Content.ReadAsByteArrayAsync());
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Get, url, FoundationFactory.Token("Manager", shop.ManagerId))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Get, url, FoundationFactory.Token("Staff", shop.StaffId))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Get, url, FoundationFactory.Token("Staff", shop.OtherStaffId))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Get, url, FoundationFactory.Token("Customer", shop.OtherCustomerId))).StatusCode);

        var mine = await Json(await Send(HttpMethod.Get, $"/api/v1/me/feedback/{shop.FeedbackId}", owner));
        Assert.Equal(photos.Select(p => p.GetProperty("url").GetString()), mine.GetProperty("photos").EnumerateArray().Select(p => p.GetProperty("url").GetString()));
        var inbox = await Json(await Send(HttpMethod.Get, $"/api/v1/feedback/{shop.FeedbackId}", FoundationFactory.Token("Manager", shop.ManagerId)));
        Assert.Equal(2, inbox.GetProperty("photos").GetArrayLength());
    }

    [Fact]
    public async Task Upload_rejects_fake_images_too_many_photos_strangers_and_closed_feedback()
    {
        var shop = await Seed();
        var owner = FoundationFactory.Token("Customer", shop.CustomerId);

        // Declared as JPEG but the bytes are text: the content decides.
        Assert.Equal(HttpStatusCode.BadRequest, (await Upload(shop.FeedbackId, owner, ("x.jpg", "image/jpeg", "not an image"u8.ToArray()))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Upload(shop.FeedbackId, owner,
            Enumerable.Range(0, 6).Select(i => ($"{i}.jpg", "image/jpeg", Jpeg)).ToArray())).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Upload(shop.FeedbackId, owner,
            ("big.jpg", "image/jpeg", [.. Jpeg, .. new byte[FeedbackPhotosController.MaxBytes]]))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await Upload(shop.FeedbackId, FoundationFactory.Token("Customer", shop.OtherCustomerId), ("a.jpg", "image/jpeg", Jpeg))).StatusCode);
        Assert.Empty(_storage.Objects);

        await using (var db = _database.CreateContext())
        {
            (await db.Set<Feedback>().FindAsync(shop.FeedbackId))!.Status = FeedbackStatus.Closed;
            await db.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.Conflict, (await Upload(shop.FeedbackId, owner, ("a.jpg", "image/jpeg", Jpeg))).StatusCode);
    }

    [Fact]
    public async Task Owner_deletes_a_photo_until_the_feedback_is_closed()
    {
        var shop = await Seed();
        var owner = FoundationFactory.Token("Customer", shop.CustomerId);
        using var created = await Upload(shop.FeedbackId, owner, ("a.jpg", "image/jpeg", Jpeg), ("b.png", "image/png", Png));
        var ids = (await created.Content.ReadFromJsonAsync<JsonElement>()).EnumerateArray().Select(p => p.GetProperty("id").GetInt32()).ToList();

        Assert.Equal(HttpStatusCode.NotFound,
            (await Send(HttpMethod.Delete, $"/api/v1/me/feedback/photos/{ids[0]}", FoundationFactory.Token("Customer", shop.OtherCustomerId))).StatusCode);
        var left = await Json(await Send(HttpMethod.Delete, $"/api/v1/me/feedback/photos/{ids[0]}", owner));
        Assert.Equal([ids[1]], left.EnumerateArray().Select(p => p.GetProperty("id").GetInt32()));
        Assert.Single(_storage.Objects);
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Get, $"/api/v1/feedback-photos/{ids[0]}", owner)).StatusCode);

        await using (var db = _database.CreateContext())
        {
            (await db.Set<Feedback>().FindAsync(shop.FeedbackId))!.Status = FeedbackStatus.Closed;
            await db.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.Conflict, (await Send(HttpMethod.Delete, $"/api/v1/me/feedback/photos/{ids[1]}", owner)).StatusCode);
    }

    [Theory]
    [InlineData(new byte[] { 0xFF, 0xD8, 0xFF, 0xDB }, "image/jpeg")]
    [InlineData(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }, "image/png")]
    [InlineData(new byte[] { 0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50 }, "image/webp")]
    [InlineData(new byte[] { 0x47, 0x49, 0x46, 0x38, 0x39, 0x61 }, null)]
    public void Sniff_recognises_only_jpeg_png_and_webp(byte[] head, string? expected) =>
        Assert.Equal(expected, FeedbackPhotosController.Sniff(head));

    private sealed record Shop(int CustomerId, int OtherCustomerId, int ManagerId, int StaffId, int OtherStaffId, int FeedbackId);

    private async Task<Shop> Seed()
    {
        var tag = Guid.NewGuid().ToString("N")[..10];
        await using var db = _database.CreateContext();
        Account Account(AccountRole role) => new() { Email = $"{role}-{Guid.NewGuid():N}@cocoon.demo", Role = role };
        var (customer, other, manager, staff, otherStaff) = (Account(AccountRole.Customer), Account(AccountRole.Customer),
            Account(AccountRole.Manager), Account(AccountRole.Staff), Account(AccountRole.Staff));
        var category = new Category { Name = $"Danh mục {tag}" };
        db.AddRange(new CustomerProfile { Account = customer, FullName = "Khách A" }, new CustomerProfile { Account = other, FullName = "Khách B" },
            new StaffProfile { Account = manager, FullName = "Quản lý" }, new StaffProfile { Account = staff, FullName = "Nhân viên A" },
            new StaffProfile { Account = otherStaff, FullName = "Nhân viên B" }, category);
        await db.SaveChangesAsync();
        var product = new Product { Name = $"Gel {tag}", NameNormalized = $"gel {tag}", CategoryId = category.Id };
        db.Add(product);
        await db.SaveChangesAsync();
        var feedback = new Feedback
        {
            CustomerId = customer.Id, ProductId = product.Id, Rating = 2, Content = "Da hơi khô sau một tuần dùng sản phẩm.",
            Status = FeedbackStatus.Assigned, AssignedStaffId = staff.Id
        };
        db.Add(feedback);
        await db.SaveChangesAsync();
        return new Shop(customer.Id, other.Id, manager.Id, staff.Id, otherStaff.Id, feedback.Id);
    }

    private async Task<HttpResponseMessage> Upload(int feedbackId, string token, params (string Name, string Type, byte[] Bytes)[] files)
    {
        using var form = new MultipartFormDataContent();
        foreach (var (name, type, bytes) in files)
        {
            var part = new ByteArrayContent(bytes);
            part.Headers.ContentType = new MediaTypeHeaderValue(type);
            form.Add(part, "photos", name);
        }
        using var client = _factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/me/feedback/{feedbackId}/photos") { Content = form };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return await client.SendAsync(request);
    }

    private async Task<HttpResponseMessage> Send(HttpMethod method, string path, string token)
    {
        using var client = _factory.CreateClient();
        using var request = new HttpRequestMessage(method, path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return await client.SendAsync(request);
    }

    private static async Task<JsonElement> Json(HttpResponseMessage response)
    {
        Assert.True(response.IsSuccessStatusCode, $"{(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        return await response.Content.ReadFromJsonAsync<JsonElement>();
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
