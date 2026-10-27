import { apiRequest } from "../../lib/api/client";

export type CustomerNotification = { id: number; type: string; title: string; refType: string; refId: number; isRead: boolean; createdAt: string };
const validId = (id: number) => Number.isInteger(id) && id > 0 && id <= 2147483647;

export async function loadNotifications(signal?: AbortSignal): Promise<CustomerNotification[]> {
  // Background polling must not replace the current page on a failed session check.
  const payload = await apiRequest<unknown>("/me/notifications", { signal, redirectOnUnauthorized: false });
  const rows = Array.isArray(payload) ? payload : payload && typeof payload === "object" && "items" in payload ? payload.items : null;
  if (!Array.isArray(rows)) throw new Error("Danh sách thông báo chưa hợp lệ.");
  const ids = new Set<number>();
  const items = rows.map((value): CustomerNotification => {
    const item = value as CustomerNotification;
    if (!item || !validId(item.id) || ids.has(item.id) || !validId(item.refId) || typeof item.type !== "string" || typeof item.refType !== "string" || typeof item.title !== "string" || !item.title.trim() || typeof item.isRead !== "boolean" || typeof item.createdAt !== "string" || !Number.isFinite(Date.parse(item.createdAt))) throw new Error("Danh sách thông báo chưa hợp lệ.");
    ids.add(item.id);
    return item;
  });
  return items.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function notificationHref(item: CustomerNotification): string | null {
  if (!validId(item.refId)) return null;
  switch (item.refType.toLowerCase()) {
    case "feedback": return `/account/feedback/${item.refId}`;
    case "survey": return `/account/surveys/${item.refId}`;
    case "order": return "/account/orders";
    default: return null;
  }
}

export function newFeedbackNotifications(items: CustomerNotification[], seen: Set<number> | null): CustomerNotification[] {
  if (!seen) return [];
  return items.filter(item => !item.isRead && !seen.has(item.id) && item.refType.toLowerCase() === "feedback");
}

export async function markNotificationRead(id: number, signal?: AbortSignal): Promise<void> {
  if (!validId(id)) throw new Error("Mã thông báo không hợp lệ.");
  await apiRequest<unknown>(`/me/notifications/${id}/read`, { method: "POST", signal, redirectOnUnauthorized: false });
}
