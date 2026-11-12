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

test("C5 shows follow-up form when canFollowUp is true and submits follow-up", async () => {
  const requests: { url: string; method: string; body: unknown }[] = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), method: options?.method ?? "GET", body: options?.body ? JSON.parse(String(options.body)) : undefined });
    if (String(url).endsWith("/follow-up")) {
      return new Response(null, { status: 204 });
    }
    return Response.json({
      ...detail,
      canFollowUp: true,
      autoCloseAt: "2026-11-20T10:00:00Z",
    });
  };

  render(<FeedbackDetailPage id="12" />);
  assert.ok(await screen.findByRole("region", { name: "Gửi thêm ý kiến" }));
  assert.ok(screen.getByText(/Thời hạn gửi thêm câu hỏi đến/));

  const textarea = screen.getByLabelText(/Nội dung ý kiến/);
  fireEvent.change(textarea, { target: { value: "Quá ngắn" } });
  const submitButton = screen.getByRole("button", { name: "Gửi ý kiến" });
  fireEvent.click(submitButton);
  assert.ok(screen.getByText("Nội dung ý kiến cần từ 20 đến 1.000 ký tự."));

  fireEvent.change(textarea, { target: { value: "Nội dung phản hồi bổ sung này dài trên hai mươi ký tự." } });
  fireEvent.click(submitButton);

  assert.ok(await screen.findByText(/Cocoon đã nhận được ý kiến của bạn/));
  assert.equal(screen.queryByRole("region", { name: "Gửi thêm ý kiến" }), null);
  assert.ok(screen.getByText("Nội dung phản hồi bổ sung này dài trên hai mươi ký tự."));
  assert.deepEqual(requests.filter(r => r.method === "POST"), [
    { url: "/api/v1/me/feedback/12/follow-up", method: "POST", body: { content: "Nội dung phản hồi bổ sung này dài trên hai mươi ký tự." } }
  ]);
});

test("C5 displays thread with follow-up and round 2 reply in chronological order", async () => {
  globalThis.fetch = async () => Response.json({
    ...detail,
    status: "Closed",
    canFollowUp: false,
    autoCloseAt: null,
    replies: [
      { id: 1, staffName: "Lan", content: "Cảm ơn bạn đã chia sẻ.", createdAt: "2026-10-21T09:00:00Z", round: 1 },
      { id: 2, staffName: "Lan", content: "Cocoon đã tiếp nhận và xử lý xong cho bạn.", createdAt: "2026-10-22T10:00:00Z", round: 2 },
    ],
    followUp: {
      content: "Mình muốn hỏi thêm về cách bảo quản sản phẩm.",
      createdAt: "2026-10-21T15:00:00Z",
    },
  });

  render(<FeedbackDetailPage id="12" />);
  assert.ok(await screen.findByText("Mình muốn hỏi thêm về cách bảo quản sản phẩm."));
  assert.ok(screen.getByText("Ý kiến bổ sung của bạn"));
  assert.ok(screen.getByText("Trả lời lần 2"));
  assert.ok(screen.getByText("Cocoon đã tiếp nhận và xử lý xong cho bạn."));
  assert.equal(screen.queryByRole("region", { name: "Gửi thêm ý kiến" }), null);
});
