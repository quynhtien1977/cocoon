import "./dom-setup.mjs";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { ContextType } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { CustomerNotifications } from "../features/customer/customer-notifications";

const originalFetch = globalThis.fetch;
afterEach(() => { cleanup(); globalThis.fetch = originalFetch; });
const item = { id: 10, type: "FeedbackReplied", title: "Cocoon đã trả lời đánh giá", refType: "Feedback", refId: 12, isRead: false, createdAt: "2026-10-27T09:00:00Z" };
function mount(push: (href: string) => void = () => {}) {
  const router = { push, prefetch: async () => {}, replace() {}, back() {}, forward() {}, refresh() {}, hmrRefresh() {} } as unknown as NonNullable<ContextType<typeof AppRouterContext>>;
  return render(<AppRouterContext.Provider value={router}><CustomerNotifications /></AppRouterContext.Provider>);
}

test("new feedback produces one toast; read action updates badge and navigates", async () => {
  let rows: typeof item[] = [];
  const writes: string[] = [], destinations: string[] = [];
  globalThis.fetch = async (url, options) => {
    if (options?.method === "POST") { writes.push(String(url)); return new Response(null, { status: 204 }); }
    return Response.json(rows);
  };
  mount(href => destinations.push(href));
  fireEvent.click(screen.getByRole("button", { name: "Thông báo" }));
  await screen.findByText("Bạn chưa có thông báo nào.");
  rows = [item];
  fireEvent.focus(window);
  await screen.findByText("Bạn có phản hồi mới từ Cocoon");
  fireEvent.focus(window);
  await waitFor(() => assert.equal(screen.getAllByText("Bạn có phản hồi mới từ Cocoon").length, 1));
  fireEvent.click(screen.getByRole("button", { name: "Xem phản hồi" }));
  await waitFor(() => assert.deepEqual(destinations, ["/account/feedback/12"]));
  assert.deepEqual(writes, ["/api/v1/me/notifications/10/read"]);
  assert.ok(screen.getByRole("button", { name: "Thông báo" }));
});

test("old unread notifications do not toast; a failed mark-read preserves unread state", async () => {
  globalThis.fetch = async (_url, options) => options?.method === "POST" ? Response.json({}, { status: 501 }) : Response.json([item]);
  const destinations: string[] = [];
  mount(href => destinations.push(href));
  const trigger = await screen.findByRole("button", { name: "Thông báo, 1 chưa đọc" });
  assert.equal(screen.queryByText("Bạn có phản hồi mới từ Cocoon"), null);
  fireEvent.click(trigger);
  fireEvent.click(await screen.findByRole("button", { name: /Cocoon đã trả lời đánh giá/ }));
  await screen.findByText("Chưa thể đánh dấu đã đọc. Vui lòng thử lại.");
  assert.deepEqual(destinations, []);
  assert.ok(screen.getByRole("button", { name: "Thông báo, 1 chưa đọc" }));
});

test("unavailable notifications show an error rather than an empty list", async () => {
  globalThis.fetch = async () => Response.json({}, { status: 501 });
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Thông báo" }));
  await screen.findByRole("alert");
  assert.equal(screen.queryByText("Bạn chưa có thông báo nào."), null);
});
