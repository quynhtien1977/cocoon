using System.Security;
using System.Text;
using System.Text.Json;
using Cocoon.Domain;
using Cocoon.Domain.Entities;
using Cocoon.Domain.Enums;
using Cocoon.Infrastructure.Persistence;
using Cocoon.Infrastructure.Seeding;
using Microsoft.EntityFrameworkCore;

namespace Cocoon.Tests;

public sealed class ProductImageSeedTests(DemoSeedDatabaseFixture database) : IClassFixture<DemoSeedDatabaseFixture>
{
    private static readonly DateTime ReferenceUtc = new(2026, 11, 5, 0, 0, 0, DateTimeKind.Utc);
    private sealed record SourceVariant(string Name, decimal Price, string ImageUrl, string SourceUrl, string SourceTitle);
    private sealed record SourceProduct(string LegacyName, string Name, string Category, SourceVariant[] Variants);
    private sealed record SourceCatalog(string VerifiedOn, SourceProduct[] Products);
    private static SourceProduct[] Sources()
    {
        using var source = typeof(DemoDataSeeder).Assembly.GetManifestResourceStream("Cocoon.Infrastructure.Seeding.cocoon-catalog.json")!;
        return JsonSerializer.Deserialize<SourceCatalog>(source, new JsonSerializerOptions(JsonSerializerDefaults.Web))!.Products;
    }

    [Fact]
    public async Task Fresh_catalog_has_only_verified_products_sizes_prices_and_images()
    {
        await using var db = database.CreateContext();
        await using var transaction = await db.Database.BeginTransactionAsync();
        Assert.Equal(1519, await new DemoDataSeeder(db, _ => "test-hash", ReferenceUtc).RunAsync());
        var sources = Sources();
        var variants = await db.Set<ProductVariant>().ToListAsync();
        var products = await db.Set<Product>().ToDictionaryAsync(p => p.Id);
        var categories = await db.Set<Category>().ToDictionaryAsync(c => c.Id, c => c.Name);
        Assert.Equal(24, products.Count);
        Assert.Equal(35, variants.Count);
        Assert.Equal(35, sources.SelectMany(p => p.Variants).Select(v => v.SourceUrl).Distinct().Count());
        for (var i = 0; i < sources.Length; i++)
        {
            var rows = variants.Where(v => v.Sku.StartsWith($"COC-V1-{i + 1:000}-", StringComparison.Ordinal)).OrderBy(v => v.Sku).ToArray();
            Assert.Equal(sources[i].Variants.Length, rows.Length);
            var product = products[rows[0].ProductId];
            Assert.Equal(sources[i].Name, product.Name);
            Assert.Equal(SearchText.Normalize(product.Name), product.NameNormalized);
            Assert.Equal(sources[i].Category, categories[product.CategoryId]);
            for (var j = 0; j < rows.Length; j++)
            {
                var expected = sources[i].Variants[j];
                Assert.Equal(expected.Name, rows[j].Name);
                Assert.Equal(expected.Price, rows[j].Price);
                Assert.Equal(expected.ImageUrl, rows[j].ImageUrl);
                Assert.Equal("image.cocoonvietnam.com", new Uri(rows[j].ImageUrl!).Host);
                Assert.Equal("cocoonvietnam.com", new Uri(expected.SourceUrl).Host);
                Assert.StartsWith("https://", expected.SourceUrl);
                Assert.False(string.IsNullOrWhiteSpace(expected.SourceTitle));
            }
        }
        Assert.Equal(320, await db.Set<Order>().CountAsync());
        Assert.Equal(640, await db.Set<OrderItem>().CountAsync());
    }

    [Fact]
    public async Task Legacy_catalog_is_corrected_without_deleting_ids_skus_or_order_history()
    {
        await using var db = database.CreateContext();
        await using var transaction = await db.Database.BeginTransactionAsync();
        await MakeLegacyCatalog(db);
        var ids = await db.Set<ProductVariant>().ToDictionaryAsync(v => v.Sku, v => v.Id);
        var productIds = await db.Set<Product>().OrderBy(p => p.Id).Select(p => p.Id).ToArrayAsync();
        var orders = await History(db);
        db.ChangeTracker.Clear();
        Assert.Equal(0, await new DemoDataSeeder(db, _ => throw new InvalidOperationException("Không tạo lại tài khoản."), ReferenceUtc.AddDays(1)).RunAsync());
        db.ChangeTracker.Clear();
        var all = await db.Set<ProductVariant>().IgnoreQueryFilters().ToListAsync();
        Assert.Equal(48, all.Count);
        Assert.Equal(13, all.Count(v => v.IsDeleted));
        Assert.Equal(35, all.Count(v => !v.IsDeleted));
        Assert.Equal(ids.OrderBy(x => x.Key), all.ToDictionary(v => v.Sku, v => v.Id).OrderBy(x => x.Key));
        Assert.Equal(productIds, await db.Set<Product>().OrderBy(p => p.Id).Select(p => p.Id).ToArrayAsync());
        Assert.All(all, v => Assert.StartsWith("https://image.cocoonvietnam.com/", v.ImageUrl));
        Assert.Equal(orders, await History(db));
        var snapshot = JsonSerializer.Serialize(all.OrderBy(v => v.Id));
        Assert.Equal(0, await new DemoDataSeeder(db, _ => "unused", ReferenceUtc.AddDays(2)).RunAsync());
        db.ChangeTracker.Clear();
        Assert.Equal(snapshot, JsonSerializer.Serialize((await db.Set<ProductVariant>().IgnoreQueryFilters().ToListAsync()).OrderBy(v => v.Id)));
    }

    [Fact]
    public async Task Upgrade_preserves_custom_values_deletions_manual_variants_and_used_legacy_variants()
    {
        await using var db = database.CreateContext();
        await using var transaction = await db.Database.BeginTransactionAsync();
        await MakeLegacyCatalog(db);
        var variants = await db.Set<ProductVariant>().ToDictionaryAsync(v => v.Sku);
        variants["COC-V1-002-1"].ImageUrl = "/uploads/custom.jpg";
        variants["COC-V1-002-2"].ImageUrl = "data:image/svg+xml;base64,PHN2Zy8+";
        variants["COC-V1-003-1"].ImageUrl = null;
        variants["COC-V1-003-2"].IsDeleted = true;
        variants["COC-V1-005-2"].Price = 222222;
        var deletedProductId = variants["COC-V1-004-1"].ProductId;
        (await db.Set<Product>().SingleAsync(p => p.Id == deletedProductId)).IsDeleted = true;
        var renamedId = variants["COC-V1-006-1"].ProductId;
        var renamed = await db.Set<Product>().SingleAsync(p => p.Id == renamedId);
        renamed.Name = "Sản phẩm team đã chỉnh"; renamed.Description = "Mô tả tự chỉnh";
        db.Add(new ProductVariant { ProductId = renamedId, Sku = "MANUAL-PHOTO", Name = "Thêm thủ công", Price = 123456, ImageUrl = LegacyPlaceholder(0, "Nước sen Hậu Giang") });
        var customerId = await db.Set<CustomerProfile>().Select(c => c.AccountId).FirstAsync();
        var order = new Order { CustomerId = customerId, Code = "MANUAL-OLD-VARIANT", TotalAmount = 33333, Status = OrderStatus.Completed };
        db.Add(order); await db.SaveChangesAsync();
        db.Add(new OrderItem { OrderId = order.Id, ProductVariantId = variants["COC-V1-009-3"].Id, Quantity = 1, UnitPrice = 33333 });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        var protectedSkus = new[] { "COC-V1-003-2", "COC-V1-004-1", "COC-V1-005-2", "COC-V1-009-3", "MANUAL-PHOTO" };
        var protectedJson = JsonSerializer.Serialize(await db.Set<ProductVariant>().IgnoreQueryFilters().Where(v => protectedSkus.Contains(v.Sku)).OrderBy(v => v.Sku).ToListAsync());
        var orders = await History(db);
        db.ChangeTracker.Clear();
        Assert.Equal(0, await new DemoDataSeeder(db, _ => "unused", ReferenceUtc.AddDays(1)).RunAsync());
        db.ChangeTracker.Clear();
        Assert.Equal(protectedJson, JsonSerializer.Serialize(await db.Set<ProductVariant>().IgnoreQueryFilters().Where(v => protectedSkus.Contains(v.Sku)).OrderBy(v => v.Sku).ToListAsync()));
        Assert.Equal("/uploads/custom.jpg", (await db.Set<ProductVariant>().SingleAsync(v => v.Sku == "COC-V1-002-1")).ImageUrl);
        Assert.Equal("data:image/svg+xml;base64,PHN2Zy8+", (await db.Set<ProductVariant>().SingleAsync(v => v.Sku == "COC-V1-002-2")).ImageUrl);
        Assert.Null((await db.Set<ProductVariant>().SingleAsync(v => v.Sku == "COC-V1-003-1")).ImageUrl);
        Assert.Equal("Sản phẩm team đã chỉnh", (await db.Set<Product>().SingleAsync(p => p.Id == renamedId)).Name);
        Assert.Equal("Mô tả tự chỉnh", (await db.Set<Product>().SingleAsync(p => p.Id == renamedId)).Description);
        Assert.Equal(orders, await History(db));
    }

    private static async Task MakeLegacyCatalog(AppDbContext db)
    {
        await new DemoDataSeeder(db, _ => "test-hash", ReferenceUtc).RunAsync();
        string[] categories = ["Làm sạch", "Dưỡng da", "Chống nắng", "Chăm sóc tóc", "Dưỡng thể", "Chăm sóc môi"];
        var ids = await db.Set<Category>().ToDictionaryAsync(c => c.Name, c => c.Id);
        var variants = await db.Set<ProductVariant>().ToListAsync();
        var products = await db.Set<Product>().ToDictionaryAsync(p => p.Id);
        var sources = Sources();
        for (var i = 0; i < sources.Length; i++)
        {
            var prefix = $"COC-V1-{i + 1:000}-";
            var product = products[variants.First(v => v.Sku == prefix + "1").ProductId];
            product.Name = sources[i].LegacyName; product.NameNormalized = SearchText.Normalize(product.Name);
            product.CategoryId = ids[categories[i / 4]];
            product.Description = $"{product.Name} — sản phẩm mô phỏng phục vụ đồ án CRM.";
            product.Ingredients = "Thành phần mô phỏng từ thực vật.";
            product.Benefits = "Chăm sóc cá nhân theo nhu cầu.";
            product.Usage = "Dữ liệu minh họa, không phải hướng dẫn sử dụng sản phẩm thật.";
            for (var j = 0; j < 1 + i % 3; j++)
            {
                var sku = prefix + (j + 1);
                var row = variants.SingleOrDefault(v => v.Sku == sku);
                if (row is null) { row = new ProductVariant { ProductId = product.Id, Sku = sku }; db.Add(row); }
                row.Name = $"{100 + j * 100} ml"; row.Price = (90000 + i * 10000) * (j + 1);
                row.ImageUrl = LegacyPlaceholder(i / 4, sources[i].LegacyName); row.IsDeleted = false;
            }
        }
        await db.SaveChangesAsync();
    }

    private static async Task<string> History(AppDbContext db) => JsonSerializer.Serialize(new
    {
        Orders = await db.Set<Order>().OrderBy(o => o.Id).Select(o => new { o.Id, o.Code, o.TotalAmount, o.OrderedAt }).ToListAsync(),
        Lines = await db.Set<OrderItem>().OrderBy(i => i.Id).Select(i => new { i.Id, i.OrderId, i.ProductVariantId, i.Quantity, i.UnitPrice }).ToListAsync()
    });

    private static string LegacyPlaceholder(int category, string name)
    {
        string[] colors = ["#E8F0E6", "#FBF0DF", "#FCE8EE", "#EDE0CC", "#E8EEF4", "#F4E7EB"];
        var svg = $"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"600\">"
            + $"<rect width=\"600\" height=\"600\" fill=\"{colors[category]}\"/>"
            + "<text x=\"300\" y=\"260\" text-anchor=\"middle\" font-family=\"sans-serif\" font-size=\"32\" fill=\"#1F1C17\">cocoon</text>"
            + $"<text x=\"300\" y=\"320\" text-anchor=\"middle\" font-family=\"sans-serif\" font-size=\"18\" fill=\"#1F1C17\">{SecurityElement.Escape(name)}</text>"
            + "<text x=\"300\" y=\"360\" text-anchor=\"middle\" font-family=\"sans-serif\" font-size=\"16\" fill=\"#414548\">Dữ liệu mô phỏng</text></svg>";
        return "data:image/svg+xml;base64," + Convert.ToBase64String(Encoding.UTF8.GetBytes(svg));
    }
}
