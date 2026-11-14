namespace Cocoon.Domain;

/// <summary>How a variant's photos are shown, shared by the shop catalog and the product detail.</summary>
public static class ProductPhotos
{
    /// <summary>Detail gallery: the main photo first, then the extra photos in order, without blanks or repeats.</summary>
    public static IReadOnlyList<string> Gallery(string? main, IEnumerable<string> extras) =>
        new[] { main }.Concat(extras).OfType<string>().Where(url => url.Length > 0).Distinct().ToArray();

    /// <summary>
    /// Card hover photo: Cocoon's own hover photo, else the second gallery photo, like the original storefront; null when
    /// the variant has only one photo, so the card keeps its main photo instead of fading to the same picture.
    /// </summary>
    public static string? Hover(string? main, string? hover, IReadOnlyList<string> gallery) =>
        !string.IsNullOrEmpty(hover) && hover != main ? hover : gallery.FirstOrDefault(url => url != main);
}
