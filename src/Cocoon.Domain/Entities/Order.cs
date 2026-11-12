using Cocoon.Domain.Enums;

namespace Cocoon.Domain.Entities;

public sealed class Order
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public int CustomerId { get; set; }
    public OrderChannel Channel { get; set; } = OrderChannel.Website;
    public OrderStatus Status { get; set; } = OrderStatus.Completed;
    public decimal TotalAmount { get; set; }
    public DateTime OrderedAt { get; set; } = DateTime.UtcNow;
    /// <summary>Copied from the checkout form, so later profile edits never rewrite where an order went.</summary>
    public string? ShippingAddress { get; set; }
    /// <summary>When and by whom (staff or manager account) the order was confirmed and handed to delivery.</summary>
    public DateTime? ConfirmedAt { get; set; }
    public int? ConfirmedBy { get; set; }
    /// <summary>When the customer confirmed receipt; seeded orders take their order date.</summary>
    public DateTime? CompletedAt { get; set; }
    public DateTime? CancelledAt { get; set; }
}

public sealed class OrderItem
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public int ProductVariantId { get; set; }
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
}
