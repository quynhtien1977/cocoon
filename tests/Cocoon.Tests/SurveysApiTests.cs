using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Cocoon.Api.Auth;
using Cocoon.Domain.Entities;
using Cocoon.Domain.Enums;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Cocoon.Tests;

/// <summary>COC-32 against cocoon_tests. Segments use a preference created per test, so they reach only this test's customers.</summary>
public sealed class SurveysApiTests : IClassFixture<DatabaseFixture>, IDisposable
{
    private readonly DatabaseFixture _database;
    private readonly WebApplicationFactory<Program> _factory;

    public SurveysApiTests(DatabaseFixture database)
    {
        _database = database;
        _factory = new FoundationFactory().WithWebHostBuilder(builder => builder
            .UseSetting("ConnectionStrings:Default", database.ConnectionString)
            .ConfigureServices(services => services.AddScoped<IAccountGate, DbAccountGate>()));
    }

    public void Dispose() => _factory.Dispose();

    [Fact]
    public async Task Draft_is_editable_then_publish_send_answer_close_and_report()
    {
        var shop = await Seed();
        var manager = FoundationFactory.Token("Manager", shop.ManagerId);
        var draft = Body(shop.PreferenceId);

        Assert.Equal(HttpStatusCode.BadRequest, (await Send(HttpMethod.Post, "/api/v1/surveys", manager,
            draft with { questions = new object[] { new { text = "Chọn một", type = "SingleChoice", isRequired = true, options = new[] { new { text = "A", preferenceId = (int?)null } } } } })).StatusCode);
        var created = await Json(await Send(HttpMethod.Post, "/api/v1/surveys", manager, draft));
        var id = created.GetProperty("id").GetInt32();
        Assert.Equal("Draft", created.GetProperty("status").GetString());
        Assert.Equal(3, created.GetProperty("questions").GetArrayLength());
        Assert.Equal(shop.PreferenceId, created.GetProperty("questions")[0].GetProperty("options")[0].GetProperty("preferenceId").GetInt32());

        var updated = await Json(await Send(HttpMethod.Put, $"/api/v1/surveys/{id}", manager, draft with { title = "Thói quen chăm sóc da" }));
        Assert.Equal("Thói quen chăm sóc da", updated.GetProperty("title").GetString());
        Assert.Equal(HttpStatusCode.Conflict, (await Send(HttpMethod.Post, $"/api/v1/surveys/{id}/recipients", manager,
            new { customerIds = new[] { shop.CustomerId } })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Post, $"/api/v1/surveys/{id}/publish", manager)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Send(HttpMethod.Put, $"/api/v1/surveys/{id}", manager, draft)).StatusCode);

        var preview = await Json(await Send(HttpMethod.Post, "/api/v1/segments/preview", manager, new { preferenceIds = new[] { shop.PreferenceId } }));
        Assert.Equal(2, preview.GetProperty("count").GetInt32());
        var sent = await Json(await Send(HttpMethod.Post, $"/api/v1/surveys/{id}/recipients", manager,
            new { segment = new { preferenceIds = new[] { shop.PreferenceId } } }));
        Assert.Equal(2, sent.GetProperty("added").GetInt32());
        var again = await Json(await Send(HttpMethod.Post, $"/api/v1/surveys/{id}/recipients", manager, new { customerIds = new[] { shop.CustomerId } }));
        Assert.Equal((0, 2), (again.GetProperty("added").GetInt32(), again.GetProperty("total").GetInt32()));
        Assert.Equal(HttpStatusCode.BadRequest, (await Send(HttpMethod.Post, $"/api/v1/surveys/{id}/recipients", manager, new { })).StatusCode);

        await Answer(id, shop.CustomerId);
        var results = await Json(await Send(HttpMethod.Get, $"/api/v1/surveys/{id}/results", manager));
        Assert.Equal((2, 1, 0.5), (results.GetProperty("recipientCount").GetInt32(), results.GetProperty("responseCount").GetInt32(),
            results.GetProperty("completionRate").GetDouble()));
        var questions = results.GetProperty("questions");
        Assert.Equal([1, 0], questions[0].GetProperty("options").EnumerateArray().Select(o => o.GetProperty("count").GetInt32()));
        Assert.Equal(4, questions[1].GetProperty("average").GetDouble());
        Assert.Equal(1, questions[1].GetProperty("distribution").GetProperty("4").GetInt32());
        Assert.Equal("Dịu nhẹ", questions[2].GetProperty("answers")[0].GetProperty("content").GetString());

        Assert.Equal(HttpStatusCode.Conflict, (await Send(HttpMethod.Delete, $"/api/v1/surveys/{id}", manager)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Post, $"/api/v1/surveys/{id}/close", manager)).StatusCode);
        var list = await Json(await Send(HttpMethod.Get, "/api/v1/surveys?status=Closed&pageSize=100", manager));
        var row = list.GetProperty("items").EnumerateArray().Single(x => x.GetProperty("id").GetInt32() == id);
        Assert.Equal((3, 2, 1), (row.GetProperty("questionCount").GetInt32(), row.GetProperty("recipientCount").GetInt32(), row.GetProperty("responseCount").GetInt32()));
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Delete, $"/api/v1/surveys/{id}", manager)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Get, $"/api/v1/surveys/{id}", manager)).StatusCode);
        await using var db = _database.CreateContext();
        Assert.Equal(2, await db.Set<Notification>().CountAsync(n => n.RefType == nameof(Survey) && n.RefId == id));
    }

    private static SurveyBody Body(int preferenceId) => new("Khảo sát da", null, "Satisfaction", null, null, null, new object[]
    {
        new { text = "Loại da của bạn?", type = "SingleChoice", isRequired = true,
            options = new[] { new { text = "Da dầu", preferenceId = (int?)preferenceId }, new { text = "Da khô", preferenceId = (int?)null } } },
        new { text = "Chấm điểm sản phẩm", type = "Rating", isRequired = true, options = Array.Empty<object>() },
        new { text = "Góp ý thêm", type = "ShortText", isRequired = false, options = Array.Empty<object>() },
    });

    private sealed record SurveyBody(string title, string? description, string purpose, int? productId, DateTime? openAt, DateTime? closeAt, object[] questions);

    /// <summary>Customer answers are written directly: their API is COC-33.</summary>
    private async Task Answer(int surveyId, int customerId)
    {
        await using var db = _database.CreateContext();
        var questions = await db.Set<SurveyQuestion>().Where(q => q.SurveyId == surveyId).OrderBy(q => q.SortOrder).ToListAsync();
        var firstOption = await db.Set<QuestionOption>().Where(o => o.QuestionId == questions[0].Id).OrderBy(o => o.SortOrder).FirstAsync();
        var response = new SurveyResponse { SurveyId = surveyId, CustomerId = customerId };
        db.Add(response);
        await db.SaveChangesAsync();
        db.AddRange(new SurveyAnswer { ResponseId = response.Id, QuestionId = questions[0].Id, OptionId = firstOption.Id },
            new SurveyAnswer { ResponseId = response.Id, QuestionId = questions[1].Id, NumericValue = 4 },
            new SurveyAnswer { ResponseId = response.Id, QuestionId = questions[2].Id, TextValue = "Dịu nhẹ" });
        await db.SaveChangesAsync();
    }

    private sealed record Shop(int ManagerId, int CustomerId, int PreferenceId);

    private async Task<Shop> Seed()
    {
        var tag = Guid.NewGuid().ToString("N")[..10];
        await using var db = _database.CreateContext();
        Account Account(AccountRole role) => new() { Email = $"{role}-{Guid.NewGuid():N}@cocoon.demo", Role = role };
        var (manager, first, second) = (Account(AccountRole.Manager), Account(AccountRole.Customer), Account(AccountRole.Customer));
        var preference = new Preference { Name = $"Da dầu {tag}" };
        db.AddRange(new StaffProfile { Account = manager, FullName = "Quản lý" }, new CustomerProfile { Account = first, FullName = "Khách A" },
            new CustomerProfile { Account = second, FullName = "Khách B" }, preference);
        await db.SaveChangesAsync();
        db.AddRange(new CustomerPreference { CustomerId = first.Id, PreferenceId = preference.Id },
            new CustomerPreference { CustomerId = second.Id, PreferenceId = preference.Id });
        await db.SaveChangesAsync();
        return new Shop(manager.Id, first.Id, preference.Id);
    }

    private async Task<HttpResponseMessage> Send(HttpMethod method, string path, string token, object? body = null)
    {
        using var client = _factory.CreateClient();
        using var request = new HttpRequestMessage(method, path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        if (body is not null) request.Content = JsonContent.Create(body, body.GetType());
        return await client.SendAsync(request);
    }

    private static async Task<JsonElement> Json(HttpResponseMessage response)
    {
        Assert.True(response.IsSuccessStatusCode, $"{(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }
}
