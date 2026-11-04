using System.Text.Json.Serialization;
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
/// M7–M10 (spec 5.6.3). Content is editable only while Draft; publish opens it, close ends it. Recipients are added to an
/// Open survey and each new recipient gets a Notification.
/// </summary>
[Route("api/v1")]
[Authorize(Policy = "RequireManager")]
public sealed class SurveysController(AppDbContext db, CustomerFactsService facts) : ApiStubController
{
    private const string DeletedCustomer = "Khách đã xóa";

    [HttpGet("surveys")]
    public async Task<IActionResult> List([FromQuery] ListQuery query, CancellationToken cancellationToken)
    {
        var surveys = db.Set<Survey>().AsQueryable();
        if (query.Status is not null)
        {
            if (!Enum.TryParse<SurveyStatus>(query.Status, true, out var status))
                return Fail(StatusCodes.Status400BadRequest, "VALIDATION_ERROR", "Trạng thái khảo sát không hợp lệ.");
            surveys = surveys.Where(s => s.Status == status);
        }
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToUpper();
            surveys = surveys.Where(s => s.Title.ToUpper().Contains(term));
        }
        return Ok(await ToPageAsync(surveys.OrderByDescending(s => s.CreatedAt).ThenByDescending(s => s.Id).Select(s => new SurveyListItem(
            s.Id, s.Title, s.Purpose, s.Status, s.OpenAt, s.CloseAt,
            db.Set<SurveyQuestion>().Count(q => q.SurveyId == s.Id),
            db.Set<SurveyRecipient>().Count(r => r.SurveyId == s.Id),
            db.Set<SurveyResponse>().Count(r => r.SurveyId == s.Id))), query, cancellationToken));
    }

    [HttpPost("surveys")]
    public async Task<IActionResult> Create(SurveyUpsertRequest request, CancellationToken cancellationToken)
    {
        if (await Invalid(request, cancellationToken) is { } problem) return problem;
        await FeedbackController.EnsureStaffProfile(db, AccountId, cancellationToken);
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var survey = new Survey { CreatedBy = AccountId, Status = SurveyStatus.Draft };
        Apply(survey, request);
        db.Add(survey);
        await db.SaveChangesAsync(cancellationToken);
        await AddQuestions(survey.Id, request.Questions, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return StatusCode(StatusCodes.Status201Created, await Detail(survey, cancellationToken));
    }

    [HttpGet("surveys/{id:int}")]
    public async Task<IActionResult> Get(int id, CancellationToken cancellationToken)
    {
        var survey = await db.Set<Survey>().SingleOrDefaultAsync(s => s.Id == id, cancellationToken);
        return survey is null ? NotFound() : Ok(await Detail(survey, cancellationToken));
    }

    /// <summary>Replaces title, schedule and every question. Drafts have no answers, so nothing references the old rows.</summary>
    [HttpPut("surveys/{id:int}")]
    public async Task<IActionResult> Update(int id, SurveyUpsertRequest request, CancellationToken cancellationToken)
    {
        var survey = await db.Set<Survey>().SingleOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (survey is null) return NotFound();
        if (survey.Status != SurveyStatus.Draft) return NotDraft();
        if (await Invalid(request, cancellationToken) is { } problem) return problem;
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        Apply(survey, request);
        var questionIds = db.Set<SurveyQuestion>().Where(q => q.SurveyId == id).Select(q => q.Id);
        await db.Set<QuestionOption>().Where(o => questionIds.Contains(o.QuestionId)).ExecuteDeleteAsync(cancellationToken);
        await db.Set<SurveyQuestion>().Where(q => q.SurveyId == id).ExecuteDeleteAsync(cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        await AddQuestions(id, request.Questions, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Ok(await Detail(survey, cancellationToken));
    }

    /// <summary>Soft delete; answers stay for reports. An Open survey must be closed first.</summary>
    [HttpDelete("surveys/{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        var survey = await db.Set<Survey>().SingleOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (survey is null) return NotFound();
        if (survey.Status == SurveyStatus.Open)
            return Fail(StatusCodes.Status409Conflict, "SURVEY_OPEN", "Hãy đóng khảo sát trước khi xóa.");
        survey.IsDeleted = true;
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpPost("surveys/{id:int}/publish")]
    public async Task<IActionResult> Publish(int id, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var survey = await db.Set<Survey>().AsNoTracking().SingleOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (survey is null) return NotFound();
        if (survey.CloseAt <= now)
            return Fail(StatusCodes.Status400BadRequest, "VALIDATION_ERROR", "Ngày kết thúc đã qua. Hãy sửa lịch trước khi mở khảo sát.");
        var openAt = survey.OpenAt ?? now;
        var updated = await db.Set<Survey>().Where(s => s.Id == id && s.Status == SurveyStatus.Draft)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, SurveyStatus.Open).SetProperty(x => x.OpenAt, openAt), cancellationToken);
        return updated == 1 ? NoContent() : NotDraft();
    }

    /// <summary>Stops answers now; the schedule is pulled back so CloseAt is never after the actual close.</summary>
    [HttpPost("surveys/{id:int}/close")]
    public async Task<IActionResult> Close(int id, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var survey = await db.Set<Survey>().AsNoTracking().SingleOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (survey is null) return NotFound();
        var openAt = survey.OpenAt is { } open && open < now ? open : now;
        var closeAt = survey.CloseAt is { } close && close < now ? close : now;
        var updated = await db.Set<Survey>().Where(s => s.Id == id && s.Status == SurveyStatus.Open)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, SurveyStatus.Closed).SetProperty(x => x.OpenAt, openAt)
                .SetProperty(x => x.CloseAt, closeAt), cancellationToken);
        return updated == 1 ? NoContent() : NotOpen();
    }

    /// <summary>Adds customers from a segment or an explicit list; customers already invited are skipped.</summary>
    [HttpPost("surveys/{id:int}/recipients")]
    public async Task<IActionResult> AddRecipients(int id, RecipientsRequest request, CancellationToken cancellationToken)
    {
        var survey = await db.Set<Survey>().AsNoTracking().SingleOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (survey is null) return NotFound();
        if (survey.Status != SurveyStatus.Open) return NotOpen();
        if ((request.Segment is null) == (request.CustomerIds is null))
            return Fail(StatusCodes.Status400BadRequest, "VALIDATION_ERROR", "Chọn phân khúc hoặc danh sách khách hàng, không chọn cả hai.");
        if (SegmentMatcher.Validate(request.Segment) is { } segmentProblem)
            return Fail(StatusCodes.Status400BadRequest, "VALIDATION_ERROR", segmentProblem);
        List<int> customers;
        if (request.CustomerIds is { } ids)
        {
            var distinct = ids.Distinct().ToArray();
            customers = (await facts.LoadAsync(distinct, cancellationToken)).Select(c => c.Id).ToList();
            if (customers.Count != distinct.Length)
                return Fail(StatusCodes.Status400BadRequest, "VALIDATION_ERROR", "Có khách hàng không tồn tại hoặc đã bị khóa.");
        }
        else customers = (await facts.MatchAsync(request.Segment, cancellationToken)).Select(c => c.Id).ToList();

        var now = DateTime.UtcNow;
        var existing = await db.Set<SurveyRecipient>().Where(r => r.SurveyId == id).Select(r => r.CustomerId).ToListAsync(cancellationToken);
        var added = customers.Except(existing).ToList();
        db.AddRange(added.Select(customerId => new SurveyRecipient { SurveyId = id, CustomerId = customerId, SentAt = now }));
        db.AddRange(added.Select(customerId => new Notification
        {
            AccountId = customerId, Type = "survey", Title = $"Khảo sát mới: {survey.Title}", RefType = nameof(Survey), RefId = id, CreatedAt = now
        }));
        await db.SaveChangesAsync(cancellationToken);
        return Ok(new RecipientsAdded(added.Count, existing.Count + added.Count));
    }

    [HttpGet("surveys/{id:int}/results")]
    public async Task<IActionResult> Results(int id, CancellationToken cancellationToken)
    {
        var survey = await db.Set<Survey>().AsNoTracking().SingleOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (survey is null) return NotFound();
        var recipients = await db.Set<SurveyRecipient>().CountAsync(r => r.SurveyId == id, cancellationToken);
        var responses = await db.Set<SurveyResponse>().CountAsync(r => r.SurveyId == id, cancellationToken);
        var questions = await db.Set<SurveyQuestion>().Where(q => q.SurveyId == id).OrderBy(q => q.SortOrder).ToListAsync(cancellationToken);
        var questionIds = questions.Select(q => q.Id).ToArray();
        var options = (await db.Set<QuestionOption>().Where(o => questionIds.Contains(o.QuestionId)).OrderBy(o => o.SortOrder)
            .ToListAsync(cancellationToken)).ToLookup(o => o.QuestionId);
        var answers = (await (
            from a in db.Set<SurveyAnswer>()
            join r in db.Set<SurveyResponse>() on a.ResponseId equals r.Id
            join c in db.Set<CustomerProfile>() on r.CustomerId equals c.AccountId into customers
            from c in customers.DefaultIfEmpty()
            where r.SurveyId == id
            select new { a.QuestionId, a.ResponseId, a.OptionId, a.NumericValue, a.TextValue, CustomerName = c == null ? null : c.FullName })
            .ToListAsync(cancellationToken)).ToLookup(a => a.QuestionId);

        return Ok(new SurveyResults(id, survey.Title, survey.Status, recipients, responses,
            recipients == 0 ? 0 : Math.Round((double)responses / recipients, 4),
            questions.Select(q =>
            {
                var rows = answers[q.Id].ToList();
                var answered = rows.Select(a => a.ResponseId).Distinct().Count();
                return q.Type switch
                {
                    QuestionType.SingleChoice or QuestionType.MultiChoice => new QuestionResult(q.Id, q.Type, q.Text, answered,
                        Options: options[q.Id].Select(o => new OptionCount(o.Id, o.Text, rows.Count(a => a.OptionId == o.Id))).ToList()),
                    QuestionType.Rating => new QuestionResult(q.Id, q.Type, q.Text, answered,
                        Average: rows.Any(a => a.NumericValue is not null) ? Math.Round((double)rows.Where(a => a.NumericValue is not null).Average(a => a.NumericValue!.Value), 2) : null,
                        Distribution: Enumerable.Range(1, 5).ToDictionary(star => star, star => rows.Count(a => a.NumericValue is { } v && (int)Math.Round(v) == star))),
                    _ => new QuestionResult(q.Id, q.Type, q.Text, answered,
                        Answers: rows.Where(a => !string.IsNullOrWhiteSpace(a.TextValue))
                            .Select(a => new TextAnswer(a.CustomerName ?? DeletedCustomer, a.TextValue!)).ToList()),
                };
            }).ToList()));
    }

    /// <summary>M9: how many active customers a segment reaches, with five of them as a sample.</summary>
    [HttpPost("segments/preview")]
    public async Task<IActionResult> PreviewSegment(SegmentFilter filter, CancellationToken cancellationToken)
    {
        if (SegmentMatcher.Validate(filter) is { } problem) return Fail(StatusCodes.Status400BadRequest, "VALIDATION_ERROR", problem);
        var matched = await facts.MatchAsync(filter, cancellationToken);
        return Ok(new SegmentPreview(matched.Count, matched.OrderBy(c => c.Id).Take(5)
            .Select(c => new SegmentSample(c.Id, $"KH-{c.Id:D4}", c.FullName, c.Email, c.Age, c.Gender)).ToList()));
    }

    private async Task<ObjectResult?> Invalid(SurveyUpsertRequest request, CancellationToken cancellationToken)
    {
        var questions = request.Questions ?? [];
        var preferenceIds = questions.SelectMany(q => q.Options ?? []).Select(o => o.PreferenceId).OfType<int>().Distinct().ToArray();
        var problem =
            string.IsNullOrWhiteSpace(request.Title) || request.Title.Trim().Length > 200 ? "Tên khảo sát cần từ 1 đến 200 ký tự."
            : request.Description?.Length > 1000 ? "Mô tả tối đa 1000 ký tự."
            : !Enum.IsDefined(request.Purpose) ? "Mục đích khảo sát không hợp lệ."
            : request is { OpenAt: { } open, CloseAt: { } close } && close <= open ? "Ngày kết thúc phải sau ngày bắt đầu."
            : questions.Length is < 1 or > 50 ? "Khảo sát cần từ 1 đến 50 câu hỏi."
            : questions.Select(QuestionProblem).FirstOrDefault(p => p is not null)
            ?? (request.Purpose == SurveyPurpose.NewProduct && (request.ProductId is not { } productId
                || !await db.Set<Product>().AnyAsync(p => p.Id == productId, cancellationToken))
                ? "Chọn sản phẩm sắp ra mắt cho khảo sát sản phẩm mới." : null)
            ?? (!await AuthController.PreferencesExist(db, preferenceIds, cancellationToken)
                ? "Có sở thích không còn tồn tại. Hãy tải lại trang." : null);
        return problem is null ? null : Fail(StatusCodes.Status400BadRequest, "VALIDATION_ERROR", problem);
    }

    private static string? QuestionProblem(QuestionInput q)
    {
        var options = q.Options ?? [];
        var choice = q.Type is QuestionType.SingleChoice or QuestionType.MultiChoice;
        return string.IsNullOrWhiteSpace(q.Text) || q.Text.Trim().Length > 500 ? "Mỗi câu hỏi cần từ 1 đến 500 ký tự."
            : !Enum.IsDefined(q.Type) ? "Loại câu hỏi không hợp lệ."
            : choice && options.Length is < 2 or > 20 ? "Câu chọn lựa cần từ 2 đến 20 lựa chọn."
            : !choice && options.Length > 0 ? "Chỉ câu chọn lựa mới có lựa chọn."
            : options.Any(o => string.IsNullOrWhiteSpace(o.Text) || o.Text.Trim().Length > 200) ? "Mỗi lựa chọn cần từ 1 đến 200 ký tự."
            : null;
    }

    private static void Apply(Survey survey, SurveyUpsertRequest request)
    {
        (survey.Title, survey.Description, survey.Purpose) =
            (request.Title.Trim(), string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(), request.Purpose);
        survey.ProductId = request.Purpose == SurveyPurpose.NewProduct ? request.ProductId : null;
        (survey.OpenAt, survey.CloseAt) = (request.OpenAt?.ToUniversalTime(), request.CloseAt?.ToUniversalTime());
    }

    private async Task AddQuestions(int surveyId, QuestionInput[] questions, CancellationToken cancellationToken)
    {
        var rows = questions.Select((q, index) => (Input: q, Entity: new SurveyQuestion
        {
            SurveyId = surveyId, Text = q.Text.Trim(), Type = q.Type, IsRequired = q.IsRequired, SortOrder = index
        })).ToList();
        db.AddRange(rows.Select(x => x.Entity));
        await db.SaveChangesAsync(cancellationToken);
        db.AddRange(rows.SelectMany(x => (x.Input.Options ?? []).Select((o, index) => new QuestionOption
        {
            QuestionId = x.Entity.Id, Text = o.Text.Trim(), SortOrder = index, PreferenceId = o.PreferenceId
        })));
        await db.SaveChangesAsync(cancellationToken);
    }

    private async Task<SurveyDetail> Detail(Survey survey, CancellationToken cancellationToken)
    {
        var questions = await db.Set<SurveyQuestion>().Where(q => q.SurveyId == survey.Id).OrderBy(q => q.SortOrder).ToListAsync(cancellationToken);
        var ids = questions.Select(q => q.Id).ToArray();
        var options = (await db.Set<QuestionOption>().Where(o => ids.Contains(o.QuestionId)).OrderBy(o => o.SortOrder)
            .ToListAsync(cancellationToken)).ToLookup(o => o.QuestionId);
        return new SurveyDetail(survey.Id, survey.Title, survey.Description, survey.Purpose, survey.ProductId, survey.Status,
            survey.OpenAt, survey.CloseAt, survey.CreatedAt,
            await db.Set<SurveyRecipient>().CountAsync(r => r.SurveyId == survey.Id, cancellationToken),
            await db.Set<SurveyResponse>().CountAsync(r => r.SurveyId == survey.Id, cancellationToken),
            questions.Select(q => new QuestionView(q.Id, q.Text, q.Type, q.IsRequired,
                options[q.Id].Select(o => new OptionView(o.Id, o.Text, o.PreferenceId)).ToList())).ToList());
    }

    private ObjectResult NotDraft() =>
        Fail(StatusCodes.Status409Conflict, "SURVEY_NOT_DRAFT", "Chỉ sửa hoặc mở được khảo sát ở trạng thái nháp.");

    private ObjectResult NotOpen() =>
        Fail(StatusCodes.Status409Conflict, "SURVEY_NOT_OPEN", "Khảo sát không ở trạng thái đang mở.");
}

public sealed record SurveyUpsertRequest(string Title, string? Description, SurveyPurpose Purpose, int? ProductId,
    DateTime? OpenAt, DateTime? CloseAt, QuestionInput[] Questions);
public sealed record QuestionInput(string Text, QuestionType Type, bool IsRequired, OptionInput[] Options);
public sealed record OptionInput(string Text, int? PreferenceId);
public sealed record RecipientsRequest(SegmentFilter? Segment, int[]? CustomerIds);

/// <summary>Row of M7. Matches apps/web/features/surveys/types.ts SurveyListItem.</summary>
public sealed record SurveyListItem(int Id, string Title, SurveyPurpose Purpose, SurveyStatus Status, DateTime? OpenAt, DateTime? CloseAt,
    int QuestionCount, int RecipientCount, int ResponseCount);
public sealed record SurveyDetail(int Id, string Title, string? Description, SurveyPurpose Purpose, int? ProductId, SurveyStatus Status,
    DateTime? OpenAt, DateTime? CloseAt, DateTime CreatedAt, int RecipientCount, int ResponseCount, IReadOnlyList<QuestionView> Questions);
public sealed record QuestionView(int Id, string Text, QuestionType Type, bool IsRequired, IReadOnlyList<OptionView> Options);
public sealed record OptionView(int Id, string Text, int? PreferenceId);
public sealed record RecipientsAdded(int Added, int Total);
public sealed record SegmentPreview(int Count, IReadOnlyList<SegmentSample> Sample);
public sealed record SegmentSample(int Id, string Code, string FullName, string Email, int? Age, string? Gender);

/// <summary>M10. Each question carries only the fields of its kind, as in apps/web/features/surveys/types.ts QuestionResult.</summary>
public sealed record SurveyResults(int SurveyId, string Title, SurveyStatus Status, int RecipientCount, int ResponseCount,
    double CompletionRate, IReadOnlyList<QuestionResult> Questions);
public sealed record QuestionResult(int QuestionId, QuestionType Kind, string Text, int AnswerCount,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IReadOnlyList<OptionCount>? Options = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] double? Average = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IReadOnlyDictionary<int, int>? Distribution = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IReadOnlyList<TextAnswer>? Answers = null);
public sealed record OptionCount(int Id, string Text, int Count);
public sealed record TextAnswer(string CustomerName, string Content);
