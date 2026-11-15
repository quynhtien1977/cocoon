namespace Cocoon.Domain.Entities;

/// <summary>Extra photos of a variant, shown after <see cref="ProductVariant.ImageUrl"/> in the detail gallery.</summary>
public sealed class ProductVariantImage
{
    public int Id { get; set; }
    public int ProductVariantId { get; set; }
    /// <summary>1, 2, 3…; position 0 is the variant's main <see cref="ProductVariant.ImageUrl"/>.</summary>
    public int SortOrder { get; set; }
    public string Url { get; set; } = string.Empty;
}
