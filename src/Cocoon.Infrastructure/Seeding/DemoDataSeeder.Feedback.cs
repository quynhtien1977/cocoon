using Cocoon.Domain.Entities;
using Cocoon.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Cocoon.Infrastructure.Seeding;

public sealed partial class DemoDataSeeder
{
    private async Task AddFeedback(CancellationToken ct)
    {
        // Fixed v1 order codes, one line per customer. Never choose replacement slots on rerun.
        var codes = Enumerable.Range(0, 80).Where(i => i % 20 < 18).Take(60)
            .Select(i => $"CO-V1-{i + 1:000000}").ToArray();
        var lines = await (from o in db.Set<Order>()
                           join i in db.Set<OrderItem>() on o.Id equals i.OrderId
                           join v in db.Set<ProductVariant>().IgnoreQueryFilters() on i.ProductVariantId equals v.Id
                           join p in db.Set<Product>().IgnoreQueryFilters() on v.ProductId equals p.Id
                           join a in db.Set<Account>().IgnoreQueryFilters() on o.CustomerId equals a.Id
                           where codes.Contains(o.Code)
                           select new { Order = o, ItemId = i.Id, v.Sku, VariantDeleted = v.IsDeleted,
                               Product = p, Customer = a }).ToListAsync(ct);
        var slots = codes.Select(code => lines.Where(x => x.Order.Code == code)
            .OrderBy(x => x.Sku, StringComparer.Ordinal).FirstOrDefault()
            ?? throw new InvalidOperationException("Thiếu dòng đơn demo v1. Seed v2 đã dừng.")).ToArray();
        var existing = (await db.Set<Feedback>().Where(f => f.OrderItemId != null)
            .Select(f => f.OrderItemId!.Value).ToListAsync(ct)).ToHashSet();
        if (slots.All(x => existing.Contains(x.ItemId))) return;

        var internalAccounts = await db.Set<StaffProfile>()
            .Where(s => s.Account.IsActive && (s.Account.Email == "manager@cocoon.demo"
                || s.Account.Email == "staff1@cocoon.demo" || s.Account.Email == "staff2@cocoon.demo"))
            .Select(s => s.Account).ToListAsync(ct);
        var manager = internalAccounts.SingleOrDefault(a => a.Email == "manager@cocoon.demo" && a.Role == AccountRole.Manager);
        var staff = new[] { "staff1@cocoon.demo", "staff2@cocoon.demo" }.Select(email =>
            internalAccounts.SingleOrDefault(a => a.Email == email && a.Role == AccountRole.Staff)).ToArray();
        if (manager is null || staff.Any(a => a is null))
            throw new InvalidOperationException("Seed v2 cần Manager và hai Staff demo đang hoạt động.");

        string[] contents = [
            "Sản phẩm chưa phù hợp với nhu cầu của tôi, mong được nhân viên hỗ trợ thêm.",
            "Bao bì còn bất tiện khi sử dụng, tôi mong cửa hàng cải thiện trong thời gian tới.",
            "Sản phẩm dùng ổn nhưng tôi cần thêm thông tin về cách bảo quản sau khi mở nắp.",
            "Tôi hài lòng với sản phẩm và cách cửa hàng tư vấn, sẽ cân nhắc sử dụng tiếp.",
            "Sản phẩm đáp ứng tốt nhu cầu, đóng gói cẩn thận và nhân viên hỗ trợ nhiệt tình."
        ];
        for (var index = 0; index < slots.Length; index++)
        {
            var slot = slots[index];
            if (existing.Contains(slot.ItemId)) continue; // Keep customer content and all subsequent staff actions.
            if (slot.Order.Status != OrderStatus.Completed || slot.Order.OrderedAt > referenceUtc
                || slot.Customer.Role != AccountRole.Customer || !slot.Customer.IsActive || slot.Customer.IsDeleted
                || slot.Product.IsDeleted || slot.Product.Status != ProductStatus.Active || slot.VariantDeleted)
                throw new InvalidOperationException("Dòng đơn demo không còn đủ điều kiện tạo phản hồi. Seed v2 không sửa dữ liệu cũ.");

            var status = (FeedbackStatus)(index % 5);
            var rating = 1 + index / 5 % 5;
            var createdAt = slot.Order.OrderedAt > referenceUtc.AddDays(-14 - index % 14)
                ? slot.Order.OrderedAt : referenceUtc.AddDays(-14 - index % 14);
            // Same-day purchases may reach multiple stages at the same UTC instant, never in the future.
            var step = TimeSpan.FromTicks(Math.Min(TimeSpan.TicksPerHour, (referenceUtc - createdAt).Ticks / 4));
            var accepted = status != FeedbackStatus.New;
            var assigned = status is FeedbackStatus.Assigned or FeedbackStatus.Replied or FeedbackStatus.Closed;
            var replied = status is FeedbackStatus.Replied or FeedbackStatus.Closed;
            var staffId = staff[index % 2]!.Id;
            var feedback = Add(new Feedback
            {
                CustomerId = slot.Customer.Id, ProductId = slot.Product.Id, OrderItemId = slot.ItemId,
                Rating = rating, Content = contents[rating - 1], Status = status, CreatedAt = createdAt,
                AcceptedBy = accepted ? manager.Id : null, AcceptedAt = accepted ? createdAt + step : null,
                AssignedStaffId = assigned ? staffId : null, RepliedAt = replied ? createdAt + step * 3 : null,
                ClosedAt = status == FeedbackStatus.Closed ? createdAt + step * 4 : null
            });
            await db.SaveChangesAsync(ct);
            if (assigned)
                Add(new FeedbackAssignment { FeedbackId = feedback.Id, StaffId = staffId,
                    AssignedBy = manager.Id, AssignedAt = createdAt + step * 2 });
            if (replied)
                Add(new FeedbackReply { FeedbackId = feedback.Id, StaffId = staffId,
                    Content = "Cảm ơn bạn đã chia sẻ. Nhân viên đã ghi nhận và sẽ hỗ trợ bạn về sản phẩm này.",
                    CreatedAt = feedback.RepliedAt!.Value });
        }
        await db.SaveChangesAsync(ct);
    }
}
