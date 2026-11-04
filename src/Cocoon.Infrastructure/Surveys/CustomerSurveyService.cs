using System.Data;
using System.Diagnostics.CodeAnalysis;
using Cocoon.Application.Surveys;
using Cocoon.Domain.Entities;
using Cocoon.Domain.Enums;
using Cocoon.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Cocoon.Infrastructure.Surveys;

/// <summary>Customer surveys: token ownership, answer rules and all submission effects share one transaction.</summary>
public sealed class CustomerSurveyService(AppDbContext db)
{
    public async Task<CustomerSurveyPage> ListAsync(int customerId, CustomerSurveyQuery query, CancellationToken ct)
    {
        if (query.Sort is not (null or "sentAt" or "title" or "closeAt" or "completedAt")) Invalid("sort", "Cột sắp xếp không hợp lệ.");
        SurveyStatus? status = null;
        if (query.Status is not null)
        {
            if (!Enum.TryParse<SurveyStatus>(query.Status, true, out var parsed) || !Enum.IsDefined(parsed))
                Invalid("status", "Trạng thái khảo sát không hợp lệ.");
            else status = parsed;
        }
        var rows = from recipient in db.Set<SurveyRecipient>().AsNoTracking()
                   join survey in db.Set<Survey>().IgnoreQueryFilters() on recipient.SurveyId equals survey.Id
                   join response in db.Set<SurveyResponse>().Where(r => r.CustomerId == customerId) on survey.Id equals response.SurveyId into responses
                   from response in responses.DefaultIfEmpty()
                   where recipient.CustomerId == customerId && survey.Status != SurveyStatus.Draft
                       && (!survey.IsDeleted || response != null)
                   select new InboxRow
                   {
                       Id = survey.Id, Title = survey.Title, Description = survey.Description, Purpose = survey.Purpose,
                       Status = survey.Status, OpenAt = survey.OpenAt, CloseAt = survey.CloseAt, SentAt = recipient.SentAt,
                       CompletedAt = response == null ? recipient.CompletedAt : response.SubmittedAt,
                       QuestionCount = db.Set<SurveyQuestion>().Count(q => q.SurveyId == survey.Id)
                   };
        if (status is not null) rows = rows.Where(r => r.Status == status.Value);
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToUpperInvariant();
            if (term.Length > 200) Invalid("search", "Từ khóa tối đa 200 ký tự.");
            rows = rows.Where(r => r.Title.ToUpper().Contains(term));
        }
        var ordered = query.Sort switch
        {
            "title" => rows.OrderBy(r => r.Title),
            "closeAt" => rows.OrderBy(r => r.CloseAt == null).ThenBy(r => r.CloseAt),
            "completedAt" => rows.OrderByDescending(r => r.CompletedAt),
            _ => rows.OrderByDescending(r => r.SentAt)
        };
        var (page, size) = (Math.Max(1, query.Page), Math.Clamp(query.PageSize, 1, 100));
        var total = await rows.CountAsync(ct);
        if ((long)(page - 1) * size > int.MaxValue) return new([], total, page, size);
        var items = await ordered.ThenByDescending(r => r.Id).Skip((page - 1) * size).Take(size).ToListAsync(ct);
        return new(items.Select(r => new CustomerSurveyListItem(r.Id, r.Title, r.Description ?? "", Category(r.Purpose), r.Status,
            r.OpenAt, r.CloseAt, r.CompletedAt, r.QuestionCount, Math.Max(1, (r.QuestionCount + 2) / 3))).ToList(), total, page, size);
    }

    public async Task<CustomerSurveyDetails> DetailAsync(int customerId, int surveyId, CancellationToken ct)
    {
        var (survey, recipient) = await FindAsync(customerId, surveyId, ct, allowCompletedDeleted: true);
        var response = await db.Set<SurveyResponse>().AsNoTracking().SingleOrDefaultAsync(r => r.SurveyId == surveyId && r.CustomerId == customerId, ct);
        var completedAt = response?.SubmittedAt ?? recipient.CompletedAt;
        if (completedAt is null) EnsureOpen(survey, DateTime.UtcNow);
        var questions = await db.Set<SurveyQuestion>().AsNoTracking().Where(q => q.SurveyId == surveyId).OrderBy(q => q.SortOrder).ThenBy(q => q.Id).ToListAsync(ct);
        var ids = questions.Select(q => q.Id).ToArray();
        var options = (await db.Set<QuestionOption>().AsNoTracking().Where(o => ids.Contains(o.QuestionId)).OrderBy(o => o.SortOrder).ThenBy(o => o.Id).ToListAsync(ct))
            .ToLookup(o => o.QuestionId);
        var answers = response is null ? [] : await db.Set<SurveyAnswer>().AsNoTracking().Where(a => a.ResponseId == response.Id).OrderBy(a => a.Id).ToListAsync(ct);
        return new(survey.Id, survey.Title, survey.Description ?? "", survey.Status, survey.OpenAt, survey.CloseAt, completedAt,
            questions.Select(q => new CustomerSurveyQuestion(q.Id, q.Text, q.Type, q.IsRequired,
                options[q.Id].Select(o => new CustomerSurveyOption(o.Id, o.Text)).ToList())).ToList(),
            answers.GroupBy(a => a.QuestionId).Select(g => new CustomerSurveyAnswerValue(g.Key,
                g.Where(a => a.OptionId != null).Select(a => a.OptionId!.Value).ToArray(), g.First().NumericValue, g.First().TextValue)).ToList());
    }

    public async Task<CustomerSurveySubmitted> SubmitAsync(int customerId, int surveyId, IReadOnlyList<CustomerSurveyAnswerValue?>? answers, CancellationToken ct)
    {
        // Serializable retries also cover two surveys learning the same tag or a concurrent consent/profile update.
        for (var attempt = 0; attempt < 3; attempt++)
        {
            try { return await SubmitOnceAsync(customerId, surveyId, answers, ct); }
            catch (Exception e) when (PostgresError(e) is { SqlState: PostgresErrorCodes.UniqueViolation,
                ConstraintName: "IX_SurveyResponse_SurveyId_CustomerId" })
            { db.ChangeTracker.Clear(); throw AlreadySubmitted(); }
            catch (Exception e) when (Retryable(e))
            {
                db.ChangeTracker.Clear();
                if (attempt == 2) throw new CustomerSurveyException(409, "SURVEY_CONCURRENT_UPDATE", "Dữ liệu khảo sát vừa thay đổi. Vui lòng thử lại.");
            }
        }
        throw new InvalidOperationException("Không thể hoàn tất giao dịch khảo sát.");
    }

    private async Task<CustomerSurveySubmitted> SubmitOnceAsync(int customerId, int surveyId, IReadOnlyList<CustomerSurveyAnswerValue?>? answers, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var (survey, recipient) = await FindAsync(customerId, surveyId, ct);
        var now = DateTime.UtcNow;
        EnsureOpen(survey, now);
        if (recipient.Status == RecipientStatus.Done || await db.Set<SurveyResponse>().AnyAsync(r => r.SurveyId == surveyId && r.CustomerId == customerId, ct))
            throw AlreadySubmitted();
        var customer = await db.Set<CustomerProfile>().SingleOrDefaultAsync(p => p.AccountId == customerId && p.Account.IsActive && p.Account.Role == AccountRole.Customer, ct)
            ?? throw new CustomerSurveyException(403, "SURVEY_FORBIDDEN", "Tài khoản không được phép thực hiện khảo sát.");
        var questions = await db.Set<SurveyQuestion>().AsNoTracking().Where(q => q.SurveyId == surveyId).ToListAsync(ct);
        var questionIds = questions.Select(q => q.Id).ToArray();
        var options = await db.Set<QuestionOption>().AsNoTracking().Where(o => questionIds.Contains(o.QuestionId)).ToListAsync(ct);
        var validated = Validate(answers, questions, options);
        var response = new SurveyResponse { SurveyId = surveyId, CustomerId = customerId, SubmittedAt = now };
        db.Add(response);
        await db.SaveChangesAsync(ct); // Obtain the response id; failure later rolls this insert back too.
        foreach (var answer in validated)
        {
            if (answer.OptionIds is { Length: > 0 })
                db.AddRange(answer.OptionIds.Select(option => new SurveyAnswer { ResponseId = response.Id, QuestionId = answer.QuestionId, OptionId = option }));
            else if (answer.NumericValue is not null || !string.IsNullOrWhiteSpace(answer.TextValue))
                db.Add(new SurveyAnswer { ResponseId = response.Id, QuestionId = answer.QuestionId, NumericValue = answer.NumericValue, TextValue = answer.TextValue?.Trim() });
        }
        recipient.Status = RecipientStatus.Done;
        recipient.CompletedAt = now;
        if (customer.ConsentPersonalData)
        {
            var selected = validated.SelectMany(a => a.OptionIds ?? []).ToHashSet();
            var learned = options.Where(o => selected.Contains(o.Id) && o.PreferenceId != null).Select(o => o.PreferenceId!.Value).Distinct().ToArray();
            var existing = await db.Set<CustomerPreference>().Where(p => p.CustomerId == customerId).Select(p => p.PreferenceId).ToListAsync(ct);
            db.AddRange(learned.Except(existing).Select(id => new CustomerPreference { CustomerId = customerId, PreferenceId = id, Source = PreferenceSource.Survey, CreatedAt = now }));
        }
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return new(response.Id, now);
    }

    private async Task<(Survey Survey, SurveyRecipient Recipient)> FindAsync(int customerId, int surveyId, CancellationToken ct,
        bool allowCompletedDeleted = false)
    {
        var survey = await db.Set<Survey>().IgnoreQueryFilters().SingleOrDefaultAsync(s => s.Id == surveyId, ct)
            ?? throw new CustomerSurveyException(404, "NOT_FOUND", "Không tìm thấy khảo sát.");
        if (survey.IsDeleted && (!allowCompletedDeleted || !await db.Set<SurveyResponse>()
            .AnyAsync(r => r.SurveyId == surveyId && r.CustomerId == customerId, ct)))
            throw new CustomerSurveyException(404, "NOT_FOUND", "Không tìm thấy khảo sát.");
        var recipient = await db.Set<SurveyRecipient>().SingleOrDefaultAsync(r => r.SurveyId == surveyId && r.CustomerId == customerId, ct)
            ?? throw new CustomerSurveyException(403, "SURVEY_NOT_RECIPIENT", "Bạn không nằm trong danh sách nhận khảo sát này.");
        return (survey, recipient);
    }

    private static IReadOnlyList<CustomerSurveyAnswerValue> Validate(IReadOnlyList<CustomerSurveyAnswerValue?>? answers,
        IReadOnlyList<SurveyQuestion> questions, IReadOnlyList<QuestionOption> options)
    {
        if (answers is null || answers.Count > 100) Invalid("answers", "Danh sách câu trả lời không hợp lệ (tối đa 100 câu).");
        if (questions.Count == 0) throw new CustomerSurveyException(409, "SURVEY_NOT_OPEN", "Khảo sát chưa có câu hỏi để thực hiện.");
        var byId = questions.ToDictionary(q => q.Id);
        var seen = new HashSet<int>();
        for (var i = 0; i < answers!.Count; i++)
        {
            var answer = answers[i];
            var field = $"answers[{i}]";
            if (answer is null) Invalid(field, "Câu trả lời không được để trống.");
            if (!byId.TryGetValue(answer!.QuestionId, out var question)) Invalid(field + ".questionId", "Câu hỏi không thuộc khảo sát.");
            if (!seen.Add(answer.QuestionId)) Invalid(field + ".questionId", "Mỗi câu hỏi chỉ được trả lời một lần.");
            var ids = answer.OptionIds ?? [];
            if (ids.Length != ids.Distinct().Count()) Invalid(field + ".optionIds", "Lựa chọn bị trùng lặp.");
            switch (question!.Type)
            {
                case QuestionType.SingleChoice:
                case QuestionType.MultiChoice:
                    if (answer.NumericValue is not null || answer.TextValue is not null || question.Type == QuestionType.SingleChoice && ids.Length > 1
                        || ids.Any(id => !options.Any(o => o.Id == id && o.QuestionId == question.Id)))
                        Invalid(field + ".optionIds", "Lựa chọn không hợp lệ hoặc không thuộc câu hỏi.");
                    if (question.IsRequired && ids.Length == 0) Invalid(field + ".optionIds", "Vui lòng chọn câu trả lời.");
                    break;
                case QuestionType.Rating:
                    if (ids.Length > 0 || answer.TextValue is not null || answer.NumericValue is { } value && (value < 1 || value > 5 || value != decimal.Truncate(value)))
                        Invalid(field + ".numericValue", "Điểm đánh giá phải là số nguyên từ 1 đến 5.");
                    if (question.IsRequired && answer.NumericValue is null) Invalid(field + ".numericValue", "Vui lòng chọn điểm đánh giá.");
                    break;
                case QuestionType.ShortText:
                    if (ids.Length > 0 || answer.NumericValue is not null || answer.TextValue?.Length > 1000)
                        Invalid(field + ".textValue", "Câu trả lời văn bản tối đa 1.000 ký tự và không có lựa chọn hoặc điểm số.");
                    if (question.IsRequired && string.IsNullOrWhiteSpace(answer.TextValue)) Invalid(field + ".textValue", "Vui lòng nhập câu trả lời.");
                    break;
                default: Invalid(field, "Loại câu hỏi không hợp lệ."); break;
            }
        }
        foreach (var required in questions.Where(q => q.IsRequired))
            if (!seen.Contains(required.Id)) Invalid("answers", $"Chưa trả lời câu hỏi bắt buộc {required.Id}.");
        return answers.Select(a => a!).ToList();
    }

    private static void EnsureOpen(Survey survey, DateTime now)
    {
        if (survey.Status != SurveyStatus.Open || survey.OpenAt > now || survey.CloseAt <= now)
            throw new CustomerSurveyException(409, "SURVEY_NOT_OPEN", "Khảo sát chưa mở hoặc đã kết thúc.");
    }

    private static bool Retryable(Exception exception)
    {
        var postgres = PostgresError(exception);
        return postgres?.SqlState is PostgresErrorCodes.SerializationFailure or PostgresErrorCodes.DeadlockDetected
            || postgres is { SqlState: PostgresErrorCodes.UniqueViolation, ConstraintName: "PK_CustomerPreference" };
    }

    // The provider can wrap a serialization failure in InvalidOperationException before it reaches SaveChanges.
    private static PostgresException? PostgresError(Exception exception)
    {
        for (Exception? current = exception; current is not null; current = current.InnerException)
            if (current is PostgresException postgres) return postgres;
        return null;
    }

    private static CustomerSurveyException AlreadySubmitted() => new(409, "SURVEY_ALREADY_SUBMITTED", "Bạn đã hoàn thành khảo sát này.");
    [DoesNotReturn]
    private static void Invalid(string field, string message) => throw new CustomerSurveyException(400, "VALIDATION_ERROR", message, field);
    private static string Category(SurveyPurpose purpose) => purpose switch
    { SurveyPurpose.Satisfaction => "Trải nghiệm sản phẩm", SurveyPurpose.NewProduct => "Nghiên cứu sản phẩm", _ => "Lắng nghe khách hàng" };

    private sealed class InboxRow
    {
        public int Id { get; init; }
        public string Title { get; init; } = "";
        public string? Description { get; init; }
        public SurveyPurpose Purpose { get; init; }
        public SurveyStatus Status { get; init; }
        public DateTime SentAt { get; init; }
        public DateTime? OpenAt { get; init; }
        public DateTime? CloseAt { get; init; }
        public DateTime? CompletedAt { get; init; }
        public int QuestionCount { get; init; }
    }
}
