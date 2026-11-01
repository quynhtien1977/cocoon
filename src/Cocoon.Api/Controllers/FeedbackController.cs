using System.ComponentModel.DataAnnotations;
using Cocoon.Domain;
using Cocoon.Domain.Entities;
using Cocoon.Domain.Enums;
using Cocoon.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Cocoon.Api.Controllers;

/// <summary>
/// Spec 5.6.2: status only moves forward New → Accepted → Assigned → Replied → Closed; a manager may also close
/// from Accepted. Every move is a conditional UPDATE on the expected status, so two managers cannot both win.
/// </summary>
[Route("api/v1")]
public sealed class FeedbackController(AppDbContext db) : ApiStubController
{
    private const string DeletedCustomer = "Khách đã xóa";

    [HttpGet("feedback"), Authorize(Policy = "RequireManager")]
    public async Task<IActionResult> List([FromQuery] ListQuery query, int? rating, int? productId, int? categoryId,
        CancellationToken cancellationToken)
    {
        var rows = Rows();
        if (rating is not null) rows = rows.Where(x => x.F.Rating == rating);
        if (productId is not null) rows = rows.Where(x => x.F.ProductId == productId);
        if (categoryId is not null) rows = rows.Where(x => x.P.CategoryId == categoryId);
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = SearchText.Normalize(query.Search);
            rows = rows.Where(x => x.P.NameNormalized.Contains(term) || (x.C != null && x.C.FullNameNormalized.Contains(term)));
        }
        return await Page(rows, query, cancellationToken);
    }

    /// <summary>Active staff a manager can assign feedback to (M6).</summary>
    [HttpGet("staff"), Authorize(Policy = "RequireManager")]
    public async Task<IActionResult> Staff(CancellationToken cancellationToken) =>
        Ok(await db.Set<StaffProfile>().Where(s => s.Account.Role == AccountRole.Staff && s.Account.IsActive)
            .OrderBy(s => s.FullName).Select(s => new StaffOption(s.AccountId, s.FullName)).ToListAsync(cancellationToken));

    [HttpGet("feedback/{id:int}"), Authorize(Roles = "Manager,Staff")]
    public async Task<IActionResult> Get(int id, CancellationToken cancellationToken)
    {
        var me = AccountId;
        var staffOnly = User.IsInRole("Staff");
        // Staff only see feedback assigned to them; anything else looks missing rather than forbidden.
        var row = await Rows().Where(x => x.F.Id == id && (!staffOnly || x.F.AssignedStaffId == me)).SingleOrDefaultAsync(cancellationToken);
        if (row is null) return NotFound();
        var customerId = row.F.CustomerId;
        var deleted = IsDeleted(row);
        return Ok(new FeedbackDetail(ToItem(row))
        {
            CustomerEmail = deleted ? "" : row.A!.Email,
            CustomerPhone = deleted ? null : row.C!.Phone,
            CustomerOrderCount = await db.Set<Order>().CountAsync(o => o.CustomerId == customerId, cancellationToken),
            CustomerPreferences = await db.Set<CustomerPreference>().Where(c => c.CustomerId == customerId)
                .Join(db.Set<Preference>(), c => c.PreferenceId, p => p.Id, (_, p) => p.Name).OrderBy(n => n).ToArrayAsync(cancellationToken),
            Sku = row.V?.Sku ?? "",
            Price = row.I?.UnitPrice ?? row.V?.Price ?? 0,
            OrderCompletedAt = row.O is { Status: OrderStatus.Completed } ? row.O.OrderedAt : null,
            StatusTimes = await StatusTimes(db, row.F, cancellationToken),
            Replies = await Replies(db, id, cancellationToken)
        });
    }

    [HttpPost("feedback/{id:int}/accept"), Authorize(Policy = "RequireManager")]
    public async Task<IActionResult> Accept(int id, CancellationToken cancellationToken)
    {
        var (me, now) = (AccountId, DateTime.UtcNow);
        await EnsureStaffProfile(cancellationToken);
        var updated = await db.Set<Feedback>().Where(f => f.Id == id && f.Status == FeedbackStatus.New)
            .ExecuteUpdateAsync(s => s.SetProperty(f => f.Status, FeedbackStatus.Accepted)
                .SetProperty(f => f.AcceptedBy, me).SetProperty(f => f.AcceptedAt, now), cancellationToken);
        return updated == 1 ? NoContent() : await TransitionFailed(id, cancellationToken);
    }

    /// <summary>Assigns or reassigns while nobody has replied yet; each assignment is kept as history.</summary>
    [HttpPost("feedback/{id:int}/assign"), Authorize(Policy = "RequireManager")]
    public async Task<IActionResult> Assign(int id, AssignFeedbackRequest request, CancellationToken cancellationToken)
    {
        var (me, now) = (AccountId, DateTime.UtcNow);
        var staffExists = await db.Set<StaffProfile>().AnyAsync(s => s.AccountId == request.StaffId && s.Account.Role == AccountRole.Staff
            && s.Account.IsActive, cancellationToken);
        if (!staffExists)
            return Fail(StatusCodes.Status400BadRequest, "VALIDATION_ERROR", "Nhân viên được giao không tồn tại hoặc đã bị khóa.");
        await EnsureStaffProfile(cancellationToken);

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var updated = await db.Set<Feedback>()
            .Where(f => f.Id == id && (f.Status == FeedbackStatus.Accepted || f.Status == FeedbackStatus.Assigned))
            .ExecuteUpdateAsync(s => s.SetProperty(f => f.Status, FeedbackStatus.Assigned)
                .SetProperty(f => f.AssignedStaffId, request.StaffId), cancellationToken);
        if (updated != 1) return await TransitionFailed(id, cancellationToken);
        db.Add(new FeedbackAssignment { FeedbackId = id, StaffId = request.StaffId, AssignedBy = me, AssignedAt = now });
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return NoContent();
    }

    [HttpPost("feedback/{id:int}/close"), Authorize(Policy = "RequireManager")]
    public async Task<IActionResult> Close(int id, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var updated = await db.Set<Feedback>()
            .Where(f => f.Id == id && (f.Status == FeedbackStatus.Accepted || f.Status == FeedbackStatus.Replied))
            .ExecuteUpdateAsync(s => s.SetProperty(f => f.Status, FeedbackStatus.Closed).SetProperty(f => f.ClosedAt, now), cancellationToken);
        return updated == 1 ? NoContent() : await TransitionFailed(id, cancellationToken);
    }

    /// <summary>One reply per feedback (unique index). Staff reply only to feedback assigned to them.</summary>
    [HttpPost("feedback/{id:int}/replies"), Authorize(Roles = "Manager,Staff")]
    public async Task<IActionResult> Reply(int id, ReplyFeedbackRequest request, CancellationToken cancellationToken)
    {
        var (me, now) = (AccountId, DateTime.UtcNow);
        var content = request.Content.Trim();
        if (content.Length is < 10 or > 500)
            return Fail(StatusCodes.Status400BadRequest, "VALIDATION_ERROR", "Câu trả lời cần từ 10 đến 500 ký tự.");
        var staffOnly = User.IsInRole("Staff");
        await EnsureStaffProfile(cancellationToken);

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var updated = await db.Set<Feedback>()
            .Where(f => f.Id == id && f.Status == FeedbackStatus.Assigned && (!staffOnly || f.AssignedStaffId == me))
            .ExecuteUpdateAsync(s => s.SetProperty(f => f.Status, FeedbackStatus.Replied).SetProperty(f => f.RepliedAt, now), cancellationToken);
        if (updated != 1)
            return staffOnly && !await db.Set<Feedback>().AnyAsync(f => f.Id == id && f.AssignedStaffId == me, cancellationToken)
                ? NotFound() : await TransitionFailed(id, cancellationToken);
        var reply = new FeedbackReply { FeedbackId = id, StaffId = me, Content = content, CreatedAt = now };
        db.Add(reply);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        var staffName = await db.Set<StaffProfile>().Where(s => s.AccountId == me).Select(s => s.FullName).SingleAsync(cancellationToken);
        return StatusCode(StatusCodes.Status201Created, new FeedbackReplyItem(reply.Id, staffName, reply.Content, reply.CreatedAt));
    }

    [HttpGet("staff/feedback"), Authorize(Policy = "RequireStaff")]
    public async Task<IActionResult> AssignedToMe([FromQuery] ListQuery query, CancellationToken cancellationToken)
    {
        var me = AccountId;
        return await Page(Rows().Where(x => x.F.AssignedStaffId == me), query, cancellationToken);
    }

    /// <summary>When each step was reached; steps not reached yet are absent.</summary>
    internal static async Task<Dictionary<FeedbackStatus, DateTime>> StatusTimes(AppDbContext db, Feedback f, CancellationToken cancellationToken)
    {
        var assignedAt = await db.Set<FeedbackAssignment>().Where(a => a.FeedbackId == f.Id)
            .MaxAsync(a => (DateTime?)a.AssignedAt, cancellationToken);
        var times = new Dictionary<FeedbackStatus, DateTime> { [FeedbackStatus.New] = f.CreatedAt };
        foreach (var (status, at) in new[] { (FeedbackStatus.Accepted, f.AcceptedAt), (FeedbackStatus.Assigned, assignedAt),
                     (FeedbackStatus.Replied, f.RepliedAt), (FeedbackStatus.Closed, f.ClosedAt) })
            if (at is not null) times[status] = at.Value;
        return times;
    }

    internal static Task<List<FeedbackReplyItem>> Replies(AppDbContext db, int feedbackId, CancellationToken cancellationToken) =>
        (from r in db.Set<FeedbackReply>()
         join s in db.Set<StaffProfile>().IgnoreQueryFilters() on r.StaffId equals s.AccountId
         where r.FeedbackId == feedbackId
         orderby r.CreatedAt
         select new FeedbackReplyItem(r.Id, s.FullName, r.Content, r.CreatedAt)).ToListAsync(cancellationToken);

    private async Task<IActionResult> Page(IQueryable<FeedbackRow> rows, ListQuery query, CancellationToken cancellationToken)
    {
        if (query.Status is not null)
        {
            if (!Enum.TryParse<FeedbackStatus>(query.Status, true, out var status))
                return Fail(StatusCodes.Status400BadRequest, "VALIDATION_ERROR", "Trạng thái phản hồi không hợp lệ.");
            rows = rows.Where(x => x.F.Status == status);
        }
        var page = await ToPageAsync(rows.OrderByDescending(x => x.F.CreatedAt).ThenByDescending(x => x.F.Id), query, cancellationToken);
        return Ok(new PagedResult<FeedbackListItem>(page.Items.Select(ToItem).ToList(), page.TotalCount, page.Page, page.PageSize));
    }

    private static bool IsDeleted(FeedbackRow x) => x.C is null || x.A is null || x.A.IsDeleted;

    private static FeedbackListItem ToItem(FeedbackRow x) => new(
        x.F.Id, x.F.CustomerId, IsDeleted(x) ? DeletedCustomer : x.C!.FullName, x.O?.Code,
        x.F.ProductId, x.P.Name, x.P.CategoryId, x.Category.Name, x.F.Rating, x.F.Content, x.F.Status,
        x.F.AssignedStaffId, x.S?.FullName, x.F.OrderItemId != null, x.F.CreatedAt);

    /// <summary>Filters are ignored so feedback on deleted products and from deleted customers stays in reports.</summary>
    private IQueryable<FeedbackRow> Rows() =>
        from f in db.Set<Feedback>()
        join p in db.Set<Product>().IgnoreQueryFilters() on f.ProductId equals p.Id
        join category in db.Set<Category>() on p.CategoryId equals category.Id
        join c in db.Set<CustomerProfile>().IgnoreQueryFilters() on f.CustomerId equals c.AccountId into customers
        from c in customers.DefaultIfEmpty()
        join a in db.Set<Account>().IgnoreQueryFilters() on f.CustomerId equals a.Id into accounts
        from a in accounts.DefaultIfEmpty()
        join i in db.Set<OrderItem>() on f.OrderItemId equals (int?)i.Id into items
        from i in items.DefaultIfEmpty()
        join o in db.Set<Order>() on i.OrderId equals o.Id into orders
        from o in orders.DefaultIfEmpty()
        join v in db.Set<ProductVariant>().IgnoreQueryFilters() on i.ProductVariantId equals v.Id into variants
        from v in variants.DefaultIfEmpty()
        join s in db.Set<StaffProfile>().IgnoreQueryFilters() on f.AssignedStaffId equals (int?)s.AccountId into staff
        from s in staff.DefaultIfEmpty()
        select new FeedbackRow { F = f, P = p, Category = category, C = c, A = a, I = i, O = o, V = v, S = s };

    /// <summary>Feedback columns reference StaffProfile; an internal account without one gets an empty profile.</summary>
    private async Task EnsureStaffProfile(CancellationToken cancellationToken)
    {
        var me = AccountId;
        if (await db.Set<StaffProfile>().IgnoreQueryFilters().AnyAsync(s => s.AccountId == me, cancellationToken)) return;
        db.Add(new StaffProfile { AccountId = me });
        await db.SaveChangesAsync(cancellationToken);
    }

    private async Task<IActionResult> TransitionFailed(int id, CancellationToken cancellationToken) =>
        await db.Set<Feedback>().AnyAsync(f => f.Id == id, cancellationToken)
            ? Fail(StatusCodes.Status409Conflict, "INVALID_FEEDBACK_STATUS", "Trạng thái phản hồi đã thay đổi. Hãy tải lại trang.")
            : NotFound();

    private sealed class FeedbackRow
    {
        public Feedback F { get; init; } = null!;
        public Product P { get; init; } = null!;
        public Category Category { get; init; } = null!;
        public CustomerProfile? C { get; init; }
        public Account? A { get; init; }
        public OrderItem? I { get; init; }
        public Order? O { get; init; }
        public ProductVariant? V { get; init; }
        public StaffProfile? S { get; init; }
    }
}

public sealed record StaffOption(int Id, string Name);
public sealed record AssignFeedbackRequest(int StaffId);
public sealed record ReplyFeedbackRequest([Required] string Content);
public sealed record FeedbackReplyItem(int Id, string StaffName, string Content, DateTime CreatedAt);

/// <summary>Row of M5 and S1. Matches apps/web/features/feedback/types.ts.</summary>
public record FeedbackListItem(int Id, int CustomerId, string CustomerName, string? OrderCode, int ProductId, string ProductName,
    int CategoryId, string CategoryName, int Rating, string Content, FeedbackStatus Status, int? AssigneeId, string? AssigneeName,
    bool VerifiedPurchase, DateTime CreatedAt)
{
    // shortcut: display code derived from the account id until customers get a stored code.
    public string CustomerCode => $"KH-{CustomerId:D4}";
}

public sealed record FeedbackDetail : FeedbackListItem
{
    public FeedbackDetail(FeedbackListItem item) : base(item) { }

    public required string CustomerEmail { get; init; }
    public required string? CustomerPhone { get; init; }
    public required int CustomerOrderCount { get; init; }
    public required string[] CustomerPreferences { get; init; }
    public required string Sku { get; init; }
    public required decimal Price { get; init; }
    public required DateTime? OrderCompletedAt { get; init; }
    public required Dictionary<FeedbackStatus, DateTime> StatusTimes { get; init; }
    public required List<FeedbackReplyItem> Replies { get; init; }
}
