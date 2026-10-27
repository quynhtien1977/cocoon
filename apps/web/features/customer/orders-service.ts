import { apiRequest } from "../../lib/api/client";

export type OrderItem = { id: number; name: string; variant: string; imageUrl: string | null; productSlug?: string; quantity: number; unitPrice: number; review: { id: number; rating: number } | null };
export type CustomerOrder = { id: number; code: string; orderedAt: string; status: "Completed" | "Cancelled" | "Returned"; totalAmount: number; items: OrderItem[] };
export type OrderFilter = "all" | "delivered" | "reviewed" | "unreviewed";

// The backend currently exposes stub endpoints without response DTOs. Keep the
// proposed enriched response contract isolated here; never infer review status.
export function parseOrders(response: unknown): { items: CustomerOrder[]; totalCount: number } {
  const page = response as { items?: unknown; totalCount?: unknown } | null;
  const rows = Array.isArray(response) ? response : page?.items;
  if (!Array.isArray(rows)) throw new Error("Định dạng đơn hàng chưa được hỗ trợ.");
  const items = rows.map((raw): CustomerOrder => {
    const order = raw as CustomerOrder;
    const status = typeof order?.status === "number" ? (["Completed", "Cancelled", "Returned"] as const)[order.status] : order?.status;
    if (!order || !Number.isSafeInteger(order.id) || order.id <= 0 || typeof order.code !== "string" || !Number.isFinite(Date.parse(order.orderedAt)) || !["Completed", "Cancelled", "Returned"].includes(status) || !Number.isFinite(order.totalAmount) || order.totalAmount < 0 || !Array.isArray(order.items)) throw new Error("Thông tin đơn hàng chưa đầy đủ.");
    for (const item of order.items) {
      if (!item || !Number.isSafeInteger(item.id) || item.id <= 0 || typeof item.name !== "string" || typeof item.variant !== "string" || !(item.imageUrl === null || typeof item.imageUrl === "string") || !Number.isInteger(item.quantity) || item.quantity < 1 || !Number.isFinite(item.unitPrice) || item.unitPrice < 0 || !(item.review === null || (item.review && Number.isSafeInteger(item.review.id) && item.review.id > 0 && Number.isInteger(item.review.rating) && item.review.rating >= 1 && item.review.rating <= 5))) throw new Error("Thông tin sản phẩm hoặc đánh giá chưa đầy đủ.");
    }
    return { ...order, status };
  });
  const totalCount = Array.isArray(response) ? items.length : page?.totalCount;
  if (!Number.isSafeInteger(totalCount) || (totalCount as number) < items.length) throw new Error("Thông tin phân trang đơn hàng chưa đầy đủ.");
  return { items, totalCount: totalCount as number };
}

export async function loadOrders(signal: AbortSignal): Promise<CustomerOrder[]> {
  const orders: CustomerOrder[] = [];
  for (let page = 1; page <= 100; page++) {
    const result = parseOrders(await apiRequest<unknown>(`/me/orders?page=${page}&pageSize=20`, { signal, refresh: false }));
    if (result.items.some((order) => orders.some((previous) => previous.id === order.id))) throw new Error("Không thể tải đầy đủ danh sách đơn hàng.");
    orders.push(...result.items);
    if (orders.length >= result.totalCount) return orders;
    if (!result.items.length) break;
  }
  throw new Error("Không thể tải đầy đủ danh sách đơn hàng. Vui lòng thử lại sau.");
}

export function filterOrders(orders: CustomerOrder[], filter: OrderFilter, search = "") {
  const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replaceAll("đ", "d");
  const query = normalize(search.trim());
  return orders.flatMap((order) => {
    if (filter !== "all" && order.status !== "Completed") return [];
    const items = order.items.filter((item) => (filter === "reviewed" ? item.review !== null : filter === "unreviewed" ? item.review === null : true) && (!query || normalize(order.code).includes(query) || normalize(item.name).includes(query)));
    return items.length ? [{ ...order, items, originalItemCount: order.items.length }] : [];
  });
}
