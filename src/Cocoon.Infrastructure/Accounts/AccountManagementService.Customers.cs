using Cocoon.Application.Accounts;
using Cocoon.Domain;
using Cocoon.Domain.Entities;
using Cocoon.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Cocoon.Infrastructure.Accounts;

public sealed partial class AccountManagementService
{
    private IQueryable<CustomerProfile> Customers => db.Set<CustomerProfile>().Where(c => c.Account.Role == AccountRole.Customer);

    public async Task<CustomerPage<CustomerRow>> CustomersAsync(CustomerQuery query, CancellationToken ct)
    {
        if (query.Status is not (null or "Active" or "Locked")) Invalid("status", "Trạng thái không hợp lệ.");
        if (query.Order is not (null or "asc" or "desc")) Invalid("order", "Thứ tự không hợp lệ.");
        if (query.Gender is not (null or "Nam" or "Nữ" or "Khác")) Invalid("gender", "Giới tính không hợp lệ.");
        if (query.Sort is not (null or "fullName" or "email" or "joinedAt" or "orderCount" or "lastOrderAt"))
            Invalid("sort", "Cột sắp xếp không hợp lệ.");
        if (query.AgeMin is < 0 or > 150 || query.AgeMax is < 0 or > 150 || query.AgeMin > query.AgeMax)
            Invalid("ageMin", "Khoảng tuổi không hợp lệ.");
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var rows = Customers.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = SearchText.Normalize(query.Search);
            rows = rows.Where(c => c.FullNameNormalized.Contains(term) || c.Account.Email.Contains(term)
                || (c.Phone != null && c.Phone.Contains(term)));
        }
        if (query.Status is not null) rows = rows.Where(c => c.Account.IsActive == (query.Status == "Active"));
        if (query.Gender is not null) rows = rows.Where(c => c.Gender == query.Gender);
        if (query.AgeMin is { } min) { var latest = today.AddYears(-min); rows = rows.Where(c => c.DateOfBirth <= latest); }
        if (query.AgeMax is { } max) { var earliest = today.AddYears(-max - 1); rows = rows.Where(c => c.DateOfBirth > earliest); }
        if (query.PreferenceId is { } pref) rows = rows.Where(c => c.ConsentPersonalData
            && db.Set<CustomerPreference>().Any(p => p.CustomerId == c.AccountId && p.PreferenceId == pref));
        var projected = rows.Select(c => new { C = c, Email = c.Account.Email, Active = c.Account.IsActive, JoinedAt = c.Account.CreatedAt,
            OrderCount = db.Set<Order>().Count(o => o.CustomerId == c.AccountId),
            LastOrderAt = db.Set<Order>().Where(o => o.CustomerId == c.AccountId && o.Status == OrderStatus.Completed).Max(o => (DateTime?)o.OrderedAt) });
        var desc = query.Order == "desc";
        var ordered = query.Sort switch
        {
            "email" => desc ? projected.OrderByDescending(x => x.Email) : projected.OrderBy(x => x.Email),
            "joinedAt" => desc ? projected.OrderByDescending(x => x.JoinedAt) : projected.OrderBy(x => x.JoinedAt),
            "orderCount" => desc ? projected.OrderByDescending(x => x.OrderCount) : projected.OrderBy(x => x.OrderCount),
            "lastOrderAt" => desc ? projected.OrderByDescending(x => x.LastOrderAt) : projected.OrderBy(x => x.LastOrderAt),
            _ => desc ? projected.OrderByDescending(x => x.C.FullName) : projected.OrderBy(x => x.C.FullName)
        };
        var total = await rows.CountAsync(ct);
        var (page, size) = (Math.Max(1, query.Page), Math.Clamp(query.PageSize, 1, 100));
        if ((long)(page - 1) * size > int.MaxValue) return new([], total, page, size);
        var selected = await ordered.ThenBy(x => x.C.AccountId).Skip((page - 1) * size).Take(size).ToListAsync(ct);
        var ids = selected.Where(x => x.C.ConsentPersonalData).Select(x => x.C.AccountId).ToArray();
        var preferences = await (from p in db.Set<CustomerPreference>() join tag in db.Set<Preference>() on p.PreferenceId equals tag.Id
                                 where ids.Contains(p.CustomerId) orderby tag.Name select new { p.CustomerId, tag.Name }).ToListAsync(ct);
        return new(selected.Select(x => new CustomerRow(x.C.AccountId, $"KH-{x.C.AccountId:D4}", x.C.FullName, x.Email, x.C.Phone,
            Age(x.C.DateOfBirth, today), x.C.Gender, preferences.Where(p => p.CustomerId == x.C.AccountId).Select(p => p.Name).ToArray(),
            x.OrderCount, x.LastOrderAt, x.JoinedAt, x.Active ? "Active" : "Locked")).ToArray(), total, page, size);
    }

    public async Task<CustomerDetails> CustomerAsync(int id, CancellationToken ct)
    {
        var c = await Customer(id, ct);
        var account = await db.Set<Account>().SingleAsync(a => a.Id == id, ct);
        var prefs = await (from p in db.Set<CustomerPreference>() join tag in db.Set<Preference>() on p.PreferenceId equals tag.Id
                           where p.CustomerId == id && c.ConsentPersonalData orderby tag.Name select new { tag.Id, tag.Name }).ToListAsync(ct);
        var orders = db.Set<Order>().Where(o => o.CustomerId == id);
        return new CustomerDetails(new CustomerRow(id, $"KH-{id:D4}", c.FullName, account.Email, c.Phone,
            Age(c.DateOfBirth, DateOnly.FromDateTime(DateTime.UtcNow)), c.Gender, prefs.Select(p => p.Name).ToArray(),
            await orders.CountAsync(ct), await orders.Where(o => o.Status == OrderStatus.Completed).MaxAsync(o => (DateTime?)o.OrderedAt, ct),
            account.CreatedAt, account.IsActive ? "Active" : "Locked"))
        {
            DateOfBirth = c.DateOfBirth, Address = c.Address, ConsentPersonalData = c.ConsentPersonalData,
            PreferenceIds = prefs.Select(p => p.Id).ToArray(),
            TotalSpent = await orders.Where(o => o.Status == OrderStatus.Completed).SumAsync(o => (decimal?)o.TotalAmount, ct) ?? 0
        };
    }

    public Task<AccountCreated> CreateCustomerAsync(int actor, string email, CustomerInput input, CancellationToken ct) => Write(async () =>
    {
        await ValidateCustomer(input, ct);
        var created = await CreateCoreAsync(actor, email, input.FullName, AccountRole.Customer, ct);
        var customer = await Customer(created.Id, ct);
        await ApplyCustomer(customer, input, ct);
        return created;
    }, ct);

    public Task<bool> UpdateCustomerAsync(int actor, int id, CustomerInput input, CancellationToken ct) => Write(async () =>
    {
        var customer = await Customer(id, ct);
        await ValidateCustomer(input, ct);
        await ApplyCustomer(customer, input, ct);
        Audit(actor, id, "CustomerUpdated");
        return true;
    }, ct);

    private async Task ValidateCustomer(CustomerInput input, CancellationToken ct)
    {
        if (input.FullName.Trim().Length is < 2 or > 200) Invalid("fullName", "Họ tên cần 2–200 ký tự.");
        if (input.Phone?.Length > 32) Invalid("phone", "Số điện thoại tối đa 32 ký tự.");
        if (input.Address?.Length > 1000) Invalid("address", "Địa chỉ tối đa 1000 ký tự.");
        if (input.Gender is not (null or "" or "Nam" or "Nữ" or "Khác")) Invalid("gender", "Giới tính không hợp lệ.");
        if (input.DateOfBirth > DateOnly.FromDateTime(DateTime.UtcNow)) Invalid("dateOfBirth", "Ngày sinh không được ở tương lai.");
        var ids = (input.PreferenceIds ?? []).Distinct().ToArray();
        if (ids.Length > 0 && !input.ConsentPersonalData) Invalid("consentPersonalData", "Cần có đồng ý trước khi ghi sở thích.");
        if (await db.Set<Preference>().CountAsync(p => ids.Contains(p.Id) && p.IsActive, ct) != ids.Length)
            Invalid("preferenceIds", "Có sở thích không còn hoạt động.");
    }

    private async Task ApplyCustomer(CustomerProfile c, CustomerInput input, CancellationToken ct)
    {
        c.FullName = input.FullName.Trim(); c.FullNameNormalized = SearchText.Normalize(c.FullName);
        c.Phone = input.Phone?.Trim(); c.DateOfBirth = input.DateOfBirth; c.Gender = input.Gender; c.Address = input.Address?.Trim();
        c.ConsentPersonalData = input.ConsentPersonalData;
        if (input.PreferenceIds is null) return; // Omitted selection preserves existing preferences; [] clears declared choices.
        var ids = input.PreferenceIds.Distinct().ToArray();
        var existing = await db.Set<CustomerPreference>().Where(p => p.CustomerId == c.AccountId).ToListAsync(ct);
        db.RemoveRange(existing.Where(p => p.Source == PreferenceSource.Declared && !ids.Contains(p.PreferenceId)));
        foreach (var p in existing.Where(p => ids.Contains(p.PreferenceId))) p.Source = PreferenceSource.Declared;
        db.AddRange(ids.Except(existing.Select(p => p.PreferenceId)).Select(id => new CustomerPreference
            { CustomerId = c.AccountId, PreferenceId = id, Source = PreferenceSource.Declared }));
    }

    public async Task<CustomerPage<CustomerOrderRow>> CustomerOrdersAsync(int id, int page, int size, CancellationToken ct)
    {
        await Customer(id, ct);
        return await Page(db.Set<Order>().Where(o => o.CustomerId == id).OrderByDescending(o => o.OrderedAt).ThenBy(o => o.Id)
            .Select(o => new CustomerOrderRow(o.Id, o.Code, o.OrderedAt, db.Set<OrderItem>().Count(i => i.OrderId == o.Id), o.TotalAmount, o.Status)), page, size, ct);
    }

    public async Task<CustomerPage<CustomerFeedbackRow>> CustomerFeedbackAsync(int id, int page, int size, CancellationToken ct)
    {
        await Customer(id, ct);
        var rows = from f in db.Set<Feedback>() join p in db.Set<Product>().IgnoreQueryFilters() on f.ProductId equals p.Id
                   where f.CustomerId == id orderby f.CreatedAt descending, f.Id
                   select new CustomerFeedbackRow(f.Id, p.Name, f.Rating, f.Content, f.CreatedAt, f.Status);
        return await Page(rows, page, size, ct);
    }

    public async Task<CustomerPage<CustomerSurveyRow>> CustomerSurveysAsync(int id, int page, int size, CancellationToken ct)
    {
        await Customer(id, ct);
        var rows = from r in db.Set<SurveyRecipient>() join s in db.Set<Survey>().IgnoreQueryFilters() on r.SurveyId equals s.Id
                   where r.CustomerId == id orderby r.SentAt descending, r.Id
                   select new CustomerSurveyRow(s.Id, s.Title, r.SentAt, r.Status,
                       db.Set<SurveyResponse>().Where(a => a.SurveyId == s.Id && a.CustomerId == id).Select(a => (DateTime?)a.SubmittedAt).SingleOrDefault());
        return await Page(rows, page, size, ct);
    }

    private async Task<CustomerProfile> Customer(int id, CancellationToken ct)
    {
        var account = await Find(id, ct);
        if (account.Role != AccountRole.Customer) throw new AccountOperationException(403, "FORBIDDEN", "Chỉ được quản lý tài khoản Customer.");
        return await Customers.SingleOrDefaultAsync(c => c.AccountId == id, ct)
            ?? throw new AccountOperationException(404, "NOT_FOUND", "Không tìm thấy hồ sơ khách hàng.");
    }

    private static int? Age(DateOnly? dob, DateOnly today) => dob is { } birth
        ? today.Year - birth.Year - (birth > today.AddYears(-(today.Year - birth.Year)) ? 1 : 0) : null;

    private static async Task<CustomerPage<T>> Page<T>(IQueryable<T> rows, int page, int size, CancellationToken ct)
    {
        (page, size) = (Math.Max(1, page), Math.Clamp(size, 1, 100));
        var count = await rows.CountAsync(ct);
        var items = (long)(page - 1) * size > int.MaxValue ? [] : await rows.Skip((page - 1) * size).Take(size).ToListAsync(ct);
        return new(items, count, page, size);
    }
}
