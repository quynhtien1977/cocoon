using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Cocoon.Api.Auth;
using Cocoon.Domain.Entities;
using Cocoon.Domain.Enums;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Cocoon.Tests;

/// <summary>Website orders (decision 13/11/2026): place, confirm, receive, cancel, then review, against cocoon_tests.</summary>
public sealed class OrdersApiTests : IClassFixture<DatabaseFixture>, IDisposable
{
    private const string Address = "12 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh";
    private readonly DatabaseFixture _database;
    private readonly WebApplicationFactory<Program> _factory;

    public OrdersApiTests(DatabaseFixture database)
    {
        _database = database;
        _factory = new FoundationFactory().WithWebHostBuilder(builder => builder
            .UseSetting("ConnectionStrings:Default", database.ConnectionString)
            .ConfigureServices(services => services.AddScoped<IAccountGate, DbAccountGate>()));
    }

    public void Dispose() => _factory.Dispose();

    [Fact]
    public async Task Customer_buys_staff_confirms_customer_receives_and_then_reviews()
    {
        var shop = await Seed();
        var (customer, staff, manager) = (Token("Customer", shop.CustomerId), Token("Staff", shop.StaffId), Token("Manager", shop.ManagerId));

        var catalog = await Json(await Send(HttpMethod.Get, $"/api/v1/shop/products?search={shop.Tag}", customer));
        var listed = Assert.Single(catalog.GetProperty("items").EnumerateArray());
        Assert.Equal(shop.ProductId, listed.GetProperty("id").GetInt32());
        Assert.Equal(99000, listed.GetProperty("minPrice").GetDecimal());
        Assert.Equal(2, listed.GetProperty("variants").GetArrayLength());
        Assert.Equal(0, (await Json(await Send(HttpMethod.Get, $"/api/v1/shop/products?search={shop.Tag}&categoryId=2147483000", customer)))
            .GetProperty("totalCount").GetInt32());

        // The client sends no price; an extra unitPrice field is ignored and the database price applies.
        using var placed = await Send(HttpMethod.Post, "/api/v1/me/orders", customer, new
        {
            items = new object[] { new { variantId = shop.SmallId, quantity = 2, unitPrice = 1 }, new { variantId = shop.LargeId, quantity = 1 } },
            shippingAddress = $"  {Address}  "
        });
        Assert.Equal(HttpStatusCode.Created, placed.StatusCode);
        var created = await Json(placed);
        var id = created.GetProperty("id").GetInt32();
        Assert.Equal($"CO-W-{id:000000}", created.GetProperty("code").GetString());
        Assert.Equal(2 * 99000 + 189000, created.GetProperty("totalAmount").GetDecimal());

        var mine = await Json(await Send(HttpMethod.Get, $"/api/v1/me/orders/{id}", customer));
        Assert.Equal("Placed", mine.GetProperty("status").GetString());
        Assert.Equal(Address, mine.GetProperty("shippingAddress").GetString());
        Assert.True(mine.GetProperty("canCancel").GetBoolean());
        Assert.False(mine.GetProperty("canConfirmReceived").GetBoolean());
        var lineId = mine.GetProperty("items")[0].GetProperty("id").GetInt32();
        await AssertProblem(await Send(HttpMethod.Post, "/api/v1/me/feedback", customer, new { orderItemId = lineId, rating = 5, content = Review }),
            HttpStatusCode.Conflict, "ORDER_NOT_COMPLETED");
        await AssertProblem(await Send(HttpMethod.Post, $"/api/v1/me/orders/{id}/received", customer), HttpStatusCode.Conflict, "INVALID_ORDER_STATUS");

        var queue = await Json(await Send(HttpMethod.Get, $"/api/v1/orders?status=placed&search={created.GetProperty("code").GetString()}", staff));
        var row = Assert.Single(queue.GetProperty("items").EnumerateArray());
        Assert.Equal("Khách mua", row.GetProperty("customerName").GetString());
        Assert.Equal(2, row.GetProperty("itemCount").GetInt32());
        var detail = await Json(await Send(HttpMethod.Get, $"/api/v1/orders/{id}", staff));
        Assert.Equal(Address, detail.GetProperty("shippingAddress").GetString());
        Assert.Equal(2, detail.GetProperty("lines").GetArrayLength());

        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Post, $"/api/v1/orders/{id}/confirm", staff)).StatusCode);
        await AssertProblem(await Send(HttpMethod.Post, $"/api/v1/orders/{id}/confirm", manager), HttpStatusCode.Conflict, "INVALID_ORDER_STATUS");
        await AssertProblem(await Send(HttpMethod.Post, $"/api/v1/me/orders/{id}/cancel", customer), HttpStatusCode.Conflict, "INVALID_ORDER_STATUS");
        Assert.True((await Json(await Send(HttpMethod.Get, $"/api/v1/me/orders/{id}", customer))).GetProperty("canConfirmReceived").GetBoolean());

        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Post, $"/api/v1/me/orders/{id}/received", customer)).StatusCode);
        await AssertProblem(await Send(HttpMethod.Post, $"/api/v1/me/orders/{id}/received", customer), HttpStatusCode.Conflict, "INVALID_ORDER_STATUS");
        var completed = await Json(await Send(HttpMethod.Get, $"/api/v1/me/orders/{id}", customer));
        Assert.Equal("Completed", completed.GetProperty("status").GetString());
        Assert.NotEqual(JsonValueKind.Null, completed.GetProperty("completedAt").ValueKind);

        var reviewable = await Json(await Send(HttpMethod.Get, "/api/v1/me/reviewable-items", customer));
        Assert.Contains(reviewable.EnumerateArray(), x => x.GetProperty("orderItemId").GetInt32() == lineId);
        Assert.Equal(HttpStatusCode.Created,
            (await Send(HttpMethod.Post, "/api/v1/me/feedback", customer, new { orderItemId = lineId, rating = 5, content = Review })).StatusCode);

        var confirmed = await Json(await Send(HttpMethod.Get, $"/api/v1/orders/{id}", manager));
        Assert.Equal("Nhân viên giao", confirmed.GetProperty("confirmedByName").GetString());
        await using var db = _database.CreateContext();
        Assert.True(await db.Set<Notification>().AnyAsync(n => n.AccountId == shop.CustomerId && n.RefType == nameof(Order) && n.RefId == id));
    }

    [Fact]
    public async Task Placing_an_order_validates_lines_address_and_products_on_sale()
    {
        var shop = await Seed();
        var customer = Token("Customer", shop.CustomerId);
        async Task Refused(object body, HttpStatusCode status, string code) =>
            await AssertProblem(await Send(HttpMethod.Post, "/api/v1/me/orders", customer, body), status, code);
        object Line(int variantId, int quantity = 1) => new { variantId, quantity };

        await Refused(new { items = Array.Empty<object>(), shippingAddress = Address }, HttpStatusCode.BadRequest, "VALIDATION_ERROR");
        await Refused(new { items = new[] { Line(shop.SmallId, 11) }, shippingAddress = Address }, HttpStatusCode.BadRequest, "VALIDATION_ERROR");
        await Refused(new { items = new[] { Line(shop.SmallId, 0) }, shippingAddress = Address }, HttpStatusCode.BadRequest, "VALIDATION_ERROR");
        await Refused(new { items = new[] { Line(shop.SmallId), Line(shop.SmallId) }, shippingAddress = Address }, HttpStatusCode.BadRequest, "VALIDATION_ERROR");
        await Refused(new { items = Enumerable.Range(0, 11).Select(i => Line(shop.SmallId + i)).ToArray(), shippingAddress = Address },
            HttpStatusCode.BadRequest, "VALIDATION_ERROR");
        await Refused(new { items = new[] { Line(shop.SmallId) }, shippingAddress = "Q1" }, HttpStatusCode.BadRequest, "VALIDATION_ERROR");
        await Refused(new { items = new[] { Line(shop.SmallId), Line(shop.InactiveId) }, shippingAddress = Address }, HttpStatusCode.Conflict, "PRODUCT_UNAVAILABLE");
        await Refused(new { items = new[] { Line(2147483000) }, shippingAddress = Address }, HttpStatusCode.Conflict, "PRODUCT_UNAVAILABLE");

        await using var db = _database.CreateContext();
        Assert.False(await db.Set<Order>().AnyAsync(o => o.CustomerId == shop.CustomerId));
    }

    [Fact]
    public async Task Only_the_owner_cancels_a_placed_order_and_each_role_keeps_to_its_endpoints()
    {
        var shop = await Seed();
        var (customer, other, staff) = (Token("Customer", shop.CustomerId), Token("Customer", shop.OtherCustomerId), Token("Staff", shop.StaffId));
        var id = (await Json(await Send(HttpMethod.Post, "/api/v1/me/orders", customer,
            new { items = new[] { new { variantId = shop.SmallId, quantity = 1 } }, shippingAddress = Address }))).GetProperty("id").GetInt32();

        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Get, $"/api/v1/me/orders/{id}", other)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Post, $"/api/v1/me/orders/{id}/cancel", other)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Post, $"/api/v1/me/orders/{id}/received", other)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Send(HttpMethod.Get, "/api/v1/orders", customer)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Send(HttpMethod.Post, $"/api/v1/orders/{id}/confirm", customer)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Send(HttpMethod.Post, "/api/v1/me/orders", staff,
            new { items = new[] { new { variantId = shop.SmallId, quantity = 1 } }, shippingAddress = Address })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Send(HttpMethod.Get, "/api/v1/shop/products", staff)).StatusCode);
        using (var anonymous = _factory.CreateClient())
            Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/v1/shop/products")).StatusCode);
        await AssertProblem(await Send(HttpMethod.Get, "/api/v1/orders?status=Shipped", staff), HttpStatusCode.BadRequest, "VALIDATION_ERROR");
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Get, "/api/v1/orders/2147483000", staff)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Post, "/api/v1/orders/2147483000/confirm", staff)).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Post, $"/api/v1/me/orders/{id}/cancel", customer)).StatusCode);
        var cancelled = await Json(await Send(HttpMethod.Get, $"/api/v1/me/orders/{id}", customer));
        Assert.Equal("Cancelled", cancelled.GetProperty("status").GetString());
        Assert.NotEqual(JsonValueKind.Null, cancelled.GetProperty("cancelledAt").ValueKind);
        Assert.False(cancelled.GetProperty("canCancel").GetBoolean());
        await AssertProblem(await Send(HttpMethod.Post, $"/api/v1/orders/{id}/confirm", staff), HttpStatusCode.Conflict, "INVALID_ORDER_STATUS");
        await AssertProblem(await Send(HttpMethod.Post, $"/api/v1/me/orders/{id}/cancel", customer), HttpStatusCode.Conflict, "INVALID_ORDER_STATUS");
    }

    private const string Review = "Sản phẩm dịu nhẹ, giao hàng nhanh, da mềm hơn sau một tuần.";

    private sealed record Shop(string Tag, int CustomerId, int OtherCustomerId, int StaffId, int ManagerId, int ProductId, int SmallId, int LargeId, int InactiveId);

    private async Task<Shop> Seed()
    {
        var tag = Guid.NewGuid().ToString("N")[..10];
        await using var db = _database.CreateContext();
        Account Account(AccountRole role) => new() { Email = $"{role}-{Guid.NewGuid():N}@cocoon.demo", Role = role };
        var (customer, other, staff, manager) = (Account(AccountRole.Customer), Account(AccountRole.Customer), Account(AccountRole.Staff), Account(AccountRole.Manager));
        db.AddRange(new CustomerProfile { Account = customer, FullName = "Khách mua" }, new CustomerProfile { Account = other, FullName = "Khách khác" },
            new StaffProfile { Account = staff, FullName = "Nhân viên giao" }, new StaffProfile { Account = manager, FullName = "Quản lý" });
        var category = new Category { Name = $"Danh mục {tag}" };
        db.Add(category);
        await db.SaveChangesAsync();
        var onSale = new Product { Name = $"Sữa rửa mặt {tag}", NameNormalized = $"sua rua mat {tag}", CategoryId = category.Id };
        var stopped = new Product { Name = $"Ngừng bán {tag}", NameNormalized = $"ngung ban {tag}", CategoryId = category.Id, Status = ProductStatus.Inactive };
        db.AddRange(onSale, stopped);
        await db.SaveChangesAsync();
        var (small, large, inactive) = (new ProductVariant { ProductId = onSale.Id, Name = "140ml", Sku = $"S-{tag}", Price = 99000 },
            new ProductVariant { ProductId = onSale.Id, Name = "310ml", Sku = $"L-{tag}", Price = 189000 },
            new ProductVariant { ProductId = stopped.Id, Name = "100ml", Sku = $"X-{tag}", Price = 50000 });
        db.AddRange(small, large, inactive);
        await db.SaveChangesAsync();
        return new Shop(tag, customer.Id, other.Id, staff.Id, manager.Id, onSale.Id, small.Id, large.Id, inactive.Id);
    }

    private static string Token(string role, int id) => FoundationFactory.Token(role, id);

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
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.Equal(code, problem!.Extensions["code"]?.ToString());
    }
}
