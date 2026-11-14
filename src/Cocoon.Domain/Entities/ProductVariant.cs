using Cocoon.Domain.Enums;

namespace Cocoon.Domain.Entities;

public sealed class ProductVariant
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Sku { get; set; } = string.Empty;
    public decimal Price { get; set; }
    /// <summary>Main photo: catalog card, first photo of the detail gallery, order lines.</summary>
    public string? ImageUrl { get; set; }
    /// <summary>Photo a product card fades to on hover (Cocoon's "back" image, usually the texture). Optional.</summary>
    public string? HoverImageUrl { get; set; }
    public bool IsDeleted { get; set; }
}
