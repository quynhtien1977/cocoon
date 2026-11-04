using System.Text.Json;
using Cocoon.Application.Recommendations;
using Cocoon.Domain.Entities;
using Cocoon.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Cocoon.Infrastructure.Seeding;

public sealed partial class DemoDataSeeder
{
    // Reserved local-demo identities survive edits to titles/descriptions, soft deletes and plan names.
    // Children still use database identities. Never reset sequences or rebuild an existing aggregate.
    private static readonly int[] SurveyDemoIds = [5500001, 5500002, 5500003];
    private static readonly int[] PlanDemoIds = [5500011, 5500012, 5500013];

    private async Task AddSurveysAndPlans(List<CustomerProfile> customers, List<Product> products,
        List<Preference> preferences, CancellationToken ct)
    {
        var existing = await db.Set<Survey>().IgnoreQueryFilters().CountAsync(s => SurveyDemoIds.Contains(s.Id), ct)
            + await db.Set<RecommendationPlan>().CountAsync(p => PlanDemoIds.Contains(p.Id), ct);
        if (existing == 6) return; // Keep user submissions, removed children, withdrawn consent and all later edits.
        if (existing != 0)
            throw new InvalidOperationException("ID dành riêng cho seed v3 đã tồn tại một phần. Không ghi đè hoặc khôi phục dữ liệu.");

        var manager = await db.Set<Account>().SingleOrDefaultAsync(a => a.Email == "manager@cocoon.demo"
            && a.Role == AccountRole.Manager && a.IsActive, ct)
            ?? throw new InvalidOperationException("Seed v3 cần Manager demo đang hoạt động.");
        var selectedCustomers = customers.Take(50).ToArray();
        var customerIds = selectedCustomers.Select(c => c.AccountId).ToArray();
        if (selectedCustomers.Length != 50 || await db.Set<Account>().CountAsync(a => customerIds.Contains(a.Id)
            && a.Role == AccountRole.Customer && a.IsActive, ct) != 50)
            throw new InvalidOperationException("Seed v3 cần 50 Customer demo đầu tiên đang hoạt động.");
        var upcoming = products[22];
        var planProducts = new[] { products[8], products[12], products[16] };
        if (upcoming.IsDeleted || upcoming.Status != ProductStatus.Upcoming
            || planProducts.Any(p => p.IsDeleted || p.Status != ProductStatus.Active))
            throw new InvalidOperationException("Sản phẩm demo không còn đủ điều kiện cho khảo sát hoặc kế hoạch gợi ý.");

        var surveys = new[]
        {
            new Survey { Id = SurveyDemoIds[0], Title = "Góp ý cho dịch vụ Cocoon", Purpose = SurveyPurpose.Other,
                Status = SurveyStatus.Draft, CreatedBy = manager.Id, CreatedAt = referenceUtc.AddDays(-2) },
            new Survey { Id = SurveyDemoIds[1], Title = "Trải nghiệm chăm sóc da cùng Cocoon", Purpose = SurveyPurpose.Satisfaction,
                Status = SurveyStatus.Open, OpenAt = referenceUtc.AddDays(-14), CloseAt = referenceUtc.AddDays(90),
                CreatedBy = manager.Id, CreatedAt = referenceUtc.AddDays(-15) },
            new Survey { Id = SurveyDemoIds[2], Title = "Mong đợi về son dưỡng sen mới", Purpose = SurveyPurpose.NewProduct,
                ProductId = upcoming.Id, Status = SurveyStatus.Closed, OpenAt = referenceUtc.AddDays(-60), CloseAt = referenceUtc.AddDays(-14),
                CreatedBy = manager.Id, CreatedAt = referenceUtc.AddDays(-61) }
        };
        foreach (var survey in surveys)
        {
            survey.Description = "Dữ liệu khảo sát mô phỏng phục vụ demo đồ án, không phải khảo sát thực tế của Cocoon.";
            Add(survey);
        }
        await db.SaveChangesAsync(ct);
        var existingPreferences = (await db.Set<CustomerPreference>().ToListAsync(ct))
            .Select(p => (p.CustomerId, p.PreferenceId)).ToHashSet();
        foreach (var survey in surveys.OrderBy(s => s.OpenAt ?? DateTime.MaxValue))
        {
            var questions = await AddDemoQuestions(survey, preferences, ct);
            if (survey.Status == SurveyStatus.Draft) continue;
            var invited = survey.Status == SurveyStatus.Open ? selectedCustomers.Take(40) : selectedCustomers.Skip(20);
            var sentAt = survey.Status == SurveyStatus.Open ? referenceUtc.AddDays(-10) : referenceUtc.AddDays(-45);
            var index = 0;
            foreach (var customer in invited)
            {
                var done = survey.Status == SurveyStatus.Open ? index is >= 1 and <= 20 : index < 20;
                var submittedAt = (survey.Status == SurveyStatus.Open ? referenceUtc.AddDays(-7) : referenceUtc.AddDays(-30)).AddHours(index);
                Add(new SurveyRecipient { SurveyId = survey.Id, CustomerId = customer.AccountId, SentAt = sentAt,
                    Status = done ? RecipientStatus.Done : RecipientStatus.NotDone, CompletedAt = done ? submittedAt : null });
                Add(new Notification { AccountId = customer.AccountId, Type = "survey", RefType = nameof(Survey), RefId = survey.Id,
                    Title = $"Khảo sát mới: {survey.Title}", IsRead = done, CreatedAt = sentAt });
                if (done) await AddDemoResponse(survey, questions, customer, index, submittedAt, existingPreferences, ct);
                index++;
            }
            await db.SaveChangesAsync(ct);
        }
        await AddDemoPlans(manager.Id, planProducts, preferences, ct);
    }

    private async Task<List<(SurveyQuestion Question, QuestionOption[] Options)>> AddDemoQuestions(
        Survey survey, List<Preference> preferences, CancellationToken ct)
    {
        string[] texts = ["Bạn quan tâm nhất đến nhu cầu nào?", "Bạn ưu tiên điều gì khi chọn mỹ phẩm?",
            survey.Purpose == SurveyPurpose.NewProduct ? "Mức độ quan tâm của bạn đến sản phẩm mới?" : "Bạn hài lòng với trải nghiệm Cocoon ở mức nào?",
            "Bạn muốn Cocoon cải thiện điều gì?"];
        var questions = Enum.GetValues<QuestionType>().Select((type, index) => Add(new SurveyQuestion
        {
            SurveyId = survey.Id, Type = type, Text = texts[index], IsRequired = type != QuestionType.ShortText, SortOrder = index
        })).ToArray();
        await db.SaveChangesAsync(ct);
        var rows = new List<(SurveyQuestion, QuestionOption[])>();
        foreach (var question in questions)
        {
            var tags = question.Type == QuestionType.SingleChoice ? preferences.Take(3).ToArray()
                : question.Type == QuestionType.MultiChoice ? new[] { preferences[7], preferences[6], preferences[10] } : [];
            var options = tags.Select((tag, index) => Add(new QuestionOption
            {
                QuestionId = question.Id, Text = tag.Name, PreferenceId = tag.Id, SortOrder = index
            })).ToArray();
            rows.Add((question, options));
        }
        await db.SaveChangesAsync(ct);
        return rows;
    }

    private async Task AddDemoResponse(Survey survey, List<(SurveyQuestion Question, QuestionOption[] Options)> questions,
        CustomerProfile customer, int index, DateTime submittedAt, HashSet<(int CustomerId, int PreferenceId)> existingPreferences,
        CancellationToken ct)
    {
        var response = Add(new SurveyResponse { SurveyId = survey.Id, CustomerId = customer.AccountId, SubmittedAt = submittedAt });
        await db.SaveChangesAsync(ct);
        foreach (var (question, options) in questions)
        {
            if (question.Type is QuestionType.SingleChoice or QuestionType.MultiChoice)
            {
                var selected = question.Type == QuestionType.SingleChoice ? new[] { options[index % options.Length] }
                    : new[] { options[index % options.Length], options[(index + 1) % options.Length] };
                foreach (var option in selected)
                {
                    Add(new SurveyAnswer { ResponseId = response.Id, QuestionId = question.Id, OptionId = option.Id });
                    if (customer.ConsentPersonalData && option.PreferenceId is { } preferenceId
                        && existingPreferences.Add((customer.AccountId, preferenceId)))
                        Add(new CustomerPreference { CustomerId = customer.AccountId, PreferenceId = preferenceId,
                            Source = PreferenceSource.Survey, CreatedAt = submittedAt });
                }
            }
            else Add(new SurveyAnswer { ResponseId = response.Id, QuestionId = question.Id,
                NumericValue = question.Type == QuestionType.Rating ? 1 + index % 5 : null,
                TextValue = question.Type == QuestionType.ShortText ? "Mong Cocoon tư vấn rõ hơn về sản phẩm phù hợp với nhu cầu của tôi." : null });
        }
    }

    private async Task AddDemoPlans(int managerId, Product[] products, List<Preference> preferences, CancellationToken ct)
    {
        var segments = new[]
        {
            new SegmentFilter(18, 44, [], [], [], null, []),
            new SegmentFilter(null, null, [], [], [], null, []),
            new SegmentFilter(null, null, [], [preferences[0].Id], [], null, [])
        };
        string[] names = ["Chăm sóc da mỗi ngày", "Khám phá mỹ phẩm thuần chay", "Chăm sóc theo nhu cầu da dầu"];
        for (var index = 0; index < 3; index++)
        {
            var plan = Add(new RecommendationPlan { Id = PlanDemoIds[index], Name = names[index],
                Goal = "Kế hoạch mô phỏng phục vụ demo, không phải chiến dịch thực tế của Cocoon.",
                Segment = JsonSerializer.Serialize(segments[index], new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                Status = (RecommendationPlanStatus)index, CreatedBy = managerId, CreatedAt = referenceUtc.AddDays(-61),
                StartAt = index == 0 ? referenceUtc.AddDays(1) : index == 1 ? referenceUtc.AddDays(-7) : referenceUtc.AddDays(-60),
                EndAt = index == 2 ? referenceUtc.AddDays(-14) : referenceUtc.AddDays(90) });
            await db.SaveChangesAsync(ct);
            for (var sort = 0; sort < products.Length; sort++)
                Add(new RecommendationPlanProduct { PlanId = plan.Id, ProductId = products[sort].Id, SortOrder = sort });
        }
        await db.SaveChangesAsync(ct);
    }
}
