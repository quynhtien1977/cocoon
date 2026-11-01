using System.Net;
using System.Net.Http.Json;
using Cocoon.Domain.Entities;
using Cocoon.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Cocoon.Tests;

public sealed class CustomersApiTests : AccountApiTestBase
{
    [Fact]
    public async Task Manager_creates_customer_updates_profile_and_searches_without_accents()
    {
        var manager = await Actor(AccountRole.Manager);
        int preference;
        await using (var db = Database.CreateContext())
        {
            var p = new Preference { Name = "Da dầu" }; db.Add(p); await db.SaveChangesAsync(); preference = p.Id;
        }
        var email = "new.customer@example.test";
        var birth = DateOnly.FromDateTime(DateTime.UtcNow).AddYears(-25);
        using var created = await Send(HttpMethod.Post, "/api/v1/customers", "Manager", manager, new {
            email = email.ToUpperInvariant(), fullName = "Nguyễn Ánh", phone = "0901234567", dateOfBirth = birth,
            gender = "Nữ", address = "Hồ Chí Minh", consentPersonalData = true, preferenceIds = new[] { preference }, role = "Admin" });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        Assert.Equal("no-store", created.Headers.CacheControl?.ToString());
        var body = await Json(created);
        var id = body.GetProperty("id").GetInt32();
        Assert.Equal("Customer", body.GetProperty("role").GetString());
        var temporary = body.GetProperty("temporaryPassword").GetString()!;
        using var login = await Send(HttpMethod.Post, "/api/v1/auth/login", body: new { email, password = temporary });
        Assert.True((await Json(login)).GetProperty("mustChangePassword").GetBoolean());
        await Problem(await Send(HttpMethod.Get, "/api/v1/me/orders", "Customer", id), HttpStatusCode.Forbidden, "PASSWORD_CHANGE_REQUIRED");
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Put, $"/api/v1/customers/{id}", "Manager", manager, new {
            fullName = "Đặng Thị Ánh", phone = "0911234567", dateOfBirth = birth.AddDays(1), gender = "Nữ", address = "Quận 5",
            consentPersonalData = true, role = "Admin", email = "overwrite@example.test" })).StatusCode);
        var detail = await Json(await Send(HttpMethod.Get, $"/api/v1/customers/{id}", "Manager", manager));
        Assert.Equal(email, detail.GetProperty("email").GetString());
        Assert.Equal("Đặng Thị Ánh", detail.GetProperty("fullName").GetString());
        Assert.Equal(24, detail.GetProperty("age").GetInt32());
        Assert.Equal(1, detail.GetProperty("preferences").GetArrayLength());
        var list = await Json(await Send(HttpMethod.Get, "/api/v1/customers?search=dang%20thi%20anh&pageSize=1&ageMin=24&ageMax=24", "Manager", manager));
        Assert.Equal(1, list.GetProperty("totalCount").GetInt32());
        Assert.Equal(id, list.GetProperty("items")[0].GetProperty("id").GetInt32());
        Assert.Equal(0, (await Json(await Send(HttpMethod.Get, "/api/v1/customers?page=2147483647&pageSize=100", "Manager", manager)))
            .GetProperty("items").GetArrayLength());
        await Problem(await Send(HttpMethod.Post, "/api/v1/customers", "Manager", manager,
            new { email, fullName = "Khách trùng" }), HttpStatusCode.Conflict, "EMAIL_TAKEN");
        await using var verify = Database.CreateContext();
        Assert.Equal(AccountRole.Customer, (await verify.Set<Account>().SingleAsync(a => a.Id == id)).Role);
    }

    [Theory]
    [InlineData("Admin")]
    [InlineData("Staff")]
    [InlineData("Customer")]
    public async Task Other_roles_cannot_read_or_change_customers(string role)
    {
        var actor = await Actor(Enum.Parse<AccountRole>(role));
        foreach (var (method, route, body) in Requests(actor))
            Assert.Equal(HttpStatusCode.Forbidden, (await Send(method, route, role, actor, body)).StatusCode);
    }

    [Fact]
    public async Task Manager_cannot_target_internal_accounts_or_change_roles()
    {
        var manager = await Actor(AccountRole.Manager);
        foreach (var (method, route, body) in Requests(manager).Where(r => r.Route != "/api/v1/customers"))
            await Problem(await Send(method, route, "Manager", manager, body), HttpStatusCode.Forbidden, "FORBIDDEN");
        foreach (var role in new[] { AccountRole.Admin, AccountRole.Manager, AccountRole.Staff })
        {
            var target = await Actor(role);
            foreach (var (method, route, body) in Requests(target).Where(r => r.Route != "/api/v1/customers"))
                await Problem(await Send(method, route, "Manager", manager, body), HttpStatusCode.Forbidden, "FORBIDDEN");
        }
        await Problem(await Send(HttpMethod.Get, "/api/v1/customers/2147483647", "Manager", manager), HttpStatusCode.NotFound, "NOT_FOUND");
    }

    [Fact]
    public async Task Concurrent_profile_updates_keep_one_preference_and_do_not_partially_save()
    {
        var manager = await Actor(AccountRole.Manager);
        var customer = await Actor(AccountRole.Customer);
        int preference;
        await using (var db = Database.CreateContext())
        {
            var p = new Preference { Name = "Sở thích đồng thời" }; db.Add(p); await db.SaveChangesAsync(); preference = p.Id;
        }
        var body = new { fullName = "Cập nhật đồng thời", consentPersonalData = true, preferenceIds = new[] { preference } };
        var results = await Task.WhenAll(
            Send(HttpMethod.Put, $"/api/v1/customers/{customer}", "Manager", manager, body),
            Send(HttpMethod.Put, $"/api/v1/customers/{customer}", "Manager", manager, body));
        Assert.Contains(results, r => r.StatusCode == HttpStatusCode.NoContent);
        foreach (var response in results)
        {
            Assert.Contains(response.StatusCode, new[] { HttpStatusCode.NoContent, HttpStatusCode.Conflict });
            if (response.StatusCode == HttpStatusCode.Conflict) await Problem(response, HttpStatusCode.Conflict, "ACCOUNT_CONFLICT");
        }
        await using var verify = Database.CreateContext();
        Assert.Equal(1, await verify.Set<CustomerPreference>().CountAsync(p => p.CustomerId == customer && p.PreferenceId == preference));
        Assert.Equal("Cập nhật đồng thời", (await verify.Set<CustomerProfile>().SingleAsync(c => c.AccountId == customer)).FullName);
    }

    [Fact]
    public async Task History_is_scoped_to_customer_and_soft_delete_preserves_order_feedback_and_survey()
    {
        var manager = await Actor(AccountRole.Manager);
        var customer = await Actor(AccountRole.Customer);
        var other = await Actor(AccountRole.Customer);
        var history = await AddHistory(customer, manager);
        await AddHistory(other, manager);
        var orders = await Json(await Send(HttpMethod.Get, $"/api/v1/customers/{customer}/orders?pageSize=1", "Manager", manager));
        Assert.Equal(1, orders.GetProperty("totalCount").GetInt32());
        Assert.Equal(history.OrderId, orders.GetProperty("items")[0].GetProperty("id").GetInt32());
        var feedback = await Json(await Send(HttpMethod.Get, $"/api/v1/customers/{customer}/feedback", "Manager", manager));
        Assert.Equal(1, feedback.GetProperty("totalCount").GetInt32());
        Assert.Equal("Sản phẩm lịch sử", feedback.GetProperty("items")[0].GetProperty("productName").GetString());
        var surveys = await Json(await Send(HttpMethod.Get, $"/api/v1/customers/{customer}/surveys", "Manager", manager));
        Assert.Equal(1, surveys.GetProperty("totalCount").GetInt32());
        Assert.Equal("Done", surveys.GetProperty("items")[0].GetProperty("status").GetString());
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Delete, $"/api/v1/customers/{customer}", "Manager", manager)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Send(HttpMethod.Get, "/api/v1/me", "Customer", customer)).StatusCode);
        foreach (var tab in new[] { "", "/orders", "/feedback", "/surveys" })
            await Problem(await Send(HttpMethod.Get, $"/api/v1/customers/{customer}{tab}", "Manager", manager), HttpStatusCode.NotFound, "NOT_FOUND");
        await using var verify = Database.CreateContext();
        Assert.True((await verify.Set<Account>().IgnoreQueryFilters().SingleAsync(a => a.Id == customer)).IsDeleted);
        Assert.Equal(1, await verify.Set<Order>().CountAsync(o => o.CustomerId == customer));
        Assert.Equal(1, await verify.Set<Feedback>().CountAsync(f => f.CustomerId == customer));
        Assert.Equal(1, await verify.Set<SurveyResponse>().CountAsync(r => r.CustomerId == customer));
    }

    [Fact]
    public async Task Lock_unlock_clear_temporary_lockout_and_revoke_sessions()
    {
        var manager = await Actor(AccountRole.Manager);
        var customer = await Actor(AccountRole.Customer);
        await using (var db = Database.CreateContext())
        {
            var account = await db.Set<Account>().SingleAsync(a => a.Id == customer);
            account.LockoutEnd = DateTime.UtcNow.AddMinutes(15); account.FailedLoginCount = 2;
            db.Add(new RefreshToken { AccountId = customer, TokenHash = "customer-session", ExpiresAt = DateTime.UtcNow.AddDays(1) });
            await db.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Post, $"/api/v1/customers/{customer}/unlock", "Manager", manager)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Get, "/api/v1/me", "Customer", customer)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Post, $"/api/v1/customers/{customer}/lock", "Manager", manager)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Send(HttpMethod.Get, "/api/v1/me", "Customer", customer)).StatusCode);
        await using var verify = Database.CreateContext();
        var saved = await verify.Set<Account>().SingleAsync(a => a.Id == customer);
        Assert.Null(saved.LockoutEnd); Assert.Equal(0, saved.FailedLoginCount);
        Assert.NotNull((await verify.Set<RefreshToken>().SingleAsync(t => t.AccountId == customer)).RevokedAt);
    }

    [Fact]
    public async Task Invalid_profile_or_preferences_roll_back_and_withdrawn_consent_hides_preferences()
    {
        var manager = await Actor(AccountRole.Manager);
        var customer = await Actor(AccountRole.Customer);
        int pref;
        await using (var setup = Database.CreateContext())
        {
            var p = new Preference { Name = "Sở thích riêng" }; setup.Add(p); await setup.SaveChangesAsync(); pref = p.Id;
            var c = await setup.Set<CustomerProfile>().SingleAsync(c => c.AccountId == customer); c.ConsentPersonalData = true;
            setup.Add(new CustomerPreference { CustomerId = customer, PreferenceId = pref, Source = PreferenceSource.Survey });
            await setup.SaveChangesAsync();
        }
        await Problem(await Send(HttpMethod.Post, "/api/v1/customers", "Manager", manager,
            new { email = "invalid@example.test", fullName = "Khách mới", consentPersonalData = true, preferenceIds = new[] { int.MaxValue } }), HttpStatusCode.BadRequest, "VALIDATION_ERROR");
        await Problem(await Send(HttpMethod.Put, $"/api/v1/customers/{customer}", "Manager", manager,
            new { fullName = "Khách", dateOfBirth = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1) }), HttpStatusCode.BadRequest, "VALIDATION_ERROR");
        await Problem(await Send(HttpMethod.Put, $"/api/v1/customers/{customer}", "Manager", manager,
            new { fullName = "Khách", consentPersonalData = false, preferenceIds = new[] { pref } }), HttpStatusCode.BadRequest, "VALIDATION_ERROR");
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Put, $"/api/v1/customers/{customer}", "Manager", manager,
            new { fullName = "Khách không consent", consentPersonalData = false })).StatusCode);
        var detail = await Json(await Send(HttpMethod.Get, $"/api/v1/customers/{customer}", "Manager", manager));
        Assert.Equal(0, detail.GetProperty("preferences").GetArrayLength());
        var list = await Json(await Send(HttpMethod.Get, $"/api/v1/customers?preferenceId={pref}", "Manager", manager));
        Assert.Equal(0, list.GetProperty("totalCount").GetInt32());
        await using var verify = Database.CreateContext();
        Assert.False(await verify.Set<Account>().AnyAsync(a => a.Email == "invalid@example.test"));
        Assert.Equal(PreferenceSource.Survey, (await verify.Set<CustomerPreference>().SingleAsync(p => p.CustomerId == customer)).Source);
    }

    private static (HttpMethod Method, string Route, object? Body)[] Requests(int id) => [
        (HttpMethod.Get, "/api/v1/customers", null), (HttpMethod.Post, "/api/v1/customers", new { email = "new@example.test", fullName = "Khách mới" }),
        (HttpMethod.Get, $"/api/v1/customers/{id}", null),
        (HttpMethod.Put, $"/api/v1/customers/{id}", new { fullName = "Họ tên" }),
        (HttpMethod.Post, $"/api/v1/customers/{id}/lock", null), (HttpMethod.Post, $"/api/v1/customers/{id}/unlock", null),
        (HttpMethod.Delete, $"/api/v1/customers/{id}", null), (HttpMethod.Get, $"/api/v1/customers/{id}/orders", null),
        (HttpMethod.Get, $"/api/v1/customers/{id}/feedback", null), (HttpMethod.Get, $"/api/v1/customers/{id}/surveys", null) ];

    private async Task<(int OrderId, int ProductId)> AddHistory(int customer, int manager)
    {
        await using var db = Database.CreateContext();
        var category = new Category { Name = "Danh mục lịch sử" }; db.Add(category); await db.SaveChangesAsync();
        var product = new Product { Name = "Sản phẩm lịch sử", CategoryId = category.Id, IsDeleted = true }; db.Add(product); await db.SaveChangesAsync();
        var variant = new ProductVariant { ProductId = product.Id, Sku = Guid.NewGuid().ToString("N"), Name = "100ml", Price = 100000 }; db.Add(variant);
        var order = new Order { CustomerId = customer, Code = Guid.NewGuid().ToString("N")[..20], TotalAmount = 100000 }; db.Add(order);
        var survey = new Survey { CreatedBy = manager, Title = "Khảo sát lịch sử", IsDeleted = true }; db.Add(survey); await db.SaveChangesAsync();
        var line = new OrderItem { OrderId = order.Id, ProductVariantId = variant.Id, Quantity = 1, UnitPrice = 100000 }; db.Add(line);
        db.Add(new SurveyRecipient { SurveyId = survey.Id, CustomerId = customer, Status = RecipientStatus.Done, CompletedAt = DateTime.UtcNow });
        db.Add(new SurveyResponse { SurveyId = survey.Id, CustomerId = customer }); await db.SaveChangesAsync();
        db.Add(new Feedback { CustomerId = customer, ProductId = product.Id, OrderItemId = line.Id, Rating = 4, Content = "Phản hồi lịch sử của khách hàng." });
        await db.SaveChangesAsync();
        return (order.Id, product.Id);
    }
}
