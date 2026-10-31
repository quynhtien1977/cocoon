import "./dom-setup.mjs";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FeedbackDetailPage } from "../features/customer/feedback-detail-page";

const originalFetch = globalThis.fetch;
afterEach(() => { cleanup(); globalThis.fetch = originalFetch; });
const detail = { id: 12, rating: 4, content: "Tóc mềm hơn sau khi dùng.", status: "Replied", createdAt: "2026-10-20T09:00:00Z", orderCode: "ORDER-1", product: { name: "Dầu gội bưởi", variant: "100ml", imageUrl: null }, replies: [{ id: 1, staffName: "Lan", content: "Cảm ơn bạn đã chia sẻ.", createdAt: "2026-10-21T09:00:00Z" }] };

test("detail displays customer and staff messages and links back to reviewed orders", async () => {
  globalThis.fetch = async () => Response.json(detail);
  render(<FeedbackDetailPage id="12" />);
  assert.ok(await screen.findByText("Tóc mềm hơn sau khi dùng."));
  assert.ok(screen.getByText("Cảm ơn bạn đã chia sẻ."));
  assert.ok(screen.getByRole("region", { name: "Phản hồi của khách hàng" }));
  assert.ok(screen.getByRole("region", { name: "Phản hồi của nhân viên" }));
  assert.equal(screen.getByRole("link", { name: /Quay lại/ }).getAttribute("href"), "/account/orders?tab=reviewed");
});

test("API error has retry and never shows sample staff replies", async () => {
  globalThis.fetch = async () => Response.json({}, { status: 501 });
  render(<FeedbackDetailPage id="12" />);
  await screen.findByRole("alert");
  assert.equal(screen.queryByRole("region", { name: "Phản hồi của nhân viên" }), null);
  globalThis.fetch = async () => Response.json({ ...detail, status: "New", replies: [] });
  fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
  assert.ok(await screen.findByText(/Khi nhân viên trả lời/));
  assert.equal(screen.queryByText("Cảm ơn bạn đã chia sẻ."), null);
});

test("explicit sample detail is labeled and never fetches the customer's feedback", async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("Unexpected API"); };
  render(<FeedbackDetailPage id="2" preview />);
  await screen.findByText("Đánh giá của bạn");
  assert.ok(screen.getByText("Giao diện mẫu"));
  assert.equal(screen.getByRole("link", { name: /Quay lại/ }).getAttribute("href"), "/account/orders?tab=reviewed&preview=1");
  assert.equal(calls, 0);
});
