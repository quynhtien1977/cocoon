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

    [HttpGet("products"), Authorize(Policy = "RequireManager")]
    public IActionResult List([FromQuery] ListQuery query, int? categoryId, bool? untagged) => NotImplementedYet();

    [HttpPatch("products/{id:int}/status"), Authorize(Policy = "RequireManager")]
    public IActionResult ChangeStatus(int id, ProductStatusRequest request) => NotImplementedYet();

    [HttpPut("products/{id:int}/preferences"), Authorize(Policy = "RequireManager")]
    public IActionResult SetPreferences(int id, PreferenceIdsRequest request) => NotImplementedYet();

    [HttpGet("products/{id:int}/insights"), Authorize(Policy = "RequireManager")]
    public IActionResult Insights(int id) => NotImplementedYet();
}

[Route("api/v1")]
[Authorize(Policy = "RequireManager")]
public sealed class RecommendationsController : ApiStubController
{
    [HttpGet("recommendation-plans")] public IActionResult ListPlans([FromQuery] ListQuery query) => NotImplementedYet();
    [HttpPost("recommendation-plans")] public IActionResult CreatePlan(PlanUpsertRequest request) => NotImplementedYet();
    [HttpGet("recommendation-plans/{id:int}")] public IActionResult GetPlan(int id) => NotImplementedYet();
    [HttpPut("recommendation-plans/{id:int}")]
    public IActionResult UpdatePlan(int id, PlanUpsertRequest request) => NotImplementedYet();
    [HttpDelete("recommendation-plans/{id:int}")] public IActionResult DeletePlan(int id) => NotImplementedYet();
    [HttpPost("recommendation-plans/{id:int}/activate")] public IActionResult Activate(int id) => NotImplementedYet();
    [HttpPost("recommendation-plans/{id:int}/end")] public IActionResult End(int id) => NotImplementedYet();
    [HttpPost("recommendations/rebuild")] public IActionResult Rebuild() => NotImplementedYet();
}

public sealed record ProductStatusRequest(ProductStatus Status);
public sealed record ProductVariantItem(int Id, string Name, string Sku, decimal Price, string? ImageUrl);
public sealed record ProductDetail(int Id, string Name, string Sku, string Description, string Ingredients, string Benefits, string Usage,
    int CategoryId, string CategoryName, ProductStatus Status, string? ImageUrl, IReadOnlyList<ProductVariantItem> Variants,
    double? AverageRating, int FeedbackCount, string[] Preferences, int[] PreferenceIds);
public sealed record PlanUpsertRequest(string Name, string? Goal, DateTime StartAt, DateTime EndAt,
    SegmentFilter Segment, int[] ProductIds);
