using System.Text.Json;
using Cocoon.Application.Recommendations;
using Cocoon.Domain.Entities;
using Cocoon.Domain.Enums;
using Cocoon.Infrastructure.Persistence;
using Cocoon.Infrastructure.Recommendations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Cocoon.Api.Controllers;

/// <summary>
/// M13/M14 (spec 5.6.5, 7.3). Plans are edited only as Draft; activating notifies the segment and recomputes its
/// suggestions, ending recomputes them without the plan.
/// </summary>
[Route("api/v1")]
[Authorize(Policy = "RequireManager")]
public sealed class RecommendationsController(AppDbContext db, RecommendationService recommendations)
    : ApiStubController
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    [HttpGet("recommendation-plans")]
    public async Task<IActionResult> ListPlans([FromQuery] ListQuery query, CancellationToken cancellationToken)
    {
        var plans = db.Set<RecommendationPlan>().AsQueryable();
        if (query.Status is not null)
        {
            if (!Enum.TryParse<RecommendationPlanStatus>(query.Status, true, out var status))
                return Fail(StatusCodes.Status400BadRequest, "VALIDATION_ERROR", "Trạng thái kế hoạch không hợp lệ.");
            plans = plans.Where(p => p.Status == status);
        }
        var page = await ToPageAsync(plans.OrderByDescending(p => p.CreatedAt).ThenByDescending(p => p.Id), query, cancellationToken);
        return Ok(new PagedResult<PlanView>(await Views(page.Items, cancellationToken), page.TotalCount, page.Page, page.PageSize));
    }

    [HttpPost("recommendation-plans")]
    public async Task<IActionResult> CreatePlan(PlanUpsertRequest request, CancellationToken cancellationToken)
    {
        if (await Invalid(request, cancellationToken) is { } problem) return problem;
        await FeedbackController.EnsureStaffProfile(db, AccountId, cancellationToken);
        var plan = new RecommendationPlan { CreatedBy = AccountId };
        Apply(plan, request);
        db.Add(plan);
        await db.SaveChangesAsync(cancellationToken);
        db.AddRange(Products(plan.Id, request.ProductIds));
        await db.SaveChangesAsync(cancellationToken);
        return StatusCode(StatusCodes.Status201Created, (await Views([plan], cancellationToken))[0]);
    }

    [HttpGet("recommendation-plans/{id:int}")]
    public async Task<IActionResult> GetPlan(int id, CancellationToken cancellationToken)
    {
        var plan = await db.Set<RecommendationPlan>().SingleOrDefaultAsync(p => p.Id == id, cancellationToken);
        return plan is null ? NotFound() : Ok((await Views([plan], cancellationToken))[0]);
    }

    [HttpPut("recommendation-plans/{id:int}")]
    public async Task<IActionResult> UpdatePlan(int id, PlanUpsertRequest request, CancellationToken cancellationToken)
    {
        var plan = await db.Set<RecommendationPlan>().SingleOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (plan is null) return NotFound();
        if (plan.Status != RecommendationPlanStatus.Draft) return NotDraft();
        if (await Invalid(request, cancellationToken) is { } problem) return problem;
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        Apply(plan, request);
        await db.Set<RecommendationPlanProduct>().Where(x => x.PlanId == id).ExecuteDeleteAsync(cancellationToken);
        db.AddRange(Products(id, request.ProductIds));
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Ok((await Views([plan], cancellationToken))[0]);
    }

    [HttpDelete("recommendation-plans/{id:int}")]
    public async Task<IActionResult> DeletePlan(int id, CancellationToken cancellationToken)
    {
        var plan = await db.Set<RecommendationPlan>().SingleOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (plan is null) return NotFound();
        if (plan.Status != RecommendationPlanStatus.Draft) return NotDraft();
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await db.Set<RecommendationPlanProduct>().Where(x => x.PlanId == id).ExecuteDeleteAsync(cancellationToken);
        db.Remove(plan);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return NoContent();
    }

    [HttpPost("recommendation-plans/{id:int}/activate")]
    public async Task<IActionResult> Activate(int id, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var plan = await db.Set<RecommendationPlan>().AsNoTracking().SingleOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (plan is null) return NotFound();
        if (plan.EndAt <= now)
            return Fail(StatusCodes.Status400BadRequest, "PLAN_EXPIRED", "Kế hoạch đã qua ngày kết thúc. Hãy sửa thời gian trước khi kích hoạt.");
        var updated = await db.Set<RecommendationPlan>().Where(p => p.Id == id && p.Status == RecommendationPlanStatus.Draft)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Status, RecommendationPlanStatus.Active), cancellationToken);
        if (updated != 1) return NotDraft();
        var audience = await recommendations.PlanAudienceAsync(plan, cancellationToken);
        db.AddRange(audience.Select(customerId => new Notification
        {
            AccountId = customerId, Type = "recommendation", Title = $"Gợi ý mới dành cho bạn: {plan.Name}",
            RefType = nameof(RecommendationPlan), RefId = id, CreatedAt = now
        }));
        await db.SaveChangesAsync(cancellationToken);
        var result = await recommendations.RebuildAsync(audience, cancellationToken);
        return Ok(new PlanRunResult(audience.Count, result.RecommendationCount));
    }

    [HttpPost("recommendation-plans/{id:int}/end")]
    public async Task<IActionResult> End(int id, CancellationToken cancellationToken)
    {
        var plan = await db.Set<RecommendationPlan>().AsNoTracking().SingleOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (plan is null) return NotFound();
        var updated = await db.Set<RecommendationPlan>().Where(p => p.Id == id && p.Status == RecommendationPlanStatus.Active)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Status, RecommendationPlanStatus.Ended), cancellationToken);
        if (updated != 1)
            return Fail(StatusCodes.Status409Conflict, "PLAN_NOT_ACTIVE", "Chỉ kết thúc được kế hoạch đang chạy.");
        var audience = await recommendations.PlanAudienceAsync(plan, cancellationToken);
        var result = await recommendations.RebuildAsync(audience, cancellationToken);
        return Ok(new PlanRunResult(audience.Count, result.RecommendationCount));
    }

    /// <summary>M13 "Tính lại gợi ý": every customer, after refreshing mv_product_copurchase.</summary>
    [HttpPost("recommendations/rebuild")]
    public async Task<IActionResult> Rebuild(CancellationToken cancellationToken) =>
        Ok(await recommendations.RebuildAsync(null, cancellationToken));

    private async Task<ObjectResult?> Invalid(PlanUpsertRequest request, CancellationToken cancellationToken)
    {
        var ids = request.ProductIds?.Distinct().ToArray() ?? [];
        var problem =
            string.IsNullOrWhiteSpace(request.Name) || request.Name.Trim().Length > 120 ? "Tên kế hoạch cần từ 1 đến 120 ký tự."
            : request.Goal?.Length > 1000 ? "Mục tiêu tối đa 1000 ký tự."
            : request.EndAt <= request.StartAt ? "Ngày kết thúc phải sau ngày bắt đầu."
            : ids.Length == 0 ? "Chọn ít nhất một sản phẩm cho kế hoạch."
            : SegmentMatcher.Validate(request.Segment)
            ?? (await db.Set<Product>().CountAsync(p => ids.Contains(p.Id), cancellationToken) != ids.Length
                ? "Có sản phẩm không còn tồn tại. Hãy tải lại trang." : null);
        return problem is null ? null : Fail(StatusCodes.Status400BadRequest, "VALIDATION_ERROR", problem);
    }

    private static void Apply(RecommendationPlan plan, PlanUpsertRequest request)
    {
        (plan.Name, plan.Goal) = (request.Name.Trim(), string.IsNullOrWhiteSpace(request.Goal) ? null : request.Goal.Trim());
        (plan.StartAt, plan.EndAt) = (request.StartAt.ToUniversalTime(), request.EndAt.ToUniversalTime());
        plan.Segment = JsonSerializer.Serialize(request.Segment ?? new SegmentFilter(null, null, null, null, null, null, null), Json);
    }

    private static IEnumerable<RecommendationPlanProduct> Products(int planId, int[] productIds) =>
        productIds.Distinct().Select((productId, index) => new RecommendationPlanProduct { PlanId = planId, ProductId = productId, SortOrder = index });

    private ObjectResult NotDraft() =>
        Fail(StatusCodes.Status409Conflict, "PLAN_NOT_DRAFT", "Chỉ sửa, xóa hoặc kích hoạt được kế hoạch ở trạng thái nháp.");

    /// <summary>recipientCount is the segment size today; clickRate is null until the plan has produced suggestions.</summary>
    private async Task<List<PlanView>> Views(IReadOnlyList<RecommendationPlan> plans, CancellationToken cancellationToken)
    {
        var ids = plans.Select(p => p.Id).ToArray();
        var products = (await db.Set<RecommendationPlanProduct>().Where(x => ids.Contains(x.PlanId)).OrderBy(x => x.SortOrder)
            .ToListAsync(cancellationToken)).ToLookup(x => x.PlanId, x => x.ProductId);
        var runs = await db.Set<Recommendation>().Where(r => r.PlanId != null && ids.Contains(r.PlanId.Value)).GroupBy(r => r.PlanId!.Value)
            .Select(g => new { PlanId = g.Key, Total = g.Count(), Clicked = g.Count(r => r.Status == RecommendationStatus.Clicked) })
            .ToDictionaryAsync(x => x.PlanId, cancellationToken);
        var customers = plans.Count == 0 ? [] : await recommendations.ConsentingFactsAsync(cancellationToken);
        return plans.Select(p =>
        {
            var segment = RecommendationService.ReadSegment(p.Segment) ?? new SegmentFilter(null, null, null, null, null, null, null);
            var run = runs.GetValueOrDefault(p.Id);
            return new PlanView(p.Id, p.Name, p.Goal, p.Status, p.StartAt, p.EndAt, segment, products[p.Id].ToArray(),
                customers.Count(c => SegmentMatcher.Matches(c, segment)), run is null ? null : Math.Round((double)run.Clicked / run.Total, 4));
        }).ToList();
    }
}

public sealed record PlanUpsertRequest(string Name, string? Goal, DateTime StartAt, DateTime EndAt,
    SegmentFilter? Segment, int[] ProductIds);
/// <summary>Matches apps/web/features/recommendations/types.ts RecommendationPlan.</summary>
public sealed record PlanView(int Id, string Name, string? Goal, RecommendationPlanStatus Status, DateTime StartAt, DateTime EndAt,
    SegmentFilter Segment, int[] ProductIds, int RecipientCount, double? ClickRate);
public sealed record PlanRunResult(int AudienceCount, int RecommendationCount);
