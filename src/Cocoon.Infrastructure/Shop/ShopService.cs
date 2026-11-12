using System.Linq.Expressions;
using Cocoon.Application.Shop;
using Cocoon.Domain;
using Cocoon.Domain.Entities;
using Cocoon.Domain.Enums;
using Cocoon.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Query;

namespace Cocoon.Infrastructure.Shop;

/// <summary>
/// Website orders (decision 13/11/2026): the customer places an order, staff or a manager confirms and hands it to
/// delivery, the customer confirms receipt and may then review it. No payment, stock or shipping fee is modelled.
/// Every state change is a conditional update on the expected status, so two requests can never both win.
/// </summary>
public sealed class ShopService(AppDbContext db)
{
    public const int MaxLines = 10, MaxQuantity = 10;

    public async Task<ShopPage<ShopProduct>> ProductsAsync(ShopQuery query, CancellationToken ct)
    {
        var (page, size) = (Math.Max(1, query.Page), Math.Clamp(query.PageSize, 1, 60));
        var rows = from p in db.Set<Product>()
                   join c in db.Set<Category>() on p.CategoryId equals c.Id
                   where p.Status == ProductStatus.Active && c.IsActive && db.Set<ProductVariant>().Any(v => v.ProductId == p.Id)
                   select new { p.Id, p.Name, p.NameNormalized, p.CategoryId, CategoryName = c.Name };
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = SearchText.Normalize(query.Search);
            rows = rows.Where(x => x.NameNormalized.Contains(term));
        }
        if (query.CategoryId is { } categoryId) rows = rows.Where(x => x.CategoryId == categoryId);

        var total = await rows.CountAsync(ct);
        var products = await rows.OrderBy(x => x.Name).ThenBy(x => x.Id).Skip((page - 1) * size).Take(size).ToListAsync(ct);
        var ids = products.Select(p => p.Id).ToArray();
        var variants = (await db.Set<ProductVariant>().Where(v => ids.Contains(v.ProductId)).OrderBy(v => v.Price).ThenBy(v => v.Id)
            .Select(v => new { v.ProductId, Variant = new ShopVariant(v.Id, v.Name, v.Price, v.ImageUrl) }).ToListAsync(ct))
            .ToLookup(x => x.ProductId, x => x.Variant);
        var ratings = await db.Set<Feedback>().Where(f => ids.Contains(f.ProductId)).GroupBy(f => f.ProductId)
            .Select(g => new { g.Key, Average = g.Average(f => (double)f.Rating), Count = g.Count() }).ToDictionaryAsync(x => x.Key, ct);

        return new(products.Select(p =>
        {
            var options = variants[p.Id].ToList();
            var rating = ratings.GetValueOrDefault(p.Id);
            return new ShopProduct(p.Id, p.Name, p.CategoryId, p.CategoryName, options.Min(v => v.Price),
                options.FirstOrDefault(v => v.ImageUrl != null)?.ImageUrl, rating is null ? null : Math.Round(rating.Average, 1),
                rating?.Count ?? 0, options);
        }).ToList(), total, page, size);
    }

    /// <summary>Active categories that currently have something on sale.</summary>
    public Task<List<ShopCategory>> CategoriesAsync(CancellationToken ct) =>
        db.Set<Category>().Where(c => c.IsActive && db.Set<Product>().Any(p => p.CategoryId == c.Id && p.Status == ProductStatus.Active))
            .OrderBy(c => c.Name).Select(c => new ShopCategory(c.Id, c.Name)).ToListAsync(ct);

    /// <summary>Prices come from the database, never from the request. Every line must be a variant of a product on sale.</summary>
    public async Task<OrderPlaced> PlaceAsync(int customerId, PlaceOrderInput input, CancellationToken ct)
    {
        var lines = input.Items ?? [];
        if (lines.Count is 0 or > MaxLines) Invalid("items", $"Đơn hàng cần từ 1 đến {MaxLines} sản phẩm.");
        if (lines.Any(l => l is null || l.Quantity is < 1 or > MaxQuantity)) Invalid("items", $"Mỗi sản phẩm đặt từ 1 đến {MaxQuantity}.");
        if (lines.Select(l => l.VariantId).Distinct().Count() != lines.Count) Invalid("items", "Mỗi phân loại sản phẩm chỉ xuất hiện một lần.");
        var address = input.ShippingAddress?.Trim() ?? "";
        if (address.Length is < 5 or > 1000) Invalid("shippingAddress", "Địa chỉ nhận hàng cần từ 5 đến 1.000 ký tự.");

        var ids = lines.Select(l => l.VariantId).ToArray();
        var prices = await (from v in db.Set<ProductVariant>()
                            join p in db.Set<Product>() on v.ProductId equals p.Id
                            where ids.Contains(v.Id) && p.Status == ProductStatus.Active
                            select new { v.Id, v.Price }).ToDictionaryAsync(x => x.Id, x => x.Price, ct);
        if (prices.Count != ids.Length)
            throw new ShopException(409, "PRODUCT_UNAVAILABLE", "Có sản phẩm đã ngừng bán hoặc không còn tồn tại. Hãy tải lại trang.");

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var order = new Order
        {
            // The final code uses the generated id; a unique placeholder satisfies the unique index until then.
            Code = $"TMP-{Guid.NewGuid():N}"[..20], CustomerId = customerId, Channel = OrderChannel.Website, Status = OrderStatus.Placed,
            OrderedAt = DateTime.UtcNow, ShippingAddress = address, TotalAmount = lines.Sum(l => prices[l.VariantId] * l.Quantity)
        };
        db.Add(order);
        await db.SaveChangesAsync(ct);
        order.Code = $"CO-W-{order.Id:000000}";
        db.AddRange(lines.Select(l => new OrderItem { OrderId = order.Id, ProductVariantId = l.VariantId, Quantity = l.Quantity, UnitPrice = prices[l.VariantId] }));
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return new OrderPlaced(order.Id, order.Code, order.TotalAmount);
    }

    /// <summary>The customer may cancel only while the shop has not confirmed the order.</summary>
    public Task CancelAsync(int customerId, int id, CancellationToken ct) =>
        MoveAsync(o => o.Id == id && o.CustomerId == customerId, OrderStatus.Placed,
            s => s.SetProperty(o => o.Status, OrderStatus.Cancelled).SetProperty(o => o.CancelledAt, DateTime.UtcNow), ct);

    /// <summary>"Đã nhận hàng": completes a delivered order, which makes its lines reviewable.</summary>
    public Task ReceiveAsync(int customerId, int id, CancellationToken ct) =>
        MoveAsync(o => o.Id == id && o.CustomerId == customerId, OrderStatus.Delivering,
            s => s.SetProperty(o => o.Status, OrderStatus.Completed).SetProperty(o => o.CompletedAt, DateTime.UtcNow), ct);

    /// <summary>Staff or a manager confirms the order and hands it to delivery; the customer is notified in the app.</summary>
    public async Task ConfirmAsync(int actorId, int id, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var now = DateTime.UtcNow;
        await MoveAsync(o => o.Id == id, OrderStatus.Placed, s => s.SetProperty(o => o.Status, OrderStatus.Delivering)
            .SetProperty(o => o.ConfirmedAt, now).SetProperty(o => o.ConfirmedBy, actorId), ct);
        var order = await db.Set<Order>().Where(o => o.Id == id).Select(o => new { o.CustomerId, o.Code }).SingleAsync(ct);
        db.Add(new Notification
        {
            AccountId = order.CustomerId, Type = "order", Title = $"Đơn hàng {order.Code} đang được giao", RefType = nameof(Order), RefId = id, CreatedAt = now
        });
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
    }

    public async Task<ShopPage<OrderRow>> OrdersAsync(OrderQuery query, CancellationToken ct)
    {
        var rows = from o in db.Set<Order>()
                   join c in db.Set<CustomerProfile>().IgnoreQueryFilters() on o.CustomerId equals c.AccountId
                   select new { O = o, c.FullName, c.FullNameNormalized };
        if (query.Status is not null)
        {
            if (!Enum.TryParse<OrderStatus>(query.Status, true, out var status) || !Enum.IsDefined(status))
                Invalid("status", "Trạng thái đơn hàng không hợp lệ.");
            rows = rows.Where(x => x.O.Status == status);
        }
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var (code, term) = (query.Search.Trim().ToUpperInvariant(), SearchText.Normalize(query.Search));
            rows = rows.Where(x => x.O.Code.Contains(code) || x.FullNameNormalized.Contains(term));
        }
        var (page, size) = (Math.Max(1, query.Page), Math.Clamp(query.PageSize, 1, 100));
        var total = await rows.CountAsync(ct);
        var items = await rows.OrderByDescending(x => x.O.OrderedAt).ThenByDescending(x => x.O.Id).Skip((page - 1) * size).Take(size)
            .Select(x => new OrderRow(x.O.Id, x.O.Code, x.O.CustomerId, x.FullName, x.O.Channel, x.O.Status, x.O.OrderedAt,
                db.Set<OrderItem>().Count(i => i.OrderId == x.O.Id), x.O.TotalAmount)).ToListAsync(ct);
        return new(items, total, page, size);
    }

    public async Task<OrderDetail?> OrderAsync(int id, CancellationToken ct)
    {
        var row = await (from x in db.Set<Order>()
                         join c in db.Set<CustomerProfile>().IgnoreQueryFilters() on x.CustomerId equals c.AccountId
                         join a in db.Set<Account>().IgnoreQueryFilters() on x.CustomerId equals a.Id
                         where x.Id == id
                         select new { O = x, Customer = new OrderCustomer(c.AccountId, c.FullName, a.Email, c.Phone) }).SingleOrDefaultAsync(ct);
        if (row is null) return null;
        var o = row.O;
        var confirmedBy = o.ConfirmedBy is null ? null : await db.Set<StaffProfile>().IgnoreQueryFilters()
            .Where(s => s.AccountId == o.ConfirmedBy).Select(s => s.FullName).SingleOrDefaultAsync(ct);
        // Lines keep products and variants deleted after the sale.
        var lines = await (from i in db.Set<OrderItem>()
                           join v in db.Set<ProductVariant>().IgnoreQueryFilters() on i.ProductVariantId equals v.Id
                           join p in db.Set<Product>().IgnoreQueryFilters() on v.ProductId equals p.Id
                           where i.OrderId == id
                           orderby i.Id
                           select new OrderLine(i.Id, p.Id, p.Name, v.Name, v.Sku, v.ImageUrl, i.Quantity, i.UnitPrice)).ToListAsync(ct);
        return new OrderDetail(o.Id, o.Code, o.Channel, o.Status, o.OrderedAt, o.TotalAmount, o.ShippingAddress, o.ConfirmedAt,
            o.ConfirmedBy is null ? null : confirmedBy ?? "", o.CompletedAt, o.CancelledAt, row.Customer, lines);
    }

    private async Task MoveAsync(Expression<Func<Order, bool>> visible, OrderStatus from,
        Action<UpdateSettersBuilder<Order>> setters, CancellationToken ct)
    {
        if (await db.Set<Order>().Where(visible).Where(o => o.Status == from).ExecuteUpdateAsync(setters, ct) == 1) return;
        var current = await db.Set<Order>().Where(visible).Select(o => (OrderStatus?)o.Status).SingleOrDefaultAsync(ct)
            ?? throw new ShopException(404, "NOT_FOUND", "Không tìm thấy đơn hàng.");
        throw new ShopException(409, "INVALID_ORDER_STATUS", current switch
        {
            OrderStatus.Delivering when from == OrderStatus.Placed => "Đơn đã được xác nhận và đang giao.",
            OrderStatus.Placed => "Cửa hàng chưa xác nhận giao đơn này.",
            OrderStatus.Completed => "Đơn hàng đã hoàn thành.",
            OrderStatus.Cancelled => "Đơn hàng đã bị hủy.",
            _ => "Trạng thái đơn hàng đã thay đổi. Hãy tải lại trang."
        });
    }

    private static void Invalid(string field, string message) => throw new ShopException(400, "VALIDATION_ERROR", message, field);
}
