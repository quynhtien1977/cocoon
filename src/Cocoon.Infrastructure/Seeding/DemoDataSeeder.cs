using Cocoon.Domain;
using Cocoon.Domain.Entities;
using Cocoon.Domain.Enums;
using Cocoon.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Cocoon.Infrastructure.Seeding;

public sealed partial class DemoDataSeeder(AppDbContext db, Func<Account, string> hashPassword, DateTime referenceUtc)
{
    private int _added;

    /// <summary>Adds local demo data. Existing rows, credentials and user edits are never reset.</summary>
    public async Task<int> RunAsync(CancellationToken cancellationToken = default, bool includeFeedback = false)
    {
        if (referenceUtc.Kind != DateTimeKind.Utc)
            throw new ArgumentException("Mốc seed phải là UTC.", nameof(referenceUtc));
        _added = 0;
        await using var transaction = db.Database.CurrentTransaction is null
            ? await db.Database.BeginTransactionAsync(cancellationToken) : null;
        var preferences = await AddPreferences(cancellationToken);
        var customers = await AddAccounts(preferences, cancellationToken);
        var products = await AddCatalog(preferences, cancellationToken);
        await AddOrders(customers, products, cancellationToken);
        if (includeFeedback) await AddFeedback(cancellationToken);
        if (transaction is not null) await transaction.CommitAsync(cancellationToken);
        return _added;
    }

    private T Add<T>(T entity) where T : class
    {
        db.Add(entity);
        _added++;
        return entity;
    }

    private async Task<List<Preference>> AddPreferences(CancellationToken ct)
    {
        var existing = await db.Set<Preference>().ToListAsync(ct);
        var result = DemoCatalog.Preferences.Select(name => existing.SingleOrDefault(p => p.Name == name)
            ?? Add(new Preference { Name = name })).ToList();
        await db.SaveChangesAsync(ct);
        return result;
    }

    private async Task<List<CustomerProfile>> AddAccounts(List<Preference> preferences, CancellationToken ct)
    {
        var accounts = (await db.Set<Account>().IgnoreQueryFilters().ToListAsync(ct))
            .ToDictionary(a => a.Email, StringComparer.OrdinalIgnoreCase);
        var staff = await db.Set<StaffProfile>().IgnoreQueryFilters().ToListAsync(ct);
        var customers = await db.Set<CustomerProfile>().IgnoreQueryFilters().ToListAsync(ct);
        var result = new List<CustomerProfile>();
        string[] familyNames = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Vũ", "Đặng", "Bùi"];
        string[] givenNames = ["An", "Bình", "Chi", "Dũng", "Hà", "Linh", "Minh", "Ngọc", "Phúc", "Trang"];
        int[] ages = [16, 20, 29, 39, 52];
        for (var index = 0; index < 87; index++)
        {
            var customerIndex = index - 4;
            var role = index == 0 ? AccountRole.Admin : index == 1 ? AccountRole.Manager
                : index < 4 ? AccountRole.Staff : AccountRole.Customer;
            var email = index switch
            {
                0 => "admin@cocoon.demo", 1 => "manager@cocoon.demo",
                2 => "staff1@cocoon.demo", 3 => "staff2@cocoon.demo",
                _ => $"customer{customerIndex + 1:00}@cocoon.demo"
            };
            if (!accounts.TryGetValue(email, out var account))
            {
                account = new Account
                {
                    Email = email, Role = role, IsActive = customerIndex is not (80 or 81),
                    IsDeleted = customerIndex == 82, CreatedAt = referenceUtc.AddMonths(-12)
                };
                account.PasswordHash = hashPassword(account);
                Add(account);
                accounts.Add(email, account);
                await db.SaveChangesAsync(ct);
            }
            else if (account.Role != role)
                throw new InvalidOperationException("Email demo đã có vai trò khác. Seed không thay đổi quyền tài khoản.");

            if (role != AccountRole.Customer)
            {
                if (!staff.Any(s => s.AccountId == account.Id))
                    Add(new StaffProfile
                    {
                        AccountId = account.Id, FullName = index switch
                        {
                            0 => "Quản trị Cocoon", 1 => "Quản lý Cocoon", 2 => "Nguyễn Tiến An", _ => "Trần Minh Anh"
                        },
                        Phone = $"090000000{index}", Position = role.ToString()
                    });
                continue;
            }

            var customer = customers.SingleOrDefault(c => c.AccountId == account.Id);
            if (customer is null)
            {
                var middleName = new[] { "Văn", "Thị", "Minh" }[customerIndex % 3];
                var fullName = $"{familyNames[customerIndex % familyNames.Length]} {middleName} {givenNames[customerIndex / familyNames.Length % givenNames.Length]}";
                customer = Add(new CustomerProfile
                {
                    AccountId = account.Id, FullName = fullName, FullNameNormalized = SearchText.Normalize(fullName),
                    Phone = $"091{customerIndex + 1:0000000}",
                    DateOfBirth = customerIndex % 11 == 10 ? null : DateOnly.FromDateTime(referenceUtc).AddYears(-ages[customerIndex % ages.Length]),
                    Gender = new[] { "Nam", "Nữ", "Khác" }[customerIndex % 3],
                    Address = $"{customerIndex + 1} Nguyễn Trãi, Thành phố Hồ Chí Minh",
                    ConsentPersonalData = customerIndex % 10 != 9
                });
                // Only initialize preferences with a NEW profile; reruns preserve subsequent user choices.
                await db.SaveChangesAsync(ct);
                for (var tag = 0; tag < 2 + customerIndex % 3; tag++)
                    Add(new CustomerPreference
                    {
                        CustomerId = account.Id, PreferenceId = preferences[(customerIndex + tag * 3) % preferences.Count].Id,
                        Source = PreferenceSource.Declared, CreatedAt = referenceUtc
                    });
            }
            result.Add(customer);
        }
        await db.SaveChangesAsync(ct);
        return result;
    }

    private async Task<List<Product>> AddCatalog(List<Preference> preferences, CancellationToken ct)
    {
        var categories = await db.Set<Category>().ToListAsync(ct);
        var selectedCategories = DemoCatalog.Categories.Select(name => categories.SingleOrDefault(c => c.Name == name)
            ?? Add(new Category { Name = name })).ToList();
        await db.SaveChangesAsync(ct);
        var existingProducts = await db.Set<Product>().IgnoreQueryFilters().ToListAsync(ct);
        var variants = await db.Set<ProductVariant>().IgnoreQueryFilters().ToListAsync(ct);
        var result = new List<Product>();
        for (var index = 0; index < DemoCatalog.Products.Length; index++)
        {
            var skuPrefix = $"COC-V1-{index + 1:000}-";
            var productIds = variants.Where(v => v.Sku.StartsWith(skuPrefix, StringComparison.Ordinal)).Select(v => v.ProductId).Distinct().ToArray();
            if (productIds.Length > 1) throw new InvalidOperationException("SKU demo trỏ đến nhiều sản phẩm. Seed đã dừng.");
            var name = DemoCatalog.Products[index];
            var product = productIds.Length == 1 ? existingProducts.Single(p => p.Id == productIds[0])
                : existingProducts.SingleOrDefault(p => p.NameNormalized == SearchText.Normalize(name));
            if (product is null)
            {
                product = Add(new Product
                {
                    Name = name, NameNormalized = SearchText.Normalize(name), CategoryId = selectedCategories[index / 4].Id,
                    Description = $"{name} — sản phẩm mô phỏng phục vụ đồ án CRM.",
                    Ingredients = "Thành phần mô phỏng từ thực vật.", Benefits = "Chăm sóc cá nhân theo nhu cầu.",
                    Usage = "Dữ liệu minh họa, không phải hướng dẫn sử dụng sản phẩm thật.",
                    Status = index >= 22 ? ProductStatus.Upcoming : index == 21 ? ProductStatus.Inactive : ProductStatus.Active,
                    CreatedAt = referenceUtc.AddMonths(-12)
                });
                await db.SaveChangesAsync(ct);
                for (var tag = 0; tag < 2 + index % 2; tag++)
                    Add(new ProductPreference
                    {
                        ProductId = product.Id,
                        PreferenceId = preferences[(index / 2 + (tag == 2 ? 6 : tag)) % preferences.Count].Id
                    });
            }
            for (var variantIndex = 0; variantIndex < 1 + index % 3; variantIndex++)
            {
                var sku = skuPrefix + (variantIndex + 1);
                if (!variants.Any(v => v.Sku == sku))
                    variants.Add(Add(new ProductVariant
                    {
                        ProductId = product.Id, Sku = sku, Name = $"{100 + variantIndex * 100} ml",
                        Price = (90000 + index * 10000) * (variantIndex + 1),
                        ImageUrl = DemoCatalog.Placeholder(index / 4, name)
                    }));
            }
            result.Add(product);
        }
        await db.SaveChangesAsync(ct);
        return result;
    }

    private async Task AddOrders(List<CustomerProfile> customers, List<Product> products, CancellationToken ct)
    {
        var codes = (await db.Set<Order>().Select(o => o.Code).ToListAsync(ct)).ToHashSet(StringComparer.Ordinal);
        var variants = await db.Set<ProductVariant>().ToListAsync(ct);
        var tags = await db.Set<ProductPreference>().ToListAsync(ct);
        var preferences = await db.Set<CustomerPreference>().ToListAsync(ct);
        var active = products.Where(p => p.Status == ProductStatus.Active && !p.IsDeleted
            && variants.Any(v => v.ProductId == p.Id)).ToList();
        for (var index = 0; index < 320; index++)
        {
            var code = $"CO-V1-{index + 1:000000}";
            if (codes.Contains(code)) continue; // Preserve order lines, dates and prices as historical data.
            var customer = customers[index % 80];
            var preferenceIds = preferences.Where(p => p.CustomerId == customer.AccountId).Select(p => p.PreferenceId).ToHashSet();
            var preferMatch = (index / 80 + index % 80) % 10 < 7;
            var candidates = active.Where(p => tags.Any(t => t.ProductId == p.Id && preferenceIds.Contains(t.PreferenceId)) == preferMatch).ToList();
            if (candidates.Count < 2)
                throw new InvalidOperationException("Danh mục hoặc sở thích demo đã thay đổi; không đủ sản phẩm cho quy luật mua. Seed đã dừng và không ghi đè dữ liệu.");
            var chosen = candidates.Take(2).Select(p => variants.Where(v => v.ProductId == p.Id)
                .OrderBy(v => v.Sku, StringComparer.Ordinal).First()).ToArray();
            var quantity = 1 + index % 3;
            var order = Add(new Order
            {
                Code = code, CustomerId = customer.AccountId, Channel = (OrderChannel)(index % 3),
                Status = index % 20 == 18 ? OrderStatus.Cancelled : index % 20 == 19 ? OrderStatus.Returned : OrderStatus.Completed,
                OrderedAt = referenceUtc.AddMonths(-(index % 12)).AddDays(-(index / 12 % 21)),
                TotalAmount = chosen.Sum(v => quantity * v.Price)
            });
            await db.SaveChangesAsync(ct);
            foreach (var variant in chosen)
                Add(new OrderItem { OrderId = order.Id, ProductVariantId = variant.Id, Quantity = quantity, UnitPrice = variant.Price });
        }
        await db.SaveChangesAsync(ct);
    }
}
