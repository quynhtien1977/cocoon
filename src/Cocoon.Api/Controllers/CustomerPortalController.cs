using System.ComponentModel.DataAnnotations;
using Cocoon.Domain.Entities;
using Cocoon.Domain.Enums;
using Cocoon.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Cocoon.Api.Controllers;

/// <summary>Customer self-service. Customer id always comes from the token, never from the URL.</summary>
[Route("api/v1/me")]
[Authorize(Policy = "RequireCustomer")]
public sealed class CustomerPortalController(AppDbContext db) : ApiStubController
{
    [HttpGet("home")]
    public async Task<IActionResult> Home(CancellationToken cancellationToken)
    {
        var (me, now) = (AccountId, DateTime.UtcNow);
        var surveys = await (
            from r in db.Set<SurveyRecipient>()
            join s in db.Set<Survey>() on r.SurveyId equals s.Id
            where r.CustomerId == me && r.Status == RecipientStatus.NotDone && s.Status == SurveyStatus.Open
                && (s.OpenAt == null || s.OpenAt <= now) && (s.CloseAt == null || s.CloseAt > now)
            orderby s.CloseAt == null, s.CloseAt, s.Id
            select new PendingSurvey(s.Id, s.Title, s.CloseAt, db.Set<SurveyQuestion>().Count(q => q.SurveyId == s.Id)))
            .Take(3).ToListAsync(cancellationToken);
        var reviewable = await Reviewable(me).Take(4).ToListAsync(cancellationToken);
        var unread = await db.Set<Notification>().CountAsync(n => n.AccountId == me && !n.IsRead, cancellationToken);
        // Recommendations land in sprint 3; the section stays empty until then.
        return Ok(new CustomerHome(surveys, reviewable, [], unread));
    }

    [HttpGet("orders")]
    public async Task<IActionResult> Orders([FromQuery] ListQuery query, CancellationToken cancellationToken)
    {
        var me = AccountId;
        var page = await ToPageAsync(db.Set<Order>().Where(o => o.CustomerId == me)
            .OrderByDescending(o => o.OrderedAt).ThenByDescending(o => o.Id), query, cancellationToken);
        var lines = await OrderLines(page.Items.Select(o => o.Id).ToArray(), cancellationToken);
        return Ok(new PagedResult<CustomerOrder>(page.Items.Select(o => ToView(o, lines)).ToList(), page.TotalCount, page.Page, page.PageSize));
    }

    [HttpGet("orders/{id:int}")]
    public async Task<IActionResult> Order(int id, CancellationToken cancellationToken)
    {
        var me = AccountId;
        var order = await db.Set<Order>().SingleOrDefaultAsync(o => o.Id == id && o.CustomerId == me, cancellationToken);
        return order is null ? NotFound() : Ok(ToView(order, await OrderLines([order.Id], cancellationToken)));
    }

    [HttpGet("reviewable-items")]
    public async Task<IActionResult> ReviewableItems(CancellationToken cancellationToken) =>
        Ok(await Reviewable(AccountId).ToListAsync(cancellationToken));

    [HttpGet("feedback")]
    public async Task<IActionResult> Feedback([FromQuery] ListQuery query, CancellationToken cancellationToken)
    {
        var rows = MyFeedback(AccountId);
        if (query.Status is not null)
        {
            if (!Enum.TryParse<FeedbackStatus>(query.Status, true, out var status))
                return Fail(StatusCodes.Status400BadRequest, "VALIDATION_ERROR", "Trạng thái phản hồi không hợp lệ.");
            rows = rows.Where(x => x.F.Status == status);
        }
        return Ok(await ToPageAsync(rows.OrderByDescending(x => x.F.CreatedAt).ThenByDescending(x => x.F.Id).Select(x => new MyFeedbackItem(
            x.F.Id, x.F.Rating, x.F.Content, x.F.Status, x.F.CreatedAt, x.O == null ? null : x.O.Code,
            new FeedbackProduct(x.P.Id, x.P.Name, x.V == null ? "" : x.V.Name, x.V == null ? null : x.V.ImageUrl),
            db.Set<FeedbackReply>().Any(r => r.FeedbackId == x.F.Id))), query, cancellationToken));
    }

    [HttpGet("feedback/{id:int}")]
    public async Task<IActionResult> FeedbackDetail(int id, CancellationToken cancellationToken)
    {
        var row = await MyFeedback(AccountId).SingleOrDefaultAsync(x => x.F.Id == id, cancellationToken);
        if (row is null) return NotFound();
        return Ok(new MyFeedbackDetail(row.F.Id, row.F.Rating, row.F.Content, row.F.Status, row.F.CreatedAt, row.O?.Code ?? "",
            new FeedbackProduct(row.P.Id, row.P.Name, row.V?.Name ?? "", row.V?.ImageUrl),
            await FeedbackController.StatusTimes(db, row.F, cancellationToken), await FeedbackController.Replies(db, id, cancellationToken)));
    }

    /// <summary>Spec 5.6.1: only the customer's own line, in a Completed order, reviewed once.</summary>
    [HttpPost("feedback")]
    public async Task<IActionResult> CreateFeedback(CreateFeedbackRequest request, CancellationToken cancellationToken)
    {
        var me = AccountId;
        var content = request.Content.Trim();
        if (content.Length is < 20 or > 1000)
            return Fail(StatusCodes.Status400BadRequest, "VALIDATION_ERROR", "Nội dung phản hồi cần từ 20 đến 1.000 ký tự.");
        var line = await (
            from i in db.Set<OrderItem>()
            join o in db.Set<Order>() on i.OrderId equals o.Id
            join v in db.Set<ProductVariant>() on i.ProductVariantId equals v.Id
            join p in db.Set<Product>() on v.ProductId equals p.Id
            where i.Id == request.OrderItemId && o.CustomerId == me
            select new { o.Status, ProductId = p.Id }).SingleOrDefaultAsync(cancellationToken);
        if (line is null) return NotFound();
        if (line.Status != OrderStatus.Completed)
            return Fail(StatusCodes.Status409Conflict, "ORDER_NOT_COMPLETED", "Chỉ đánh giá được sản phẩm trong đơn hàng đã hoàn tất.");
        if (await db.Set<Feedback>().AnyAsync(f => f.OrderItemId == request.OrderItemId, cancellationToken)) return AlreadyReviewed();

        var feedback = new Feedback
        {
            CustomerId = me, ProductId = line.ProductId, OrderItemId = request.OrderItemId, Rating = request.Rating, Content = content
        };
        db.Add(feedback);
        try { await db.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return AlreadyReviewed(); // Lost a race with another tab reviewing the same line.
        }
        return StatusCode(StatusCodes.Status201Created, new CreatedFeedback(feedback.Id));
    }

    [HttpGet("surveys")] public IActionResult Surveys([FromQuery] ListQuery query) => NotImplementedYet();
    [HttpGet("surveys/{id:int}")] public IActionResult Survey(int id) => NotImplementedYet();
    [HttpPost("surveys/{id:int}/responses")]
    public IActionResult SubmitSurvey(int id, SubmitSurveyRequest request) => NotImplementedYet();

    [HttpGet("recommendations")] public IActionResult Recommendations() => NotImplementedYet();
    [HttpPost("recommendations/{id:int}/click")] public IActionResult Click(int id) => NotImplementedYet();
    [HttpPost("recommendations/{id:int}/dismiss")] public IActionResult Dismiss(int id) => NotImplementedYet();

    [HttpGet("notifications")] public IActionResult Notifications() => NotImplementedYet();
    [HttpPost("notifications/{id:int}/read")] public IActionResult MarkRead(int id) => NotImplementedYet();

    private ObjectResult AlreadyReviewed() =>
        Fail(StatusCodes.Status409Conflict, "FEEDBACK_ALREADY_EXISTS", "Sản phẩm này đã được đánh giá.");

    /// <summary>Completed lines without feedback. Deleted products drop out: they can no longer be reviewed.</summary>
    private IQueryable<ReviewableItem> Reviewable(int me) =>
        from i in db.Set<OrderItem>()
        join o in db.Set<Order>() on i.OrderId equals o.Id
        join v in db.Set<ProductVariant>() on i.ProductVariantId equals v.Id
        join p in db.Set<Product>() on v.ProductId equals p.Id
        where o.CustomerId == me && o.Status == OrderStatus.Completed && !db.Set<Feedback>().Any(f => f.OrderItemId == i.Id)
        orderby o.OrderedAt descending, i.Id
        select new ReviewableItem(i.Id, p.Id, p.Name, v.Name, v.ImageUrl, o.Code, o.OrderedAt);

    /// <summary>Order history keeps lines whose product or variant was deleted later.</summary>
    private async Task<ILookup<int, CustomerOrderItem>> OrderLines(int[] orderIds, CancellationToken cancellationToken) =>
        (await (
            from i in db.Set<OrderItem>()
            join v in db.Set<ProductVariant>().IgnoreQueryFilters() on i.ProductVariantId equals v.Id
            join p in db.Set<Product>().IgnoreQueryFilters() on v.ProductId equals p.Id
            join f in db.Set<Feedback>() on (int?)i.Id equals f.OrderItemId into reviews
            from f in reviews.DefaultIfEmpty()
            where orderIds.Contains(i.OrderId)
            orderby i.Id
            select new
            {
                i.OrderId,
                Item = new CustomerOrderItem(i.Id, p.Id, p.Id.ToString(), p.Name, v.Name, v.ImageUrl, i.Quantity, i.UnitPrice,
                    f == null ? null : new FeedbackRef(f.Id, f.Rating))
            }).ToListAsync(cancellationToken)).ToLookup(x => x.OrderId, x => x.Item);

    private static CustomerOrder ToView(Order o, ILookup<int, CustomerOrderItem> lines) =>
        new(o.Id, o.Code, o.OrderedAt, o.Status, o.TotalAmount, lines[o.Id].ToList());

    private IQueryable<MyFeedbackRow> MyFeedback(int me) =>
        from f in db.Set<Feedback>()
        join p in db.Set<Product>().IgnoreQueryFilters() on f.ProductId equals p.Id
        join i in db.Set<OrderItem>() on f.OrderItemId equals (int?)i.Id into items
        from i in items.DefaultIfEmpty()
        join o in db.Set<Order>() on i.OrderId equals o.Id into orders
        from o in orders.DefaultIfEmpty()
        join v in db.Set<ProductVariant>().IgnoreQueryFilters() on i.ProductVariantId equals v.Id into variants
        from v in variants.DefaultIfEmpty()
        where f.CustomerId == me
        select new MyFeedbackRow { F = f, P = p, O = o, V = v };

    private sealed class MyFeedbackRow
    {
        public Feedback F { get; init; } = null!;
        public Product P { get; init; } = null!;
        public Order? O { get; init; }
        public ProductVariant? V { get; init; }
    }
}

public sealed record CreateFeedbackRequest(int OrderItemId, [Range(1, 5)] int Rating, [Required] string Content);
public sealed record SubmitSurveyRequest(SurveyAnswerInput[] Answers);
public sealed record SurveyAnswerInput(int QuestionId, int[]? OptionIds, decimal? NumericValue, string? TextValue);

public sealed record CustomerHome(IReadOnlyList<PendingSurvey> PendingSurveys, IReadOnlyList<ReviewableItem> ReviewableItems,
    IReadOnlyList<object> Recommendations, int UnreadNotifications);
public sealed record PendingSurvey(int Id, string Title, DateTime? CloseAt, int QuestionCount);
public sealed record ReviewableItem(int OrderItemId, int ProductId, string Name, string Variant, string? ImageUrl, string OrderCode, DateTime OrderedAt);
public sealed record CustomerOrder(int Id, string Code, DateTime OrderedAt, OrderStatus Status, decimal TotalAmount, IReadOnlyList<CustomerOrderItem> Items);
/// <param name="ProductSlug">The C2 page links products by this value; C9 reads it back as the product id.</param>
public sealed record CustomerOrderItem(int Id, int ProductId, string ProductSlug, string Name, string Variant, string? ImageUrl,
    int Quantity, decimal UnitPrice, FeedbackRef? Review);
public sealed record FeedbackRef(int Id, int Rating);
public sealed record FeedbackProduct(int Id, string Name, string Variant, string? ImageUrl);
public sealed record MyFeedbackItem(int Id, int Rating, string Content, FeedbackStatus Status, DateTime CreatedAt, string? OrderCode,
    FeedbackProduct Product, bool HasReply);
public sealed record MyFeedbackDetail(int Id, int Rating, string Content, FeedbackStatus Status, DateTime CreatedAt, string OrderCode,
    FeedbackProduct Product, IReadOnlyDictionary<FeedbackStatus, DateTime> StatusTimes, IReadOnlyList<FeedbackReplyItem> Replies);
public sealed record CreatedFeedback(int Id);
