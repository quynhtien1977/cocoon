using Cocoon.Application.Shop;
using Cocoon.Infrastructure.Shop;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Cocoon.Api.Controllers;

/// <summary>
/// Public catalog (decision 14/11/2026): products on sale with their variants and prices for the landing page, the
/// customer catalog (C2) and "Mua ngay". Read-only and the same for every caller, signed in or not; placing an order
/// stays Customer-only on POST /me/orders.
/// </summary>
[Route("api/v1/shop")]
[AllowAnonymous]
public sealed class ShopController(ShopService shop) : ApiStubController
{
    [HttpGet("products"), ProducesResponseType<ShopPage<ShopProduct>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Products([FromQuery] ShopQuery query, CancellationToken cancellationToken) =>
        Ok(await shop.ProductsAsync(query, cancellationToken));

    [HttpGet("categories"), ProducesResponseType<List<ShopCategory>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Categories(CancellationToken cancellationToken) =>
        Ok(await shop.CategoriesAsync(cancellationToken));
}
