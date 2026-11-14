import { apiRequest } from "@/lib/api/client";
import { loadAllPages } from "@/lib/api/pages";
import { statusMap } from "@/components/brand/status-badge";
import type { OrderStatus } from "@/features/customer/orders-service";

export type OrderChannel = "Website" | "Store" | "Marketplace";

export const orderChannelLabels: Record<OrderChannel, string> = {
  Website: "Website",
  Store: "Cửa hàng",
  Marketplace: "Sàn TMĐT",
};

export interface OrderRow {
  id: number;
  code: string;
  customerId: number;
  customerName: string;
  channel: OrderChannel;
  status: OrderStatus;
  orderedAt: string;
  itemCount: number;
  totalAmount: number;
}

export interface OrderCustomer {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
}

export interface OrderLine {
  id: number;
  productId: number;
  productName: string;
  variantName: string;
  sku: string;
  imageUrl: string | null;
  quantity: number;
  unitPrice: number;
}

export interface OrderDetail {
  id: number;
  code: string;
  channel: OrderChannel;
  status: OrderStatus;
  orderedAt: string;
  totalAmount: number;
  shippingAddress: string | null;
  confirmedAt: string | null;
  confirmedByName: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  customer: OrderCustomer;
  lines: OrderLine[];
}

export interface BackofficeOrdersQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
}

export interface BackofficeOrdersResponse {
  items: OrderRow[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export async function loadBackofficeOrders(query: BackofficeOrdersQuery = {}, signal?: AbortSignal): Promise<BackofficeOrdersResponse> {
  const params = new URLSearchParams();
  if (query.page && query.page > 0) params.set("page", String(query.page));
  if (query.pageSize && query.pageSize > 0) params.set("pageSize", String(query.pageSize));
  if (query.search?.trim()) params.set("search", query.search.trim());
  if (query.status && query.status !== "all") params.set("status", query.status.trim());
  const qs = params.toString();
  return await apiRequest<BackofficeOrdersResponse>(`/orders${qs ? `?${qs}` : ""}`, { signal });
}

export async function loadAllBackofficeOrders(signal?: AbortSignal): Promise<OrderRow[]> {
  return await loadAllPages<OrderRow>("/orders", signal);
}

export async function loadBackofficeOrderDetail(id: number, signal?: AbortSignal): Promise<OrderDetail> {
  return await apiRequest<OrderDetail>(`/orders/${id}`, { signal });
}

export async function confirmOrder(id: number): Promise<void> {
  await apiRequest<void>(`/orders/${id}/confirm`, { method: "POST" });
}

const neutralizeFormula = (value: string) => {
  const trimmedLeft = value.replace(/^\s+/, "");
  return /^[=+\-@\t\r]/.test(trimmedLeft) ? `'${value}` : value;
};

const escapeCsvCell = (value: string | number | null | undefined) => {
  const normalized = neutralizeFormula(String(value ?? ""));
  return `"${normalized.replace(/"/g, '""')}"`;
};

const isoDay = (value: string | null | undefined) => (value ? value.slice(0, 10) : "");

/** CSV with UTF-8 BOM so Excel preserves Vietnamese diacritics. */
export function ordersToCsv(rows: readonly OrderRow[]): string {
  const header = ["Mã đơn", "Mã KH", "Khách hàng", "Kênh bán", "Ngày đặt", "Số sản phẩm", "Tổng tiền (VND)", "Trạng thái"];
  const lines = rows.map((row) =>
    [
      row.code,
      `KH-${String(row.customerId).padStart(4, "0")}`,
      row.customerName,
      orderChannelLabels[row.channel] ?? row.channel,
      isoDay(row.orderedAt),
      row.itemCount,
      row.totalAmount,
      statusMap.order[row.status]?.[0] ?? row.status,
    ]
      .map(escapeCsvCell)
      .join(",")
  );
  return `\uFEFF${[header.map(escapeCsvCell).join(","), ...lines].join("\r\n")}`;
}

