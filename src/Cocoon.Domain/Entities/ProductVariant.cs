using Cocoon.Domain.Enums;

namespace Cocoon.Domain.Entities;

public sealed class ProductVariant
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Sku { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public string? ImageUrl { get; set; }
    public bool IsDeleted { get; set; }
}

