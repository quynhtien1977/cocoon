using Cocoon.Domain;
using Cocoon.Domain.Entities;
using Cocoon.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Cocoon.Infrastructure.Shop;

/// <summary>Photo lookups shared by the shop catalog, the product detail and customer recommendations.</summary>
public static class ProductPhotoQueries
{
    /// <summary>Extra gallery photos per variant id, in display order.</summary>
    public static async Task<ILookup<int, string>> ExtraPhotosAsync(this AppDbContext db, int[] variantIds, CancellationToken ct) =>
        (await db.Set<ProductVariantImage>().Where(i => variantIds.Contains(i.ProductVariantId))
            .OrderBy(i => i.ProductVariantId).ThenBy(i => i.SortOrder).Select(i => new { i.ProductVariantId, i.Url }).ToListAsync(ct))
        .ToLookup(i => i.ProductVariantId, i => i.Url);

    /// <summary>Card hover photo of one variant (<see cref="ProductPhotos.Hover"/>), given the extra photos loaded above.</summary>
    public static string? HoverOf(ProductVariant variant, ILookup<int, string> extras) =>
        ProductPhotos.Hover(variant.ImageUrl, variant.HoverImageUrl, ProductPhotos.Gallery(variant.ImageUrl, extras[variant.Id]));
}
