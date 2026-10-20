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
}

public sealed class OrderItem
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public int ProductVariantId { get; set; }
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
}
