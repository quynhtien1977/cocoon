using System.Security;
using System.Text;

namespace Cocoon.Infrastructure.Seeding;

internal static class DemoCatalog
{
    internal static readonly string[] Categories =
        ["Làm sạch", "Dưỡng da", "Chống nắng", "Chăm sóc tóc", "Dưỡng thể", "Chăm sóc môi"];

    internal static readonly string[] Preferences =
        ["Da dầu", "Da khô", "Da nhạy cảm", "Mụn", "Thâm nám", "Tóc gãy rụng",
         "Mùi thảo mộc", "Thuần chay", "Chống nắng", "Dưỡng thể", "Cấp ẩm", "Chăm sóc môi"];

    // Illustrative demo names and prices, not a live commercial catalog.
    internal static readonly string[] Products =
    [
        "Sữa rửa mặt sen Hậu Giang", "Nước sen Hậu Giang", "Gel rửa mặt bí đao", "Nước tẩy trang bí đao",
        "Tinh chất nghệ Hưng Yên", "Kem dưỡng bí đao", "Mặt nạ cà phê Đắk Lắk", "Tinh chất rau má",
        "Kem chống nắng bí đao", "Sữa chống nắng nghệ", "Kem chống nắng rau má", "Sữa chống nắng hoa sen",
        "Dầu gội bưởi", "Dầu xả bưởi", "Tinh dầu dưỡng tóc bưởi", "Xịt dưỡng tóc hương nhu",
        "Sữa tắm cà phê", "Tẩy da chết cà phê", "Sữa dưỡng thể dừa", "Gel tắm hoa sen",
        "Son dưỡng dầu dừa", "Son dưỡng cà phê", "Son dưỡng sen mới", "Mặt nạ môi dừa mới"
    ];

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
