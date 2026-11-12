using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Cocoon.Api.Auth;
using Cocoon.Domain.Entities;
using Cocoon.Domain.Enums;
using Cocoon.Infrastructure.Feedbacks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Cocoon.Tests;

/// <summary>Customer portal (COC-22), customer feedback (COC-27) and feedback processing (COC-28) against cocoon_tests.</summary>
public sealed class FeedbackApiTests : IClassFixture<DatabaseFixture>, IDisposable
{
    private readonly DatabaseFixture _database;
    private readonly WebApplicationFactory<Program> _factory;

    public FeedbackApiTests(DatabaseFixture database)
    {
        _database = database;
        _factory = new FoundationFactory().WithWebHostBuilder(builder => builder
            .UseSetting("ConnectionStrings:Default", database.ConnectionString)
            .ConfigureServices(services => services.AddScoped<IAccountGate, DbAccountGate>()));
    }

    public void Dispose() => _factory.Dispose();

    [Fact]
    public async Task Customer_reviews_a_completed_line_once_and_sees_it_on_orders_and_home()
    {
        var shop = await Seed();
        var customer = FoundationFactory.Token("Customer", shop.CustomerId);

        var reviewable = await Json(await Send(HttpMethod.Get, "/api/v1/me/reviewable-items", customer));
        Assert.Equal([shop.CompletedItemId], reviewable.EnumerateArray().Select(x => x.GetProperty("orderItemId").GetInt32()));
        var home = await Json(await Send(HttpMethod.Get, "/api/v1/me/home", customer));
        Assert.Equal(1, home.GetProperty("reviewableItems").GetArrayLength());
        Assert.Equal(0, home.GetProperty("recommendations").GetArrayLength());

        await AssertProblem(await Send(HttpMethod.Post, "/api/v1/me/feedback", customer,
            new { orderItemId = shop.CompletedItemId, rating = 5, content = "Quá ngắn" }), HttpStatusCode.BadRequest, "VALIDATION_ERROR");
        await AssertProblem(await Send(HttpMethod.Post, "/api/v1/me/feedback", customer,
            new { orderItemId = shop.CancelledItemId, rating = 4, content = Review }), HttpStatusCode.Conflict, "ORDER_NOT_COMPLETED");
        await AssertProblem(await Send(HttpMethod.Post, "/api/v1/me/feedback", customer,
            new { orderItemId = shop.OtherCustomerItemId, rating = 4, content = Review }), HttpStatusCode.NotFound, "NOT_FOUND");

        using var created = await Send(HttpMethod.Post, "/api/v1/me/feedback", customer, new { orderItemId = shop.CompletedItemId, rating = 4, content = Review });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var feedbackId = (await Json(created)).GetProperty("id").GetInt32();
        await AssertProblem(await Send(HttpMethod.Post, "/api/v1/me/feedback", customer,
            new { orderItemId = shop.CompletedItemId, rating = 4, content = Review }), HttpStatusCode.Conflict, "FEEDBACK_ALREADY_EXISTS");

        Assert.Equal(0, (await Json(await Send(HttpMethod.Get, "/api/v1/me/reviewable-items", customer))).GetArrayLength());
        var orders = await Json(await Send(HttpMethod.Get, "/api/v1/me/orders?page=1&pageSize=20", customer));
        Assert.Equal(2, orders.GetProperty("totalCount").GetInt32());
        var line = orders.GetProperty("items").EnumerateArray().SelectMany(o => o.GetProperty("items").EnumerateArray())
            .Single(i => i.GetProperty("id").GetInt32() == shop.CompletedItemId);
        Assert.Equal(feedbackId, line.GetProperty("review").GetProperty("id").GetInt32());

        var detail = await Json(await Send(HttpMethod.Get, $"/api/v1/me/feedback/{feedbackId}", customer));
        Assert.Equal("New", detail.GetProperty("status").GetString());
        Assert.Equal(0, detail.GetProperty("replies").GetArrayLength());
        var product = await Json(await Send(HttpMethod.Get, $"/api/v1/products/{shop.ProductId}", customer));
        Assert.Equal(4, product.GetProperty("averageRating").GetDouble());
        Assert.Equal(1, product.GetProperty("feedbackCount").GetInt32());

        var stranger = FoundationFactory.Token("Customer", shop.OtherCustomerId);
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Get, $"/api/v1/me/feedback/{feedbackId}", stranger)).StatusCode);
    }

    [Fact]
    public async Task Staff_list_is_manager_only_and_holds_only_staff()
    {
        var shop = await Seed();
        var staff = await Json(await Send(HttpMethod.Get, "/api/v1/staff", FoundationFactory.Token("Manager", shop.ManagerId)));
        var ids = staff.EnumerateArray().Select(x => x.GetProperty("id").GetInt32()).ToList();
        Assert.Contains(shop.StaffId, ids);
        Assert.DoesNotContain(shop.ManagerId, ids);
        using var denied = await Send(HttpMethod.Get, "/api/v1/staff", FoundationFactory.Token("Staff", shop.StaffId));
        Assert.Equal(HttpStatusCode.Forbidden, denied.StatusCode);
    }

    [Fact]
    public async Task Feedback_moves_forward_through_accept_assign_reply_close()
    {
        var shop = await Seed();
        var (manager, staff, otherStaff) = (FoundationFactory.Token("Manager", shop.ManagerId),
            FoundationFactory.Token("Staff", shop.StaffId), FoundationFactory.Token("Staff", shop.OtherStaffId));
        using var created = await Send(HttpMethod.Post, "/api/v1/me/feedback", FoundationFactory.Token("Customer", shop.CustomerId),
            new { orderItemId = shop.CompletedItemId, rating = 2, content = Review });
        var id = (await Json(created)).GetProperty("id").GetInt32();

        await AssertProblem(await Send(HttpMethod.Post, $"/api/v1/feedback/{id}/assign", manager, new { staffId = shop.StaffId }),
            HttpStatusCode.Conflict, "INVALID_FEEDBACK_STATUS");
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Post, $"/api/v1/feedback/{id}/accept", manager)).StatusCode);
        await AssertProblem(await Send(HttpMethod.Post, $"/api/v1/feedback/{id}/accept", manager), HttpStatusCode.Conflict, "INVALID_FEEDBACK_STATUS");
        await AssertProblem(await Send(HttpMethod.Post, $"/api/v1/feedback/{id}/assign", manager, new { staffId = shop.ManagerId }),
            HttpStatusCode.BadRequest, "VALIDATION_ERROR");
        Assert.Equal(HttpStatusCode.NoContent,
            (await Send(HttpMethod.Post, $"/api/v1/feedback/{id}/assign", manager, new { staffId = shop.StaffId })).StatusCode);

        var mine = await Json(await Send(HttpMethod.Get, "/api/v1/staff/feedback", staff));
        Assert.Contains(id, mine.GetProperty("items").EnumerateArray().Select(x => x.GetProperty("id").GetInt32()));
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Get, $"/api/v1/feedback/{id}", otherStaff)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await Send(HttpMethod.Post, $"/api/v1/feedback/{id}/replies", otherStaff, new { content = "Cảm ơn bạn đã góp ý." })).StatusCode);
        await AssertProblem(await Send(HttpMethod.Post, $"/api/v1/feedback/{id}/close", manager), HttpStatusCode.Conflict, "INVALID_FEEDBACK_STATUS");

        using var reply = await Send(HttpMethod.Post, $"/api/v1/feedback/{id}/replies", staff, new { content = "Cocoon xin lỗi và sẽ đổi sản phẩm cho bạn." });
        Assert.Equal(HttpStatusCode.Created, reply.StatusCode);
        Assert.Equal("Nhân viên A", (await Json(reply)).GetProperty("staffName").GetString());
        await AssertProblem(await Send(HttpMethod.Post, $"/api/v1/feedback/{id}/replies", staff, new { content = "Trả lời thêm lần nữa." }),
            HttpStatusCode.Conflict, "INVALID_FEEDBACK_STATUS");
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Post, $"/api/v1/feedback/{id}/close", manager)).StatusCode);

        var inbox = await Json(await Send(HttpMethod.Get, $"/api/v1/feedback?status=Closed&productId={shop.ProductId}", manager));
        var row = inbox.GetProperty("items").EnumerateArray().Single(x => x.GetProperty("id").GetInt32() == id);
        Assert.Equal("Nhân viên A", row.GetProperty("assigneeName").GetString());
        Assert.True(row.GetProperty("verifiedPurchase").GetBoolean());
        var detail = await Json(await Send(HttpMethod.Get, $"/api/v1/feedback/{id}", manager));
        Assert.Equal(["New", "Accepted", "Assigned", "Replied", "Closed"],
            detail.GetProperty("statusTimes").EnumerateObject().Select(x => x.Name));

        var customerView = await Json(await Send(HttpMethod.Get, $"/api/v1/me/feedback/{id}", FoundationFactory.Token("Customer", shop.CustomerId)));
        Assert.Equal("Closed", customerView.GetProperty("status").GetString());
        Assert.Equal(1, customerView.GetProperty("replies").GetArrayLength());
        await using var db = _database.CreateContext();
        Assert.Equal(1, await db.Set<FeedbackAssignment>().CountAsync(a => a.FeedbackId == id));
    }

    [Fact]
    public async Task Follow_up_returns_feedback_to_its_staff_and_the_second_reply_closes_it()
    {
        var shop = await Seed();
        var (customer, staff, otherStaff, manager) = (FoundationFactory.Token("Customer", shop.CustomerId), FoundationFactory.Token("Staff", shop.StaffId),
            FoundationFactory.Token("Staff", shop.OtherStaffId), FoundationFactory.Token("Manager", shop.ManagerId));
        var id = await RepliedFeedback(shop);

        var replied = await Json(await Send(HttpMethod.Get, $"/api/v1/me/feedback/{id}", customer));
        Assert.True(replied.GetProperty("canFollowUp").GetBoolean());
        var deadline = replied.GetProperty("autoCloseAt").GetDateTime();
        Assert.InRange(deadline, DateTime.UtcNow.AddDays(7).AddMinutes(-5), DateTime.UtcNow.AddDays(7).AddMinutes(5));
        Assert.Equal(1, replied.GetProperty("replies")[0].GetProperty("round").GetInt32());

        await AssertProblem(await Send(HttpMethod.Post, $"/api/v1/me/feedback/{id}/follow-up", customer, new { content = "Quá ngắn" }),
            HttpStatusCode.BadRequest, "VALIDATION_ERROR");
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Post, $"/api/v1/me/feedback/{id}/follow-up",
            FoundationFactory.Token("Customer", shop.OtherCustomerId), new { content = FollowUp })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Post, $"/api/v1/me/feedback/{id}/follow-up", customer, new { content = FollowUp })).StatusCode);
        await AssertProblem(await Send(HttpMethod.Post, $"/api/v1/me/feedback/{id}/follow-up", customer, new { content = FollowUp }),
            HttpStatusCode.Conflict, "FOLLOW_UP_NOT_ALLOWED");

        var waiting = await Json(await Send(HttpMethod.Get, $"/api/v1/feedback/{id}", staff));
        Assert.Equal("Assigned", waiting.GetProperty("status").GetString());
        Assert.Equal(FollowUp, waiting.GetProperty("followUp").GetProperty("content").GetString());
        Assert.Equal(JsonValueKind.Null, waiting.GetProperty("autoCloseAt").ValueKind);
        Assert.False((await Json(await Send(HttpMethod.Get, $"/api/v1/me/feedback/{id}", customer))).GetProperty("canFollowUp").GetBoolean());
        await AssertProblem(await Send(HttpMethod.Post, $"/api/v1/feedback/{id}/close", manager), HttpStatusCode.Conflict, "INVALID_FEEDBACK_STATUS");
        Assert.Equal(HttpStatusCode.NotFound,
            (await Send(HttpMethod.Post, $"/api/v1/feedback/{id}/replies", otherStaff, new { content = "Nhân viên khác trả lời." })).StatusCode);

        using var second = await Send(HttpMethod.Post, $"/api/v1/feedback/{id}/replies", staff, new { content = "Cocoon đã gửi sản phẩm thay thế cho bạn." });
        Assert.Equal(HttpStatusCode.Created, second.StatusCode);
        Assert.Equal(2, (await Json(second)).GetProperty("round").GetInt32());
        await AssertProblem(await Send(HttpMethod.Post, $"/api/v1/feedback/{id}/replies", staff, new { content = "Trả lời lần thứ ba." }),
            HttpStatusCode.Conflict, "INVALID_FEEDBACK_STATUS");

        var closed = await Json(await Send(HttpMethod.Get, $"/api/v1/me/feedback/{id}", customer));
        Assert.Equal("Closed", closed.GetProperty("status").GetString());
        Assert.Equal([1, 2], closed.GetProperty("replies").EnumerateArray().Select(r => r.GetProperty("round").GetInt32()));
        Assert.Equal(FollowUp, closed.GetProperty("followUp").GetProperty("content").GetString());
        Assert.False(closed.GetProperty("canFollowUp").GetBoolean());
        await AssertProblem(await Send(HttpMethod.Post, $"/api/v1/me/feedback/{id}/follow-up", customer, new { content = FollowUp }),
            HttpStatusCode.Conflict, "FOLLOW_UP_NOT_ALLOWED");
        await using var db = _database.CreateContext();
        Assert.Equal(2, await db.Set<Notification>().CountAsync(n => n.RefType == nameof(Feedback) && n.RefId == id));
    }

    [Fact]
    public async Task Follow_up_is_refused_before_a_reply_and_after_the_deadline()
    {
        var shop = await Seed();
        var customer = FoundationFactory.Token("Customer", shop.CustomerId);
        using var created = await Send(HttpMethod.Post, "/api/v1/me/feedback", customer, new { orderItemId = shop.CompletedItemId, rating = 3, content = Review });
        var fresh = (await Json(created)).GetProperty("id").GetInt32();
        await AssertProblem(await Send(HttpMethod.Post, $"/api/v1/me/feedback/{fresh}/follow-up", customer, new { content = FollowUp }),
            HttpStatusCode.Conflict, "FOLLOW_UP_NOT_ALLOWED");

        await using var db = _database.CreateContext();
        var id = await RepliedFeedback(shop, db);
        var due = DateTime.UtcNow.AddMinutes(-1);
        await db.Set<Feedback>().Where(f => f.Id == id).ExecuteUpdateAsync(s => s.SetProperty(f => f.AutoCloseAt, due));
        await AssertProblem(await Send(HttpMethod.Post, $"/api/v1/me/feedback/{id}/follow-up", customer, new { content = FollowUp }),
            HttpStatusCode.Conflict, "FOLLOW_UP_NOT_ALLOWED");
        Assert.False((await Json(await Send(HttpMethod.Get, $"/api/v1/me/feedback/{id}", customer))).GetProperty("canFollowUp").GetBoolean());

        // The hosted sweep may get there first; either way the feedback ends Closed at its deadline.
        await FeedbackAutoClose.CloseExpiredAsync(db, DateTime.UtcNow, CancellationToken.None);
        var row = await db.Set<Feedback>().AsNoTracking().SingleAsync(f => f.Id == id);
        Assert.Equal(FeedbackStatus.Closed, row.Status);
        Assert.Equal(due, row.ClosedAt!.Value, TimeSpan.FromMilliseconds(1));
    }

    [Fact]
    public async Task Sweep_closes_only_replied_feedback_past_its_deadline()
    {
        var shop = await Seed();
        await using var db = _database.CreateContext();
        var past = DateTime.UtcNow.AddDays(-1);
        Feedback Add(FeedbackStatus status, DateTime? autoCloseAt) => new()
        {
            CustomerId = shop.CustomerId, ProductId = shop.ProductId, Rating = 4, Content = Review, Status = status, AutoCloseAt = autoCloseAt,
            FollowUpContent = status == FeedbackStatus.Assigned ? FollowUp : null, FollowUpAt = status == FeedbackStatus.Assigned ? past : null
        };
        var (due, later, legacy, waiting) = (Add(FeedbackStatus.Replied, past), Add(FeedbackStatus.Replied, DateTime.UtcNow.AddDays(2)),
            Add(FeedbackStatus.Replied, null), Add(FeedbackStatus.Assigned, past));
        db.AddRange(due, later, legacy, waiting);
        await db.SaveChangesAsync();

        await FeedbackAutoClose.CloseExpiredAsync(db, DateTime.UtcNow, CancellationToken.None);
        var statuses = await db.Set<Feedback>().AsNoTracking().Where(f => new[] { due.Id, later.Id, legacy.Id, waiting.Id }.Contains(f.Id))
            .ToDictionaryAsync(f => f.Id, f => f.Status);
        Assert.Equal(FeedbackStatus.Closed, statuses[due.Id]);
        Assert.Equal(FeedbackStatus.Replied, statuses[later.Id]);
        Assert.Equal(FeedbackStatus.Replied, statuses[legacy.Id]);
        Assert.Equal(FeedbackStatus.Assigned, statuses[waiting.Id]);
    }

    [Fact]
    public async Task Manager_moves_the_deadline_of_replied_feedback_only()
    {
        var shop = await Seed();
        var manager = FoundationFactory.Token("Manager", shop.ManagerId);
        var id = await RepliedFeedback(shop);
        var path = $"/api/v1/feedback/{id}/auto-close";

        Assert.Equal(HttpStatusCode.Forbidden, (await Send(HttpMethod.Put, path, FoundationFactory.Token("Staff", shop.StaffId), new { days = 3 })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Send(HttpMethod.Put, path, FoundationFactory.Token("Customer", shop.CustomerId), new { days = 3 })).StatusCode);
        await AssertProblem(await Send(HttpMethod.Put, path, manager, new { days = 0 }), HttpStatusCode.BadRequest, "VALIDATION_ERROR");
        await AssertProblem(await Send(HttpMethod.Put, path, manager, new { days = 31 }), HttpStatusCode.BadRequest, "VALIDATION_ERROR");

        var moved = (await Json(await Send(HttpMethod.Put, path, manager, new { days = 3 }))).GetProperty("autoCloseAt").GetDateTime();
        Assert.InRange(moved, DateTime.UtcNow.AddDays(3).AddMinutes(-5), DateTime.UtcNow.AddDays(3).AddMinutes(5));
        var detail = await Json(await Send(HttpMethod.Get, $"/api/v1/feedback/{id}", manager));
        Assert.Equal(moved, detail.GetProperty("autoCloseAt").GetDateTime(), TimeSpan.FromMilliseconds(1));

        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Post, $"/api/v1/feedback/{id}/close", manager)).StatusCode);
        await AssertProblem(await Send(HttpMethod.Put, path, manager, new { days = 3 }), HttpStatusCode.Conflict, "INVALID_FEEDBACK_STATUS");
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Put, "/api/v1/feedback/2147483000/auto-close", manager, new { days = 3 })).StatusCode);
    }

    /// <summary>Creates the customer's feedback and walks it to Replied through the API.</summary>
    private async Task<int> RepliedFeedback(Shop shop, Cocoon.Infrastructure.Persistence.AppDbContext? db = null)
    {
        var (manager, staff) = (FoundationFactory.Token("Manager", shop.ManagerId), FoundationFactory.Token("Staff", shop.StaffId));
        int id;
        if (db is null)
        {
            using var created = await Send(HttpMethod.Post, "/api/v1/me/feedback", FoundationFactory.Token("Customer", shop.CustomerId),
                new { orderItemId = shop.CompletedItemId, rating = 2, content = Review });
            id = (await Json(created)).GetProperty("id").GetInt32();
        }
        else
        {
            // The order line is already reviewed; a feedback without an order line walks the same path.
            var feedback = new Feedback { CustomerId = shop.CustomerId, ProductId = shop.ProductId, Rating = 2, Content = Review };
            db.Add(feedback);
            await db.SaveChangesAsync();
            id = feedback.Id;
        }
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Post, $"/api/v1/feedback/{id}/accept", manager)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Post, $"/api/v1/feedback/{id}/assign", manager, new { staffId = shop.StaffId })).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await Send(HttpMethod.Post, $"/api/v1/feedback/{id}/replies", staff, new { content = "Cocoon xin lỗi và sẽ hỗ trợ bạn." })).StatusCode);
        return id;
    }

    private const string Review = "Sản phẩm dịu nhẹ, da mềm hơn sau một tuần sử dụng.";
    private const string FollowUp = "Mình đã nhận phản hồi nhưng sản phẩm thay thế vẫn chưa tới, nhờ Cocoon kiểm tra giúp.";

    private sealed record Shop(int CustomerId, int OtherCustomerId, int StaffId, int OtherStaffId, int ManagerId, int ProductId,
        int CompletedItemId, int CancelledItemId, int OtherCustomerItemId);

    private async Task<Shop> Seed()
    {
        var tag = Guid.NewGuid().ToString("N")[..10];
        await using var db = _database.CreateContext();
        Account Account(AccountRole role) => new() { Email = $"{role}-{Guid.NewGuid():N}@cocoon.demo", Role = role };
        var (customer, other) = (Account(AccountRole.Customer), Account(AccountRole.Customer));
        var (staff, otherStaff, manager) = (Account(AccountRole.Staff), Account(AccountRole.Staff), Account(AccountRole.Manager));
        db.AddRange(new CustomerProfile { Account = customer, FullName = "Khách A" }, new CustomerProfile { Account = other, FullName = "Khách B" },
            new StaffProfile { Account = staff, FullName = "Nhân viên A" }, new StaffProfile { Account = otherStaff, FullName = "Nhân viên B" },
            new StaffProfile { Account = manager, FullName = "Quản lý" });
        var category = new Category { Name = $"Danh mục {tag}" };
        db.Add(category);
        await db.SaveChangesAsync();
        var product = new Product { Name = $"Gel bí đao {tag}", NameNormalized = $"gel bi dao {tag}", CategoryId = category.Id };
        db.Add(product);
        await db.SaveChangesAsync();
        var variant = new ProductVariant { ProductId = product.Id, Name = "140ml", Sku = $"SKU-{tag}", Price = 145000 };
        db.Add(variant);
        await db.SaveChangesAsync();

        OrderItem Line(int customerId, OrderStatus status, int index)
        {
            var order = new Order { Code = $"T{tag}{index}", CustomerId = customerId, Status = status, TotalAmount = 145000 };
            db.Add(order);
            db.SaveChanges();
            var item = new OrderItem { OrderId = order.Id, ProductVariantId = variant.Id, Quantity = 1, UnitPrice = 145000 };
            db.Add(item);
            db.SaveChanges();
            return item;
        }
        var (completed, cancelled, foreign) = (Line(customer.Id, OrderStatus.Completed, 1), Line(customer.Id, OrderStatus.Cancelled, 2),
            Line(other.Id, OrderStatus.Completed, 3));
        return new Shop(customer.Id, other.Id, staff.Id, otherStaff.Id, manager.Id, product.Id, completed.Id, cancelled.Id, foreign.Id);
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
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.Equal(code, problem!.Extensions["code"]?.ToString());
    }
}
