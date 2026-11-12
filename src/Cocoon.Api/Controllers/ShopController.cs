using Cocoon.Application.Shop;
using Cocoon.Infrastructure.Shop;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Cocoon.Api.Controllers;

/// <summary>Customer catalog (C2): products on sale with their variants and prices, for "Mua ngay".</summary>
[Route("api/v1/shop")]
[Authorize(Policy = "RequireCustomer")]
public sealed class ShopController(ShopService shop) : ApiStubController
{
    [HttpGet("products"), ProducesResponseType<ShopPage<ShopProduct>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Products([FromQuery] ShopQuery query, CancellationToken cancellationToken) =>
        Ok(await shop.ProductsAsync(query, cancellationToken));

    [HttpGet("categories"), ProducesResponseType<List<ShopCategory>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Categories(CancellationToken cancellationToken) =>
        Ok(await shop.CategoriesAsync(cancellationToken));
}
