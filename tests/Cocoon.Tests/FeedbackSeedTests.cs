using Cocoon.Domain.Entities;
using Cocoon.Domain.Enums;
using Cocoon.Infrastructure.Seeding;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Cocoon.Tests;

public sealed class FeedbackSeedTests(DemoSeedDatabaseFixture database) : IClassFixture<DemoSeedDatabaseFixture>
{
    private static readonly DateTime ReferenceUtc = new(2026, 10, 31, 0, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task Rerun_preserves_feedback_replies_history_and_data_created_outside_seed()
    {
        await using var db = database.CreateContext();
        await using var transaction = await db.Database.BeginTransactionAsync();
        await new DemoDataSeeder(db, _ => "test-hash", ReferenceUtc).RunAsync(includeFeedback: true);
        var feedback = await db.Set<Feedback>().FirstAsync(f => f.Status == FeedbackStatus.Closed);
        feedback.Content = "Khách đã cập nhật nội dung phản hồi sau khi được hỗ trợ.";
        feedback.Rating = 2;
        var reply = await db.Set<FeedbackReply>().FirstAsync();
        reply.Content = "Nhân viên đã cập nhật câu trả lời thực tế.";
        // Missing history is deliberately preserved too; rerun must not repair user changes.
        db.Remove(await db.Set<FeedbackAssignment>().FirstAsync());
        var item = await db.Set<OrderItem>().FirstAsync(i => !db.Set<Feedback>().Any(f => f.OrderItemId == i.Id));
        var order = await db.Set<Order>().SingleAsync(o => o.Id == item.OrderId);
        var variant = await db.Set<ProductVariant>().SingleAsync(v => v.Id == item.ProductVariantId);
        db.Add(new Feedback { CustomerId = order.CustomerId, ProductId = variant.ProductId, OrderItemId = item.Id,
            Content = "Phản hồi do người dùng tự tạo ngoài bộ seed demo.", Rating = 4 });
        var staff = await db.Set<Account>().SingleAsync(a => a.Email == "staff1@cocoon.demo");
        staff.IsActive = false;
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear(); // Compare database values at PostgreSQL's microsecond precision.
        var before = JsonSerializer.Serialize(new {
            Feedback = await db.Set<Feedback>().OrderBy(f => f.Id).ToListAsync(),
            Assignments = await db.Set<FeedbackAssignment>().OrderBy(a => a.Id).ToListAsync(),
            Replies = await db.Set<FeedbackReply>().OrderBy(r => r.Id).ToListAsync() });
        db.ChangeTracker.Clear();

        var added = await new DemoDataSeeder(db, _ => throw new InvalidOperationException("Không được hash lại."),
            ReferenceUtc.AddDays(7)).RunAsync(includeFeedback: true);

        Assert.Equal(0, added);
        Assert.Equal(61, await db.Set<Feedback>().CountAsync());
        Assert.Equal(before, JsonSerializer.Serialize(new {
            Feedback = await db.Set<Feedback>().OrderBy(f => f.Id).ToListAsync(),
            Assignments = await db.Set<FeedbackAssignment>().OrderBy(a => a.Id).ToListAsync(),
            Replies = await db.Set<FeedbackReply>().OrderBy(r => r.Id).ToListAsync() }));
        Assert.False((await db.Set<Account>().SingleAsync(a => a.Id == staff.Id)).IsActive);
    }

    [Fact]
    public async Task Invalid_purchase_after_first_insert_rolls_back_the_whole_v2_run()
    {
        var isolated = new DemoSeedDatabaseFixture();
        await isolated.InitializeAsync();
        try
        {
            await using (var setup = isolated.CreateContext())
            {
                await new DemoDataSeeder(setup, _ => "test-hash", ReferenceUtc).RunAsync();
                var order = await setup.Set<Order>().SingleAsync(o => o.Code == "CO-V1-000002");
                order.Status = OrderStatus.Cancelled;
                await setup.SaveChangesAsync();
            }
            await using (var db = isolated.CreateContext())
                await Assert.ThrowsAsync<InvalidOperationException>(() =>
                    new DemoDataSeeder(db, _ => "test-hash", ReferenceUtc).RunAsync(includeFeedback: true));
            await using var verify = isolated.CreateContext();
            Assert.Equal(0, await verify.Set<Feedback>().CountAsync());
            Assert.Equal(0, await verify.Set<FeedbackAssignment>().CountAsync());
            Assert.Equal(0, await verify.Set<FeedbackReply>().CountAsync());
            Assert.Equal(320, await verify.Set<Order>().CountAsync());
            Assert.Equal(OrderStatus.Cancelled, (await verify.Set<Order>().SingleAsync(o => o.Code == "CO-V1-000002")).Status);
        }
        finally { await isolated.DisposeAsync(); }
    }

    [Fact]
    public async Task Seed_v2_has_sixty_verified_reviews_with_consistent_states_and_history()
    {
        await using var db = database.CreateContext();
        await using var transaction = await db.Database.BeginTransactionAsync();
        await new DemoDataSeeder(db, _ => "test-hash", ReferenceUtc).RunAsync(includeFeedback: true);
        var feedback = await db.Set<Feedback>().ToListAsync();
        var assignments = await db.Set<FeedbackAssignment>().ToListAsync();
        var replies = await db.Set<FeedbackReply>().ToListAsync();
        var orders = await db.Set<Order>().ToDictionaryAsync(o => o.Id);
        var items = await db.Set<OrderItem>().ToDictionaryAsync(i => i.Id);
        var variants = await db.Set<ProductVariant>().ToDictionaryAsync(v => v.Id);
        var accounts = await db.Set<Account>().ToDictionaryAsync(a => a.Id);

        Assert.Equal(60, feedback.Count);
        Assert.Equal(60, feedback.Select(f => f.OrderItemId).Distinct().Count());
        Assert.Equal(60, feedback.Select(f => f.CustomerId).Distinct().Count());
        Assert.All(Enum.GetValues<FeedbackStatus>(), state => Assert.Equal(12, feedback.Count(f => f.Status == state)));
        Assert.Equal(Enumerable.Range(1, 5), feedback.Select(f => f.Rating).Distinct().Order());
        Assert.Equal(36, assignments.Count);
        Assert.Equal(24, replies.Count);
        Assert.Equal(2, assignments.Select(a => a.StaffId).Distinct().Count());
        foreach (var f in feedback)
        {
            var item = items[f.OrderItemId!.Value];
            var order = orders[item.OrderId];
            Assert.Equal(OrderStatus.Completed, order.Status);
            Assert.Equal(order.CustomerId, f.CustomerId);
            Assert.Equal(variants[item.ProductVariantId].ProductId, f.ProductId);
            Assert.InRange(f.Content.Length, 20, 1000);
            Assert.InRange(f.CreatedAt, order.OrderedAt, ReferenceUtc);
            var accepted = f.Status != FeedbackStatus.New;
            var assigned = f.Status is FeedbackStatus.Assigned or FeedbackStatus.Replied or FeedbackStatus.Closed;
            var replied = f.Status is FeedbackStatus.Replied or FeedbackStatus.Closed;
            Assert.Equal(accepted, f.AcceptedAt.HasValue && f.AcceptedBy.HasValue);
            Assert.Equal(assigned, f.AssignedStaffId.HasValue);
            Assert.Equal(replied, f.RepliedAt.HasValue);
            Assert.Equal(f.Status == FeedbackStatus.Closed, f.ClosedAt.HasValue);
            if (accepted)
            {
                Assert.Equal(AccountRole.Manager, accounts[f.AcceptedBy!.Value].Role);
                Assert.InRange(f.AcceptedAt!.Value, f.CreatedAt, ReferenceUtc);
            }
            if (assigned)
            {
                var assignment = Assert.Single(assignments, a => a.FeedbackId == f.Id);
                Assert.Equal(f.AssignedStaffId, assignment.StaffId);
                Assert.Equal(f.AcceptedBy, assignment.AssignedBy);
                Assert.InRange(assignment.AssignedAt, f.AcceptedAt!.Value, ReferenceUtc);
                Assert.Equal(AccountRole.Staff, accounts[assignment.StaffId].Role);
                if (replied)
                {
                    var reply = Assert.Single(replies, r => r.FeedbackId == f.Id);
                    Assert.Equal(f.AssignedStaffId, reply.StaffId);
                    Assert.Equal(f.RepliedAt, reply.CreatedAt);
                    Assert.InRange(reply.CreatedAt, assignment.AssignedAt, ReferenceUtc);
                    Assert.InRange(reply.Content.Length, 10, 500);
                    if (f.ClosedAt.HasValue) Assert.InRange(f.ClosedAt.Value, reply.CreatedAt, ReferenceUtc);
                }
            }
        }
        Assert.Equal(87, await db.Set<Account>().IgnoreQueryFilters().CountAsync());
        Assert.Equal(320, orders.Count);
        Assert.Equal(640, items.Count);
        Assert.Equal(0, await db.Set<Survey>().CountAsync());
    }
}
