using System.ComponentModel.DataAnnotations;
using Cocoon.Domain;
using Cocoon.Domain.Entities;
using Cocoon.Domain.Enums;
using Cocoon.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Cocoon.Api.Controllers;

[Route("api/v1")]
public sealed class ProductsController(AppDbContext db) : ApiStubController
{
    [HttpGet("products/{id:int}"), Authorize(Roles = "Customer,Manager")]
    public async Task<IActionResult> Get(int id, CancellationToken cancellationToken)
    {
        var product = await db.Set<Product>().Where(p => p.Id == id)
            .Join(db.Set<Category>(), p => p.CategoryId, c => c.Id, (p, c) => new { Product = p, CategoryName = c.Name })
            .SingleOrDefaultAsync(cancellationToken);
        if (product is null) return NotFound();
        var p = product.Product;
        var variants = await db.Set<ProductVariant>().Where(v => v.ProductId == id).OrderBy(v => v.Price).ThenBy(v => v.Id)
            .Select(v => new ProductVariantItem(v.Id, v.Name, v.Sku, v.Price, v.ImageUrl)).ToListAsync(cancellationToken);
        var preferences = await db.Set<ProductPreference>().Where(x => x.ProductId == id)
            .Join(db.Set<Preference>(), x => x.PreferenceId, x => x.Id, (_, preference) => preference)
            .OrderBy(x => x.Name).Select(x => new PreferenceItem(x.Id, x.Name)).ToListAsync(cancellationToken);
        var ratings = db.Set<Feedback>().Where(f => f.ProductId == id);
        var feedbackCount = await ratings.CountAsync(cancellationToken);
        double? averageRating = feedbackCount == 0 ? null
            : Math.Round(await ratings.AverageAsync(f => f.Rating, cancellationToken), 1);
        return Ok(new ProductDetail(p.Id, p.Name, variants.FirstOrDefault()?.Sku ?? "", p.Description, p.Ingredients, p.Benefits, p.Usage,
            p.CategoryId, product.CategoryName, p.Status, variants.FirstOrDefault(v => v.ImageUrl != null)?.ImageUrl, variants,
            averageRating, feedbackCount, preferences.Select(x => x.Name).ToArray(), preferences.Select(x => x.Id).ToArray()));
    }

    /// <summary>M11. `untagged=true` keeps products without preference tags, the ones recommendations cannot match.</summary>
    [HttpGet("products"), Authorize(Policy = "RequireManager")]
    public async Task<IActionResult> List([FromQuery] ListQuery query, int? categoryId, bool? untagged, CancellationToken cancellationToken)
    {
        var products = db.Set<Product>().AsQueryable();
        if (query.Status is not null)
        {
            if (!Enum.TryParse<ProductStatus>(query.Status, true, out var status))
                return Fail(StatusCodes.Status400BadRequest, "VALIDATION_ERROR", "Trạng thái sản phẩm không hợp lệ.");
            products = products.Where(p => p.Status == status);
        }
        if (categoryId is not null) products = products.Where(p => p.CategoryId == categoryId);
        if (untagged is not null)
            products = products.Where(p => db.Set<ProductPreference>().Any(x => x.ProductId == p.Id) != untagged.Value);
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = SearchText.Normalize(query.Search);
            var sku = query.Search.Trim().ToUpperInvariant();
            products = products.Where(p => p.NameNormalized.Contains(term)
                || db.Set<ProductVariant>().Any(v => v.ProductId == p.Id && v.Sku.ToUpper().Contains(sku)));
        }
        var page = await ToPageAsync(products.OrderBy(p => p.Id)
            .Join(db.Set<Category>(), p => p.CategoryId, c => c.Id, (p, c) => new { Product = p, CategoryName = c.Name }), query, cancellationToken);

        var ids = page.Items.Select(x => x.Product.Id).ToArray();
        var variants = (await db.Set<ProductVariant>().Where(v => ids.Contains(v.ProductId)).OrderBy(v => v.Price).ThenBy(v => v.Id)
            .ToListAsync(cancellationToken)).ToLookup(v => v.ProductId);
        var preferences = (await db.Set<ProductPreference>().Where(x => ids.Contains(x.ProductId))
            .Join(db.Set<Preference>(), x => x.PreferenceId, x => x.Id, (x, preference) => new { x.ProductId, preference.Name })
            .OrderBy(x => x.Name).ToListAsync(cancellationToken)).ToLookup(x => x.ProductId, x => x.Name);
        var ratings = await db.Set<Feedback>().Where(f => ids.Contains(f.ProductId)).GroupBy(f => f.ProductId)
            .Select(g => new { ProductId = g.Key, Count = g.Count(), Average = g.Average(f => f.Rating) })
            .ToDictionaryAsync(x => x.ProductId, cancellationToken);
        return Ok(new PagedResult<ProductListItem>(page.Items.Select(x =>
        {
            var p = x.Product;
            var rating = ratings.GetValueOrDefault(p.Id);
            return new ProductListItem(p.Id, p.Name, variants[p.Id].FirstOrDefault()?.Sku ?? "", p.CategoryId, x.CategoryName, p.Status,
                preferences[p.Id].ToArray(), rating is null ? null : Math.Round(rating.Average, 1), rating?.Count ?? 0, p.Description,
                variants[p.Id].FirstOrDefault(v => v.ImageUrl != null)?.ImageUrl);
        }).ToList(), page.TotalCount, page.Page, page.PageSize));
    }

    [HttpPatch("products/{id:int}/status"), Authorize(Policy = "RequireManager")]
    public async Task<IActionResult> ChangeStatus(int id, ProductStatusRequest request, CancellationToken cancellationToken)
    {
        var updated = await db.Set<Product>().Where(p => p.Id == id)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Status, request.Status!.Value), cancellationToken);
        return updated == 1 ? NoContent() : NotFound();
    }

    /// <summary>Replaces the product's preference tags with exactly the given set.</summary>
    [HttpPut("products/{id:int}/preferences"), Authorize(Policy = "RequireManager")]
    public async Task<IActionResult> SetPreferences(int id, PreferenceIdsRequest request, CancellationToken cancellationToken)
    {
        if (request.PreferenceIds is null)
            return Fail(StatusCodes.Status400BadRequest, "VALIDATION_ERROR", "Thiếu danh sách sở thích.");
        var ids = request.PreferenceIds.Distinct().ToArray();
        if (!await db.Set<Product>().AnyAsync(p => p.Id == id, cancellationToken)) return NotFound();
        if (!await AuthController.PreferencesExist(db, ids, cancellationToken))
            return Fail(StatusCodes.Status400BadRequest, "VALIDATION_ERROR", "Có sở thích không còn tồn tại. Hãy tải lại trang.");
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await db.Set<ProductPreference>().Where(x => x.ProductId == id && !ids.Contains(x.PreferenceId)).ExecuteDeleteAsync(cancellationToken);
        var kept = await db.Set<ProductPreference>().Where(x => x.ProductId == id).Select(x => x.PreferenceId).ToListAsync(cancellationToken);
        db.AddRange(ids.Except(kept).Select(preferenceId => new ProductPreference { ProductId = id, PreferenceId = preferenceId }));
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return NoContent();
    }

    [HttpGet("products/{id:int}/insights"), Authorize(Policy = "RequireManager")]
    public async Task<IActionResult> Insights(int id, CancellationToken cancellationToken)
    {
        if (!await db.Set<Product>().AnyAsync(p => p.Id == id, cancellationToken)) return NotFound();
        var distribution = await db.Set<Feedback>().Where(f => f.ProductId == id).GroupBy(f => f.Rating)
            .OrderByDescending(g => g.Key).Select(g => new RatingCount(g.Key, g.Count())).ToListAsync(cancellationToken);
        var total = distribution.Sum(x => x.Count);
        double? average = total == 0 ? null : Math.Round((double)distribution.Sum(x => x.Rating * x.Count) / total, 1);
        return Ok(new ProductInsights(total, average, distribution));
    }
}

public sealed record ProductStatusRequest([Required, EnumDataType(typeof(ProductStatus))] ProductStatus? Status);
/// <summary>Row of M11. Matches apps/web/features/manager/products-service.ts.</summary>
public sealed record ProductListItem(int Id, string Name, string Sku, int CategoryId, string CategoryName, ProductStatus Status,
    string[] Preferences, double? AverageRating, int FeedbackCount, string Description, string? ImageUrl);
public sealed record RatingCount(int Rating, int Count);
public sealed record ProductInsights(int TotalFeedback, double? AverageRating, IReadOnlyList<RatingCount> RatingDistribution);
public sealed record ProductVariantItem(int Id, string Name, string Sku, decimal Price, string? ImageUrl);
public sealed record ProductDetail(int Id, string Name, string Sku, string Description, string Ingredients, string Benefits, string Usage,
    int CategoryId, string CategoryName, ProductStatus Status, string? ImageUrl, IReadOnlyList<ProductVariantItem> Variants,
    double? AverageRating, int FeedbackCount, string[] Preferences, int[] PreferenceIds);
