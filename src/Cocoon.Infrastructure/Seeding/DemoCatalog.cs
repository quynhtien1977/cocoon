using System.Security;
using System.Text;
using System.Text.Json;

namespace Cocoon.Infrastructure.Seeding;

internal static class DemoCatalog
{
    internal static readonly string[] Categories =
        ["Làm sạch", "Dưỡng da", "Chống nắng", "Chăm sóc tóc", "Dưỡng thể", "Chăm sóc môi"];

    internal static readonly string[] Preferences =
        ["Da dầu", "Da khô", "Da nhạy cảm", "Mụn", "Thâm nám", "Tóc gãy rụng",
         "Mùi thảo mộc", "Thuần chay", "Chống nắng", "Dưỡng thể", "Cấp ẩm", "Chăm sóc môi"];

    internal sealed record CatalogVariant(string Name, decimal Price, string ImageUrl, string SourceUrl);
    internal sealed record CatalogProduct(string LegacyName, string Name, string Category, CatalogVariant[] Variants);
    private sealed record CatalogSnapshot(CatalogProduct[] Products);

    // A reviewed, embedded snapshot: seed never depends on the network or the frontend filesystem.
    internal static readonly CatalogProduct[] Products = LoadProducts();

    private static CatalogProduct[] LoadProducts()
    {
        using var source = typeof(DemoCatalog).Assembly.GetManifestResourceStream("Cocoon.Infrastructure.Seeding.cocoon-catalog.json")
            ?? throw new InvalidOperationException("Thiếu snapshot catalog Cocoon.");
        return JsonSerializer.Deserialize<CatalogSnapshot>(source, new JsonSerializerOptions(JsonSerializerDefaults.Web))?.Products
            ?? throw new InvalidOperationException("Snapshot catalog Cocoon không hợp lệ.");
    }

    internal static bool IsLegacyImage(int index, string? image) => image is not null
        && (image == Placeholder(index / 4, Products[index].LegacyName) || image == LegacyOfficialImage(index));

    // Verified against the existing FE image manifests; do not infer photos from category or similar names.
    private static string? LegacyOfficialImage(int index) => index switch
    {
        1 => "https://image.cocoonvietnam.com/uploads/Web_Avatar_Nuoc_Sen_140ml_copy_100_14377247e3.jpg",
        2 => "https://image.cocoonvietnam.com/uploads/z3526520930085_8478409d6ac4058a7b77514ce71bdada_d14a16f231.jpg",
        3 => "https://image.cocoonvietnam.com/uploads/Artboard_6_3ec256ca12.jpg",
        20 => "https://image.cocoonvietnam.com/uploads/Son_duong_dau_dua_26498c9936.jpg",
        _ => null
    };

    internal static string Placeholder(int category, string name)
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
