using Cocoon.Domain.Enums;

namespace Cocoon.Application.Shop;

/// <summary>Expected shop failures; the API turns them into ProblemDetails with a domain code.</summary>
public sealed class ShopException(int status, string code, string message, string? field = null) : Exception(message)
{
    public int Status { get; } = status;
    public string Code { get; } = code;
    public string? Field { get; } = field;
}

public sealed record ShopQuery(int Page = 1, int PageSize = 24, string? Search = null, int? CategoryId = null);
public sealed record ShopPage<T>(IReadOnlyList<T> Items, int TotalCount, int Page, int PageSize);

/// <summary>A product on sale: active, in an active category, with at least one variant.</summary>
public sealed record ShopProduct(int Id, string Name, int CategoryId, string CategoryName, decimal MinPrice, string? ImageUrl,
    double? AverageRating, int FeedbackCount, IReadOnlyList<ShopVariant> Variants);
public sealed record ShopVariant(int Id, string Name, decimal Price, string? ImageUrl);
public sealed record ShopCategory(int Id, string Name);

public sealed record OrderLineInput(int VariantId, int Quantity);
public sealed record PlaceOrderInput(IReadOnlyList<OrderLineInput>? Items, string? ShippingAddress);
public sealed record OrderPlaced(int Id, string Code, decimal TotalAmount);

public sealed record OrderQuery(int Page = 1, int PageSize = 20, string? Search = null, string? Status = null);
/// <summary>Row of the back-office order queue (Staff and Manager).</summary>
public sealed record OrderRow(int Id, string Code, int CustomerId, string CustomerName, OrderChannel Channel, OrderStatus Status,
    DateTime OrderedAt, int ItemCount, decimal TotalAmount);
public sealed record OrderCustomer(int Id, string FullName, string Email, string? Phone);
public sealed record OrderLine(int Id, int ProductId, string ProductName, string VariantName, string Sku, string? ImageUrl,
    int Quantity, decimal UnitPrice);
public sealed record OrderDetail(int Id, string Code, OrderChannel Channel, OrderStatus Status, DateTime OrderedAt, decimal TotalAmount,
    string? ShippingAddress, DateTime? ConfirmedAt, string? ConfirmedByName, DateTime? CompletedAt, DateTime? CancelledAt,
    OrderCustomer Customer, IReadOnlyList<OrderLine> Lines);
