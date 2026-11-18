using Cocoon.Application.Shop;
using Cocoon.Infrastructure.Shop;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Cocoon.Api.Controllers;

/// <summary>Back-office order queue: staff and managers confirm website orders and hand them to delivery.</summary>
[Route("api/v1/orders")]
[Authorize(Roles = "Manager,Staff")]
public sealed class OrdersController(ShopService shop) : ApiStubController
{
    [HttpGet, ProducesResponseType<ShopPage<OrderRow>>(StatusCodes.Status200OK)]
    public Task<IActionResult> List([FromQuery] OrderQuery query, CancellationToken cancellationToken) =>
        ShopResult(async () => Ok(await shop.OrdersAsync(query, cancellationToken)));

    [HttpGet("{id:int}"), ProducesResponseType<OrderDetail>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(int id, CancellationToken cancellationToken) =>
        await shop.OrderAsync(id, cancellationToken) is { } order ? Ok(order) : NotFound();

    [HttpPost("{id:int}/confirm")]
    public Task<IActionResult> Confirm(int id, CancellationToken cancellationToken) =>
        ShopResult(async () => { await shop.ConfirmAsync(AccountId, id, cancellationToken); return NoContent(); });
}
