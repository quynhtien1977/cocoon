using System.Net;
using System.Data.Common;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Cocoon.Api.Auth;
using Cocoon.Api.Controllers;
using Cocoon.Domain.Entities;
using Cocoon.Domain.Enums;
using Cocoon.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;

namespace Cocoon.Tests;

/// <summary>COC-33: real HTTP/auth/database checks; unique rows stay inside the local cocoon_tests database.</summary>
public sealed class CustomerSurveysApiTests : IClassFixture<DatabaseFixture>, IDisposable
{
    private readonly DatabaseFixture _database;
    private readonly WebApplicationFactory<Program> _factory;

    public CustomerSurveysApiTests(DatabaseFixture database)
    {
        _database = database;
        _factory = new FoundationFactory().WithWebHostBuilder(builder => builder
            .UseSetting("ConnectionStrings:Default", database.ConnectionString)
            .ConfigureServices(services => services.AddScoped<IAccountGate, DbAccountGate>()));
    }

    public void Dispose() => _factory.Dispose();

    [Fact]
    public async Task Inbox_and_detail_are_recipient_scoped_and_submission_records_each_type_and_preferences()
    {
        var seed = await Seed();
        var list = await Json(await Send(HttpMethod.Get, "/api/v1/me/surveys?page=1&pageSize=1", seed.Customer));
        Assert.Equal((1, 1, 1), (list.GetProperty("totalCount").GetInt32(), list.GetProperty("page").GetInt32(), list.GetProperty("pageSize").GetInt32()));
        var item = list.GetProperty("items")[0];
        Assert.Equal(seed.Survey, item.GetProperty("id").GetInt32());
        Assert.Equal(4, item.GetProperty("questionCount").GetInt32());
        Assert.Equal(JsonValueKind.Null, item.GetProperty("completedAt").ValueKind);

        var detail = await Json(await Send(HttpMethod.Get, $"/api/v1/me/surveys/{seed.Survey}", seed.Customer));
        Assert.Equal("Open", detail.GetProperty("status").GetString());
        Assert.Equal(new[] { "SingleChoice", "MultiChoice", "Rating", "ShortText" },
            detail.GetProperty("questions").EnumerateArray().Select(q => q.GetProperty("type").GetString()).ToArray());
        Assert.DoesNotContain("preferenceId", detail.ToString()); // Tags are an internal mapping, never customer input.

        var submitted = await Send(HttpMethod.Post, $"/api/v1/me/surveys/{seed.Survey}/responses", seed.Customer, Valid(seed));
        Assert.Equal(HttpStatusCode.Created, submitted.StatusCode);
        var result = await Json(submitted);
        Assert.True(result.GetProperty("id").GetInt32() > 0);
        Assert.NotNull(result.GetProperty("submittedAt").GetString());
        await using var db = _database.CreateContext();
        var response = await db.Set<SurveyResponse>().SingleAsync(r => r.SurveyId == seed.Survey);
        Assert.Equal(seed.Customer, response.CustomerId);
        var answers = await db.Set<SurveyAnswer>().Where(a => a.ResponseId == response.Id).ToListAsync();
        Assert.Equal(5, answers.Count); // MultiChoice is one row per selected option.
        Assert.Equal(4m, Assert.Single(answers, a => a.QuestionId == seed.Rating).NumericValue);
        Assert.Equal("Dịu nhẹ", Assert.Single(answers, a => a.QuestionId == seed.Text).TextValue);
        var recipient = await db.Set<SurveyRecipient>().SingleAsync(r => r.SurveyId == seed.Survey && r.CustomerId == seed.Customer);
        Assert.Equal(RecipientStatus.Done, recipient.Status);
        Assert.Equal(response.SubmittedAt, recipient.CompletedAt);
        var preferences = await db.Set<CustomerPreference>().Where(p => p.CustomerId == seed.Customer).ToListAsync();
        Assert.Equal(2, preferences.Count);
        Assert.Equal(PreferenceSource.Declared, Assert.Single(preferences, p => p.PreferenceId == seed.ExistingPreference).Source);
        Assert.Equal(PreferenceSource.Survey, Assert.Single(preferences, p => p.PreferenceId == seed.NewPreference).Source);
        Assert.True((await db.Set<CustomerProfile>().SingleAsync(p => p.AccountId == seed.Customer)).ConsentPersonalData);

        var completed = await Json(await Send(HttpMethod.Get, $"/api/v1/me/surveys/{seed.Survey}", seed.Customer));
        Assert.NotNull(completed.GetProperty("completedAt").GetString());
        Assert.Equal(4, completed.GetProperty("answers").GetArrayLength());
        Assert.Equal(2, completed.GetProperty("answers").EnumerateArray().Single(a => a.GetProperty("questionId").GetInt32() == seed.Multi)
            .GetProperty("optionIds").GetArrayLength());
        Assert.Equal(HttpStatusCode.Conflict, (await Send(HttpMethod.Post, $"/api/v1/me/surveys/{seed.Survey}/responses", seed.Customer, Valid(seed))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Send(HttpMethod.Get, "/api/v1/me/surveys?status=invalid", seed.Customer)).StatusCode);
        var overflow = await Json(await Send(HttpMethod.Get, "/api/v1/me/surveys?page=2147483647&pageSize=100", seed.Customer));
        Assert.Empty(overflow.GetProperty("items").EnumerateArray());
    }

    [Fact]
    public async Task Submission_without_consent_keeps_answers_but_never_adds_or_overwrites_preferences()
    {
        var seed = await Seed(consent: false);
        Assert.Equal(HttpStatusCode.Created, (await Send(HttpMethod.Post, $"/api/v1/me/surveys/{seed.Survey}/responses", seed.Customer, Valid(seed))).StatusCode);
        await using var db = _database.CreateContext();
        var preference = Assert.Single(await db.Set<CustomerPreference>().Where(p => p.CustomerId == seed.Customer).ToListAsync());
        Assert.Equal((seed.ExistingPreference, PreferenceSource.Declared), (preference.PreferenceId, preference.Source));
        Assert.False((await db.Set<CustomerProfile>().SingleAsync(p => p.AccountId == seed.Customer)).ConsentPersonalData);
        Assert.Equal(5, await db.Set<SurveyAnswer>().Join(db.Set<SurveyResponse>().Where(r => r.SurveyId == seed.Survey), a => a.ResponseId, r => r.Id, (a, r) => a).CountAsync());
    }

    [Theory]
    [InlineData("Draft")]
    [InlineData("Closed")]
    [InlineData("Future")]
    [InlineData("Expired")]
    [InlineData("Deleted")]
    public async Task Unavailable_surveys_reject_detail_and_submission_without_partial_writes(string state)
    {
        var seed = await Seed();
        await using (var db = _database.CreateContext())
        {
            var survey = await db.Set<Survey>().SingleAsync(s => s.Id == seed.Survey);
            if (state == "Draft") survey.Status = SurveyStatus.Draft;
            if (state == "Closed") survey.Status = SurveyStatus.Closed;
            if (state == "Future") { survey.OpenAt = DateTime.UtcNow.AddDays(1); survey.CloseAt = DateTime.UtcNow.AddDays(2); }
            if (state == "Expired") { survey.OpenAt = DateTime.UtcNow.AddDays(-2); survey.CloseAt = DateTime.UtcNow.AddDays(-1); }
            if (state == "Deleted") survey.IsDeleted = true;
            await db.SaveChangesAsync();
        }
        var expected = state == "Deleted" ? HttpStatusCode.NotFound : HttpStatusCode.Conflict;
        Assert.Equal(expected, (await Send(HttpMethod.Get, $"/api/v1/me/surveys/{seed.Survey}", seed.Customer)).StatusCode);
        Assert.Equal(expected, (await Send(HttpMethod.Post, $"/api/v1/me/surveys/{seed.Survey}/responses", seed.Customer, Valid(seed))).StatusCode);
        await AssertUntouched(seed);
    }

    [Fact]
    public async Task Wrong_recipient_and_role_cannot_read_or_submit_and_client_cannot_choose_customer_id()
    {
        var seed = await Seed();
        foreach (var method in new[] { HttpMethod.Get, HttpMethod.Post })
        {
            var path = $"/api/v1/me/surveys/{seed.Survey}" + (method == HttpMethod.Post ? "/responses" : "");
            Assert.Equal(HttpStatusCode.Forbidden, (await Send(method, path, seed.OtherCustomer, Valid(seed))).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await Send(method, path, seed.Manager, Valid(seed), "Manager")).StatusCode);
            Assert.Equal(HttpStatusCode.Unauthorized, (await Send(method, path, null, Valid(seed))).StatusCode);
        }
        var others = await Json(await Send(HttpMethod.Get, "/api/v1/me/surveys", seed.OtherCustomer));
        Assert.Empty(others.GetProperty("items").EnumerateArray());
        // Extra customerId is ignored: ownership comes only from the signed token.
        var request = new { customerId = seed.OtherCustomer, answers = Valid(seed).answers };
        Assert.Equal(HttpStatusCode.Created, (await Send(HttpMethod.Post, $"/api/v1/me/surveys/{seed.Survey}/responses", seed.Customer, request)).StatusCode);
        await using var db = _database.CreateContext();
        Assert.Equal(seed.Customer, (await db.Set<SurveyResponse>().SingleAsync(r => r.SurveyId == seed.Survey)).CustomerId);
    }

    [Theory]
    [InlineData("missingRequired")]
    [InlineData("duplicateQuestion")]
    [InlineData("foreignQuestion")]
    [InlineData("foreignOption")]
    [InlineData("duplicateOption")]
    [InlineData("multipleSingle")]
    [InlineData("ratingLow")]
    [InlineData("ratingHigh")]
    [InlineData("ratingFraction")]
    [InlineData("ratingWithText")]
    [InlineData("choiceWithNumber")]
    [InlineData("textWithOption")]
    [InlineData("longText")]
    [InlineData("emptyRequiredText")]
    [InlineData("nullAnswer")]
    [InlineData("nullAnswers")]
    public async Task Invalid_answers_return_field_errors_and_do_not_write_any_part(string error)
    {
        var seed = await Seed();
        var answers = Valid(seed).answers.ToList();
        switch (error)
        {
            case "missingRequired": answers.RemoveAt(0); break;
            case "duplicateQuestion": answers.Add(answers[0]); break;
            case "foreignQuestion": answers.Add(new(int.MaxValue, null, null, "X")); break;
            case "foreignOption": answers[0] = answers[0] with { OptionIds = [seed.MultiOptions[0]] }; break;
            case "duplicateOption": answers[1] = answers[1] with { OptionIds = [seed.MultiOptions[0], seed.MultiOptions[0]] }; break;
            case "multipleSingle": answers[0] = answers[0] with { OptionIds = seed.SingleOptions }; break;
            case "ratingLow": answers[2] = answers[2] with { NumericValue = 0 }; break;
            case "ratingHigh": answers[2] = answers[2] with { NumericValue = 6 }; break;
            case "ratingFraction": answers[2] = answers[2] with { NumericValue = 2.5m }; break;
            case "ratingWithText": answers[2] = answers[2] with { TextValue = "X" }; break;
            case "choiceWithNumber": answers[0] = answers[0] with { NumericValue = 3 }; break;
            case "textWithOption": answers[3] = answers[3] with { OptionIds = [seed.SingleOptions[0]] }; break;
            case "longText": answers[3] = answers[3] with { TextValue = new string('a', 1001) }; break;
            case "emptyRequiredText":
                await using (var db = _database.CreateContext())
                { (await db.Set<SurveyQuestion>().SingleAsync(q => q.Id == seed.Text)).IsRequired = true; await db.SaveChangesAsync(); }
                answers[3] = answers[3] with { TextValue = "   " }; break;
            case "nullAnswer": answers[0] = null!; break;
        }
        var response = await Send(HttpMethod.Post, $"/api/v1/me/surveys/{seed.Survey}/responses", seed.Customer,
            new { answers = error == "nullAnswers" ? null : answers });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("VALIDATION_ERROR", problem.GetProperty("code").GetString());
        Assert.NotEmpty(problem.GetProperty("errors").EnumerateObject());
        await AssertUntouched(seed);
    }

    [Fact]
    public async Task Optional_questions_can_be_omitted_and_duplicate_concurrent_submissions_only_commit_once()
    {
        var seed = await Seed();
        var body = new { answers = Valid(seed).answers.Take(3).ToArray() };
        var path = $"/api/v1/me/surveys/{seed.Survey}/responses";
        var results = await Task.WhenAll(Send(HttpMethod.Post, path, seed.Customer, body), Send(HttpMethod.Post, path, seed.Customer, body));
        Assert.Equal(1, results.Count(r => r.StatusCode == HttpStatusCode.Created));
        Assert.Equal(1, results.Count(r => r.StatusCode == HttpStatusCode.Conflict));
        await using var db = _database.CreateContext();
        var response = Assert.Single(await db.Set<SurveyResponse>().Where(r => r.SurveyId == seed.Survey).ToListAsync());
        Assert.Equal(4, await db.Set<SurveyAnswer>().CountAsync(a => a.ResponseId == response.Id));
        Assert.Equal(2, await db.Set<CustomerPreference>().CountAsync(p => p.CustomerId == seed.Customer));
    }

    [Fact]
    public async Task Completed_closed_surveys_keep_only_the_recipients_answer_history()
    {
        var seed = await Seed();
        Assert.Equal(HttpStatusCode.Created, (await Send(HttpMethod.Post, $"/api/v1/me/surveys/{seed.Survey}/responses", seed.Customer, Valid(seed))).StatusCode);
        await using (var db = _database.CreateContext())
        {
            (await db.Set<Survey>().SingleAsync(s => s.Id == seed.Survey)).Status = SurveyStatus.Closed;
            await db.SaveChangesAsync();
        }
        var history = await Json(await Send(HttpMethod.Get, $"/api/v1/me/surveys/{seed.Survey}", seed.Customer));
        Assert.Equal("Closed", history.GetProperty("status").GetString());
        Assert.Equal(4, history.GetProperty("answers").GetArrayLength());
        Assert.Equal(HttpStatusCode.Forbidden, (await Send(HttpMethod.Get, $"/api/v1/me/surveys/{seed.Survey}", seed.OtherCustomer)).StatusCode);
        await using (var db = _database.CreateContext())
        {
            (await db.Set<Survey>().SingleAsync(s => s.Id == seed.Survey)).IsDeleted = true;
            await db.SaveChangesAsync();
        }
        var archived = await Json(await Send(HttpMethod.Get, $"/api/v1/me/surveys/{seed.Survey}", seed.Customer));
        Assert.Equal(4, archived.GetProperty("answers").GetArrayLength());
        var inbox = await Json(await Send(HttpMethod.Get, "/api/v1/me/surveys", seed.Customer));
        Assert.Contains(inbox.GetProperty("items").EnumerateArray(), s => s.GetProperty("id").GetInt32() == seed.Survey);
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Get, $"/api/v1/me/surveys/{seed.Survey}", seed.OtherCustomer)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Post, $"/api/v1/me/surveys/{seed.Survey}/responses", seed.Customer, Valid(seed))).StatusCode);
    }

    [Fact]
    public async Task Failure_while_writing_answers_rolls_back_response_recipient_and_preferences()
    {
        var seed = await Seed();
        using var failingFactory = _factory.WithWebHostBuilder(builder => builder.ConfigureServices(services =>
            services.AddDbContext<AppDbContext>(options => options.AddInterceptors(new FailAnswerWrite()))));
        using var client = failingFactory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/me/surveys/{seed.Survey}/responses")
        { Content = JsonContent.Create(Valid(seed)) };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", FoundationFactory.Token("Customer", seed.Customer));
        var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        await AssertUntouched(seed);
    }

    private sealed class FailAnswerWrite : DbCommandInterceptor
    {
        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand command, CommandEventData eventData,
            InterceptionResult<DbDataReader> result, CancellationToken cancellationToken = default)
        {
            if (command.CommandText.Contains("INSERT INTO \"SurveyAnswer\"", StringComparison.Ordinal))
                throw new InvalidOperationException("Lỗi ghi câu trả lời được tạo có chủ đích trong kiểm thử rollback.");
            return base.ReaderExecutingAsync(command, eventData, result, cancellationToken);
        }
    }

    private async Task AssertUntouched(SeedData seed)
    {
        await using var db = _database.CreateContext();
        Assert.False(await db.Set<SurveyResponse>().AnyAsync(r => r.SurveyId == seed.Survey));
        Assert.Equal(1, await db.Set<CustomerPreference>().CountAsync(p => p.CustomerId == seed.Customer));
        var recipient = await db.Set<SurveyRecipient>().SingleAsync(r => r.SurveyId == seed.Survey && r.CustomerId == seed.Customer);
        Assert.Equal(RecipientStatus.NotDone, recipient.Status);
        Assert.Null(recipient.CompletedAt);
    }

    private sealed record AnswersBody(SurveyAnswerInput[] answers);
    private static AnswersBody Valid(SeedData seed) => new([
        new(seed.Single, [seed.SingleOptions[0]], null, null),
        new(seed.Multi, seed.MultiOptions, null, null),
        new(seed.Rating, null, 4, null),
        new(seed.Text, null, null, "  Dịu nhẹ  ")]);

    private sealed record SeedData(int Manager, int Customer, int OtherCustomer, int Survey, int Single, int Multi, int Rating, int Text,
        int[] SingleOptions, int[] MultiOptions, int ExistingPreference, int NewPreference);

    private async Task<SeedData> Seed(bool consent = true)
    {
        await using var db = _database.CreateContext();
        Account Account(AccountRole role) => new() { Email = $"coc33-{Guid.NewGuid():N}@cocoon.demo", Role = role };
        var (manager, customer, other) = (Account(AccountRole.Manager), Account(AccountRole.Customer), Account(AccountRole.Customer));
        var existing = new Preference { Name = $"Sẵn có {Guid.NewGuid():N}" };
        var learned = new Preference { Name = $"Khảo sát {Guid.NewGuid():N}" };
        db.AddRange(new StaffProfile { Account = manager, FullName = "Quản lý khảo sát" },
            new CustomerProfile { Account = customer, FullName = "Khách được mời", ConsentPersonalData = consent },
            new CustomerProfile { Account = other, FullName = "Khách ngoài danh sách" }, existing, learned);
        await db.SaveChangesAsync();
        var survey = new Survey { CreatedBy = manager.Id, Title = $"Khảo sát COC-33 {Guid.NewGuid():N}", Description = "Chia sẻ trải nghiệm", Status = SurveyStatus.Open,
            OpenAt = DateTime.UtcNow.AddHours(-1), CloseAt = DateTime.UtcNow.AddDays(1) };
        db.Add(survey);
        await db.SaveChangesAsync();
        var questions = new[] { QuestionType.SingleChoice, QuestionType.MultiChoice, QuestionType.Rating, QuestionType.ShortText }
            .Select((type, i) => new SurveyQuestion { SurveyId = survey.Id, Text = $"Câu {i + 1}", Type = type, IsRequired = i < 3, SortOrder = i }).ToArray();
        db.AddRange(questions);
        db.Add(new SurveyRecipient { SurveyId = survey.Id, CustomerId = customer.Id });
        db.Add(new CustomerPreference { CustomerId = customer.Id, PreferenceId = existing.Id, Source = PreferenceSource.Declared });
        await db.SaveChangesAsync();
        var single = new[] { new QuestionOption { QuestionId = questions[0].Id, Text = "Có", PreferenceId = existing.Id, SortOrder = 0 },
            new QuestionOption { QuestionId = questions[0].Id, Text = "Không", SortOrder = 1 } };
        var multi = new[] { new QuestionOption { QuestionId = questions[1].Id, Text = "Da dầu", PreferenceId = learned.Id, SortOrder = 0 },
            new QuestionOption { QuestionId = questions[1].Id, Text = "Mụn", PreferenceId = learned.Id, SortOrder = 1 } };
        db.AddRange(single);
        db.AddRange(multi);
        await db.SaveChangesAsync();
        return new(manager.Id, customer.Id, other.Id, survey.Id, questions[0].Id, questions[1].Id, questions[2].Id, questions[3].Id,
            single.Select(o => o.Id).ToArray(), multi.Select(o => o.Id).ToArray(), existing.Id, learned.Id);
    }

    private async Task<HttpResponseMessage> Send(HttpMethod method, string path, int? account, object? body = null, string role = "Customer")
    {
        using var client = _factory.CreateClient();
        using var request = new HttpRequestMessage(method, path);
        if (account is not null) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", FoundationFactory.Token(role, account.Value));
        if (body is not null) request.Content = JsonContent.Create(body, body.GetType());
        return await client.SendAsync(request);
    }

    private static async Task<JsonElement> Json(HttpResponseMessage response)
    {
        Assert.True(response.IsSuccessStatusCode, $"{(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }
}
