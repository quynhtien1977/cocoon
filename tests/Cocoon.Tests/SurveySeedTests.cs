using System.Text.Json;
using Cocoon.Application.Recommendations;
using Cocoon.Domain.Entities;
using Cocoon.Domain.Enums;
using Cocoon.Infrastructure.Persistence;
using Cocoon.Infrastructure.Recommendations;
using Cocoon.Infrastructure.Seeding;
using Microsoft.EntityFrameworkCore;

namespace Cocoon.Tests;

public sealed class SurveySeedTests(DemoSeedDatabaseFixture database) : IClassFixture<DemoSeedDatabaseFixture>
{
    private static readonly DateTime ReferenceUtc = new(2026, 11, 4, 0, 0, 0, DateTimeKind.Utc);
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    [Fact]
    public async Task Seed_v3_has_complete_surveys_valid_submissions_and_runnable_plans()
    {
        await using var db = database.CreateContext();
        await using var transaction = await db.Database.BeginTransactionAsync();

        await new DemoDataSeeder(db, _ => "test-hash", ReferenceUtc).RunAsync(includeSurveysAndPlans: true);
        db.ChangeTracker.Clear();

        Assert.Equal(87, await db.Set<Account>().IgnoreQueryFilters().CountAsync());
        Assert.Equal(60, await db.Set<Feedback>().CountAsync());
        var accounts = await db.Set<Account>().ToDictionaryAsync(a => a.Id);
        var customers = await db.Set<CustomerProfile>().ToDictionaryAsync(c => c.AccountId);
        var surveys = await db.Set<Survey>().OrderBy(s => s.Id).ToListAsync();
        var questions = await db.Set<SurveyQuestion>().ToListAsync();
        var options = await db.Set<QuestionOption>().ToListAsync();
        var recipients = await db.Set<SurveyRecipient>().ToListAsync();
        var responses = await db.Set<SurveyResponse>().ToListAsync();
        var answers = await db.Set<SurveyAnswer>().ToListAsync();
        var preferences = await db.Set<CustomerPreference>().ToListAsync();
        var notifications = await db.Set<Notification>().Where(n => n.RefType == nameof(Survey)).ToListAsync();

        Assert.Equal(new[] { 5500001, 5500002, 5500003 }, surveys.Select(s => s.Id));
        Assert.Equal(3, surveys.Select(s => s.Status).Distinct().Count());
        Assert.Equal(3, surveys.Select(s => s.Purpose).Distinct().Count());
        Assert.Equal(12, questions.Count);
        Assert.Equal(18, options.Count);
        Assert.Equal(70, recipients.Count);
        Assert.Equal(40, responses.Count);
        Assert.Equal(200, answers.Count);
        Assert.Equal(40, responses.Select(r => (r.SurveyId, r.CustomerId)).Distinct().Count());
        Assert.Equal(70, recipients.Select(r => (r.SurveyId, r.CustomerId)).Distinct().Count());

        foreach (var survey in surveys)
        {
            Assert.Equal(AccountRole.Manager, accounts[survey.CreatedBy].Role);
            Assert.False(string.IsNullOrWhiteSpace(survey.Title));
            Assert.InRange(survey.CreatedAt, ReferenceUtc.AddYears(-1), ReferenceUtc);
            var surveyQuestions = questions.Where(q => q.SurveyId == survey.Id).OrderBy(q => q.SortOrder).ToList();
            Assert.Equal(4, surveyQuestions.Count);
            Assert.Equal(4, surveyQuestions.Select(q => q.Type).Distinct().Count());
            Assert.Equal(4, surveyQuestions.Select(q => q.SortOrder).Distinct().Count());
            Assert.Contains(surveyQuestions, q => q.IsRequired);
            foreach (var question in surveyQuestions)
            {
                var choices = options.Where(o => o.QuestionId == question.Id).ToList();
                if (question.Type is QuestionType.SingleChoice or QuestionType.MultiChoice)
                {
                    Assert.True(choices.Count >= 2);
                    Assert.Equal(choices.Count, choices.Select(o => o.SortOrder).Distinct().Count());
                }
                else Assert.Empty(choices);
            }
            if (survey.Purpose == SurveyPurpose.NewProduct)
            {
                Assert.NotNull(survey.ProductId);
                Assert.Equal(ProductStatus.Upcoming, (await db.Set<Product>().SingleAsync(p => p.Id == survey.ProductId)).Status);
            }
            if (survey.Status == SurveyStatus.Draft)
            {
                Assert.DoesNotContain(recipients, r => r.SurveyId == survey.Id);
                Assert.DoesNotContain(responses, r => r.SurveyId == survey.Id);
            }
            else
            {
                Assert.NotNull(survey.OpenAt);
                Assert.NotNull(survey.CloseAt);
                Assert.True(survey.OpenAt < survey.CloseAt);
                Assert.Equal(20, responses.Count(r => r.SurveyId == survey.Id));
                if (survey.Status == SurveyStatus.Open)
                    Assert.True(survey.OpenAt <= ReferenceUtc && ReferenceUtc < survey.CloseAt);
                else Assert.True(survey.CloseAt <= ReferenceUtc);
            }
        }

        foreach (var recipient in recipients)
        {
            Assert.True(accounts[recipient.CustomerId].IsActive);
            Assert.Equal(AccountRole.Customer, accounts[recipient.CustomerId].Role);
            var response = responses.SingleOrDefault(r => r.SurveyId == recipient.SurveyId && r.CustomerId == recipient.CustomerId);
            Assert.Equal(response is not null ? RecipientStatus.Done : RecipientStatus.NotDone, recipient.Status);
            Assert.Equal(response?.SubmittedAt, recipient.CompletedAt);
            var notification = Assert.Single(notifications, n => n.AccountId == recipient.CustomerId && n.RefId == recipient.SurveyId);
            Assert.Equal(response is not null, notification.IsRead);
            Assert.Equal(recipient.SentAt, notification.CreatedAt);
        }
        Assert.Equal(70, notifications.Count);
        var customer01 = accounts.Values.Single(a => a.Email == "customer01@cocoon.demo");
        var openSurvey = surveys.Single(s => s.Status == SurveyStatus.Open);
        Assert.Equal(RecipientStatus.NotDone, recipients.Single(r => r.SurveyId == openSurvey.Id && r.CustomerId == customer01.Id).Status);

        foreach (var response in responses)
        {
            var survey = surveys.Single(s => s.Id == response.SurveyId);
            var recipient = recipients.Single(r => r.SurveyId == response.SurveyId && r.CustomerId == response.CustomerId);
            Assert.InRange(response.SubmittedAt, recipient.SentAt, ReferenceUtc);
            Assert.True(response.SubmittedAt >= survey.OpenAt && response.SubmittedAt < survey.CloseAt);
            var responseAnswers = answers.Where(a => a.ResponseId == response.Id).ToList();
            Assert.Equal(5, responseAnswers.Count);
            foreach (var question in questions.Where(q => q.SurveyId == survey.Id))
            {
                var values = responseAnswers.Where(a => a.QuestionId == question.Id).ToList();
                Assert.Equal(question.Type == QuestionType.MultiChoice ? 2 : 1, values.Count);
                foreach (var answer in values)
                {
                    if (question.Type is QuestionType.SingleChoice or QuestionType.MultiChoice)
                    {
                        Assert.NotNull(answer.OptionId);
                        Assert.Contains(options, o => o.Id == answer.OptionId && o.QuestionId == question.Id);
                        Assert.Null(answer.NumericValue);
                        Assert.Null(answer.TextValue);
                    }
                    else if (question.Type == QuestionType.Rating)
                    {
                        Assert.Null(answer.OptionId);
                        Assert.NotNull(answer.NumericValue);
                        Assert.InRange(answer.NumericValue.Value, 1m, 5m);
                        Assert.Equal(decimal.Truncate(answer.NumericValue.Value), answer.NumericValue.Value);
                        Assert.Null(answer.TextValue);
                    }
                    else
                    {
                        Assert.Null(answer.OptionId);
                        Assert.Null(answer.NumericValue);
                        Assert.NotNull(answer.TextValue);
                        Assert.False(string.IsNullOrWhiteSpace(answer.TextValue));
                        Assert.InRange(answer.TextValue.Length, 1, 1000);
                    }
                }
                Assert.Equal(values.Count, values.Select(a => a.OptionId).Distinct().Count());
            }
        }

        Assert.Contains(responses, r => !customers[r.CustomerId].ConsentPersonalData);
        Assert.Contains(preferences, p => p.Source == PreferenceSource.Survey);
        foreach (var preference in preferences.Where(p => p.Source == PreferenceSource.Survey))
        {
            Assert.True(customers[preference.CustomerId].ConsentPersonalData);
            Assert.Contains(answers, a => responses.Any(r => r.Id == a.ResponseId && r.CustomerId == preference.CustomerId)
                && options.Any(o => o.Id == a.OptionId && o.PreferenceId == preference.PreferenceId));
        }

        var plans = await db.Set<RecommendationPlan>().OrderBy(p => p.Id).ToListAsync();
        var planProducts = await db.Set<RecommendationPlanProduct>().ToListAsync();
        Assert.Equal(new[] { 5500011, 5500012, 5500013 }, plans.Select(p => p.Id));
        Assert.Equal(3, plans.Select(p => p.Status).Distinct().Count());
        foreach (var plan in plans)
        {
            Assert.Equal(AccountRole.Manager, accounts[plan.CreatedBy].Role);
            Assert.True(plan.StartAt < plan.EndAt);
            if (plan.Status == RecommendationPlanStatus.Active)
                Assert.True(plan.StartAt <= ReferenceUtc && ReferenceUtc < plan.EndAt);
            if (plan.Status == RecommendationPlanStatus.Ended) Assert.True(plan.EndAt <= ReferenceUtc);
            var segment = JsonSerializer.Deserialize<SegmentFilter>(plan.Segment, Json);
            Assert.NotNull(segment);
            Assert.Null(SegmentMatcher.Validate(segment));
            Assert.NotEmpty(await new CustomerFactsService(db).MatchAsync(segment, CancellationToken.None));
            var products = planProducts.Where(p => p.PlanId == plan.Id).ToList();
            Assert.NotEmpty(products);
            Assert.Equal(products.Count, products.Select(p => p.ProductId).Distinct().Count());
            Assert.Equal(products.Count, products.Select(p => p.SortOrder).Distinct().Count());
            foreach (var product in products)
                Assert.Equal(ProductStatus.Active, (await db.Set<Product>().SingleAsync(p => p.Id == product.ProductId)).Status);
        }
        Assert.Equal(0, await db.Set<Recommendation>().CountAsync());
    }

    [Fact]
    public async Task Rerun_preserves_user_changes_removed_links_and_new_submissions_even_at_a_later_date()
    {
        await using var db = database.CreateContext();
        await using var transaction = await db.Database.BeginTransactionAsync();
        await new DemoDataSeeder(db, _ => "test-hash", ReferenceUtc).RunAsync();
        var declaredBefore = await db.Set<CustomerPreference>().Where(p => p.Source == PreferenceSource.Declared)
            .Select(p => new { p.CustomerId, p.PreferenceId, p.CreatedAt }).ToListAsync();
        await new DemoDataSeeder(db, _ => "test-hash", ReferenceUtc).RunAsync(includeSurveysAndPlans: true);
        db.ChangeTracker.Clear();
        var seededPreferences = await db.Set<CustomerPreference>().ToListAsync();
        Assert.NotEmpty(declaredBefore);
        foreach (var declared in declaredBefore)
        {
            var saved = Assert.Single(seededPreferences, p => p.CustomerId == declared.CustomerId && p.PreferenceId == declared.PreferenceId);
            Assert.Equal(PreferenceSource.Declared, saved.Source);
            Assert.Equal(declared.CreatedAt, saved.CreatedAt);
        }

        var draft = await db.Set<Survey>().SingleAsync(s => s.Status == SurveyStatus.Draft);
        draft.Title = "Tiêu đề khảo sát do nhóm tự chỉnh sửa";
        draft.Description = "Nội dung do người dùng bổ sung sau khi seed.";
        draft.IsDeleted = true;
        var draftQuestion = await db.Set<SurveyQuestion>().SingleAsync(q => q.SurveyId == draft.Id && q.Type == QuestionType.ShortText);
        db.Remove(draftQuestion);
        var draftOption = await db.Set<QuestionOption>().FirstAsync(o => db.Set<SurveyQuestion>()
            .Any(q => q.Id == o.QuestionId && q.SurveyId == draft.Id));
        db.Remove(draftOption);
        var plan = await db.Set<RecommendationPlan>().SingleAsync(p => p.Status == RecommendationPlanStatus.Draft);
        plan.Name = "Tên kế hoạch được đổi sau demo";
        plan.Goal = "Mục tiêu mới do nhóm xác định.";
        db.Remove(await db.Set<RecommendationPlanProduct>().FirstAsync(p => p.PlanId == plan.Id));
        db.Remove(await db.Set<CustomerPreference>().FirstAsync(p => p.Source == PreferenceSource.Survey));

        var customer02 = await db.Set<Account>().SingleAsync(a => a.Email == "customer02@cocoon.demo");
        (await db.Set<CustomerProfile>().SingleAsync(c => c.AccountId == customer02.Id)).ConsentPersonalData = false;
        (await db.Set<Account>().SingleAsync(a => a.Email == "customer03@cocoon.demo")).IsActive = false;
        (await db.Set<Account>().SingleAsync(a => a.Email == "manager@cocoon.demo")).IsActive = false;
        var open = await db.Set<Survey>().SingleAsync(s => s.Status == SurveyStatus.Open);
        var customer01 = await db.Set<Account>().SingleAsync(a => a.Email == "customer01@cocoon.demo");
        var recipient = await db.Set<SurveyRecipient>().SingleAsync(r => r.CustomerId == customer01.Id && r.SurveyId == open.Id);
        var completedAt = ReferenceUtc.AddHours(-1);
        recipient.Status = RecipientStatus.Done;
        recipient.CompletedAt = completedAt;
        var response = new SurveyResponse { SurveyId = open.Id, CustomerId = customer01.Id, SubmittedAt = completedAt };
        db.Add(response);
        await db.SaveChangesAsync();
        foreach (var question in await db.Set<SurveyQuestion>().Where(q => q.SurveyId == open.Id).ToListAsync())
        {
            if (question.Type is QuestionType.SingleChoice or QuestionType.MultiChoice)
            {
                var optionIds = await db.Set<QuestionOption>().Where(o => o.QuestionId == question.Id).OrderBy(o => o.SortOrder)
                    .Select(o => o.Id).Take(question.Type == QuestionType.MultiChoice ? 2 : 1).ToListAsync();
                db.AddRange(optionIds.Select(optionId => new SurveyAnswer { ResponseId = response.Id, QuestionId = question.Id, OptionId = optionId }));
            }
            else db.Add(new SurveyAnswer { ResponseId = response.Id, QuestionId = question.Id,
                NumericValue = question.Type == QuestionType.Rating ? 5m : null,
                TextValue = question.Type == QuestionType.ShortText ? "Câu trả lời do khách tự gửi trong buổi demo." : null });
        }
        (await db.Set<Notification>().SingleAsync(n => n.AccountId == customer01.Id && n.RefType == nameof(Survey) && n.RefId == open.Id)).IsRead = true;
        var removedRecipient = await db.Set<SurveyRecipient>().FirstAsync(r => r.SurveyId == open.Id && r.Status == RecipientStatus.NotDone);
        db.Remove(removedRecipient);
        db.Add(new Survey { Title = "Khảo sát ngoài bộ seed", Description = "Không được thay đổi", CreatedBy = draft.CreatedBy });
        db.Add(new RecommendationPlan { Name = "Kế hoạch ngoài bộ seed", Goal = "Giữ dữ liệu ngoài seed", CreatedBy = draft.CreatedBy,
            StartAt = ReferenceUtc, EndAt = ReferenceUtc.AddDays(1), Segment = "{}" });
        db.Add(new Preference { Name = "Sở thích do nhóm tự thêm" });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        var before = await Snapshot(db);

        var added = await new DemoDataSeeder(db, _ => throw new InvalidOperationException("Không được hash lại tài khoản cũ."),
            ReferenceUtc.AddMonths(2)).RunAsync(includeSurveysAndPlans: true);

        Assert.Equal(0, added);
        db.ChangeTracker.Clear();
        Assert.Equal(before, await Snapshot(db));
    }

    [Fact]
    public async Task Partial_reserved_identity_collision_rolls_back_v2_and_preserves_preexisting_rows()
    {
        var isolated = new DemoSeedDatabaseFixture();
        await isolated.InitializeAsync();
        try
        {
            await using (var setup = isolated.CreateContext())
            {
                await new DemoDataSeeder(setup, _ => "test-hash", ReferenceUtc).RunAsync();
                var manager = await setup.Set<Account>().SingleAsync(a => a.Email == "manager@cocoon.demo");
                setup.Add(new Survey { Id = 5500001, Title = "Khảo sát có sẵn chiếm ID reserved", CreatedBy = manager.Id });
                await setup.SaveChangesAsync();
            }
            await using (var db = isolated.CreateContext())
                await Assert.ThrowsAsync<InvalidOperationException>(() =>
                    new DemoDataSeeder(db, _ => "test-hash", ReferenceUtc).RunAsync(includeSurveysAndPlans: true));

            await using var verify = isolated.CreateContext();
            Assert.Equal(87, await verify.Set<Account>().IgnoreQueryFilters().CountAsync());
            Assert.Equal(320, await verify.Set<Order>().CountAsync());
            Assert.Equal("Khảo sát có sẵn chiếm ID reserved", (await verify.Set<Survey>().SingleAsync()).Title);
            Assert.Equal(0, await verify.Set<Feedback>().CountAsync());
            Assert.Equal(0, await verify.Set<FeedbackAssignment>().CountAsync());
            Assert.Equal(0, await verify.Set<FeedbackReply>().CountAsync());
            Assert.Equal(0, await verify.Set<SurveyQuestion>().CountAsync());
            Assert.Equal(0, await verify.Set<QuestionOption>().CountAsync());
            Assert.Equal(0, await verify.Set<SurveyRecipient>().CountAsync());
            Assert.Equal(0, await verify.Set<SurveyResponse>().CountAsync());
            Assert.Equal(0, await verify.Set<SurveyAnswer>().CountAsync());
            Assert.Equal(0, await verify.Set<RecommendationPlan>().CountAsync());
            Assert.Equal(0, await verify.Set<Notification>().CountAsync());
            Assert.Equal(0, await verify.Set<CustomerPreference>().CountAsync(p => p.Source == PreferenceSource.Survey));
        }
        finally { await isolated.DisposeAsync(); }
    }

    private static async Task<string> Snapshot(AppDbContext db) => JsonSerializer.Serialize(new
    {
        Surveys = await db.Set<Survey>().IgnoreQueryFilters().OrderBy(s => s.Id).ToListAsync(),
        Questions = await db.Set<SurveyQuestion>().OrderBy(q => q.Id).ToListAsync(),
        Options = await db.Set<QuestionOption>().OrderBy(o => o.Id).ToListAsync(),
        Recipients = await db.Set<SurveyRecipient>().OrderBy(r => r.Id).ToListAsync(),
        Responses = await db.Set<SurveyResponse>().OrderBy(r => r.Id).ToListAsync(),
        Answers = await db.Set<SurveyAnswer>().OrderBy(a => a.Id).ToListAsync(),
        Plans = await db.Set<RecommendationPlan>().OrderBy(p => p.Id).ToListAsync(),
        PlanProducts = await db.Set<RecommendationPlanProduct>().OrderBy(p => p.PlanId).ThenBy(p => p.ProductId).ToListAsync(),
        Notifications = await db.Set<Notification>().OrderBy(n => n.Id).ToListAsync(),
        Preferences = await db.Set<Preference>().OrderBy(p => p.Id).ToListAsync(),
        CustomerPreferences = await db.Set<CustomerPreference>().OrderBy(p => p.CustomerId).ThenBy(p => p.PreferenceId).ToListAsync(),
        Accounts = await db.Set<Account>().IgnoreQueryFilters().OrderBy(a => a.Id).Select(a => new { a.Id, a.IsActive, a.IsDeleted, a.Role }).ToListAsync(),
        Consent = await db.Set<CustomerProfile>().IgnoreQueryFilters().OrderBy(c => c.AccountId)
            .Select(c => new { c.AccountId, c.ConsentPersonalData }).ToListAsync()
    });
}
