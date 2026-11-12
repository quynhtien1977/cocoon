import "./dom-setup.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import type { ReactNode } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { CustomerCreateForm } from "../features/customers/components/customer-create-form";
import { CustomerDetail, CustomerDetailPage } from "../features/customers/components/customer-detail";
import { toCreateCustomerRequest, validateCustomerDraft } from "../features/customers/schemas";
import { FeedbackInbox } from "../features/feedback/components/feedback-inbox";
import { FeedbackProcessing, FeedbackProcessingPage } from "../features/feedback/components/feedback-processing";
import { StaffFeedbackList } from "../features/feedback/components/staff-feedback-list";
import { StaffFeedbackReply } from "../features/feedback/components/staff-feedback-reply";
import type { FeedbackDetail, FeedbackListItem, FeedbackStatus } from "../features/feedback/types";
import { toReplyRequest, validateReply } from "../features/feedback/schemas";

beforeEach(() => window.history.replaceState(null, "", "/"));
afterEach(cleanup);

const withParams = (search: string, node: ReactNode) => <SearchParamsContext.Provider value={new URLSearchParams(search)}>{node}</SearchParamsContext.Provider>;
const row = (id: number, status: FeedbackStatus, assigneeId: number | null, rating = 4): FeedbackListItem => ({ id, customerName: `Khách ${id}`, customerCode: `KH-${id}`, orderCode: null, productName: "Gel bí đao", categoryName: "Làm sạch", rating, content: "Nội dung phản hồi", status, assigneeId, assigneeName: assigneeId === 3 ? "Ngô Thị Thu" : assigneeId === 4 ? "Lâm Quốc Bảo" : null, verifiedPurchase: false, createdAt: "2026-10-20T03:00:00Z" });
const rows = [row(41, "New", null, 2), row(40, "Accepted", null), row(39, "Assigned", 3), row(38, "Assigned", 4), row(37, "Replied", 3), row(36, "Closed", 4)];
const detail = (item: FeedbackListItem): FeedbackDetail => ({ ...item, customerEmail: "khach@example.com", customerPhone: null, customerOrderCount: 1, customerPreferences: [], sku: "", price: 0, orderCompletedAt: null, statusTimes: { New: item.createdAt }, replies: [], followUp: null, autoCloseAt: null });
const withStatus = (status: FeedbackStatus) => detail(rows.find((item) => item.status === status)!);
const staff = [{ id: 3, name: "Ngô Thị Thu" }, { id: 4, name: "Lâm Quốc Bảo" }];

type Respond = (url: string, init?: RequestInit) => Response;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const realFetch = globalThis.fetch;
let requests: { url: string; method: string; body: unknown }[] = [];
function stubFetch(respond: Respond) {
  requests = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    requests.push({ url, method: init?.method ?? "GET", body: init?.body ? JSON.parse(init.body as string) : undefined });
    return respond(url, init);
  }) as typeof fetch;
}
const page = (items: unknown[]) => json({ items, totalCount: items.length, page: 1, pageSize: 100 });
afterEach(() => { globalThis.fetch = realFetch; });

test("M5 status tab writes the same URL param as the status filter", async () => {
  stubFetch(() => page(rows));
  render(withParams("feedback.size=50", <FeedbackInbox />));
  await screen.findByRole("table", { name: /Phản hồi/ });
  await userEvent.setup().click(screen.getByRole("button", { name: /^Đã trả lời/ }));
  assert.equal(new URLSearchParams(window.location.search).get("feedback.filter.status"), "Replied");
  assert.ok(screen.getByLabelText("Phụ trách"));
});

test("M5 filters by assignee and flags low ratings", async () => {
  stubFetch(() => page(rows));
  render(withParams("feedback.filter.assignee=none&feedback.size=50", <FeedbackInbox />));
  const table = await screen.findByRole("table", { name: /Phản hồi/ });
  assert.equal(within(table).getAllByRole("row").length - 1, rows.filter((item) => item.assigneeName === null).length);
  assert.ok(within(table).getAllByText("Cần chú ý").length > 0);
});

test("M6 offers only the moves valid for the status and calls the API for each", async () => {
  stubFetch(() => new Response(null, { status: 204 }));
  const user = userEvent.setup();
  render(<FeedbackProcessing initial={withStatus("New")} staff={staff} />);
  assert.equal(screen.queryByRole("button", { name: "Đóng phản hồi" }), null);
  assert.equal(screen.queryByLabelText("Nhân viên phụ trách"), null);
  await user.click(screen.getByRole("button", { name: "Tiếp nhận" }));
  await user.click(await screen.findByRole("button", { name: "Xác nhận tiếp nhận" }));
  assert.ok(await screen.findByText(/Đã tiếp nhận phản hồi/));
  await screen.findByLabelText("Nhân viên phụ trách");
  await user.selectOptions(screen.getByLabelText("Nhân viên phụ trách"), "4");
  await user.click(screen.getByRole("button", { name: "Giao việc" }));
  await user.click(await screen.findByRole("button", { name: "Xác nhận giao" }));
  assert.ok(await screen.findByText(/Đã giao phản hồi cho Lâm Quốc Bảo/));
  assert.deepEqual(requests.map(({ url, method, body }) => [method, url, body]), [["POST", "/api/v1/feedback/41/accept", undefined], ["POST", "/api/v1/feedback/41/assign", { staffId: 4 }]]);
  assert.equal(screen.queryByRole("button", { name: "Đóng phản hồi" }), null, "assigned feedback cannot be closed");
  assert.ok(screen.getByRole("button", { name: "Giao lại" }));
});

test("M6 keeps the dialog open with the API message when the status already changed", async () => {
  stubFetch(() => json({ detail: "Trạng thái phản hồi đã thay đổi. Hãy tải lại trang.", code: "INVALID_FEEDBACK_STATUS" }, 409));
  const user = userEvent.setup();
  render(<FeedbackProcessing initial={withStatus("New")} staff={staff} />);
  await user.click(screen.getByRole("button", { name: "Tiếp nhận" }));
  await user.click(await screen.findByRole("button", { name: "Xác nhận tiếp nhận" }));
  assert.match((await within(screen.getByRole("alertdialog")).findByRole("alert")).textContent ?? "", /đã thay đổi/);
  assert.equal(screen.queryByText(/^Đã tiếp nhận phản hồi/), null);
});

test("M6 explains when there is no staff to assign", () => {
  render(<FeedbackProcessing initial={withStatus("Accepted")} staff={[]} />);
  assert.equal(screen.queryByLabelText("Nhân viên phụ trách"), null);
  assert.ok(screen.getByText(/chưa có nhân viên đang hoạt động/));
});

test("M6 page shows not found for a 404 and retries after a failure", async () => {
  stubFetch(() => json({}, 404));
  const { unmount } = render(<FeedbackProcessingPage id={999} />);
  assert.ok(await screen.findByText("Không tìm thấy phản hồi"));
  unmount();
  stubFetch(() => json({}, 500));
  render(<FeedbackProcessingPage id={41} />);
  await screen.findByText("Chưa tải được phản hồi");
  stubFetch((url) => url.endsWith("/staff") ? json(staff) : json(withStatus("New")));
  await userEvent.setup().click(screen.getByRole("button", { name: "Thử lại" }));
  assert.ok(await screen.findByRole("heading", { name: "Xử lý phản hồi #41" }));
});

test("M6 closes replied feedback after confirmation and then offers no moves", async () => {
  stubFetch(() => new Response(null, { status: 204 }));
  const user = userEvent.setup();
  render(<FeedbackProcessing initial={withStatus("Replied")} staff={staff} />);
  await user.click(screen.getByRole("button", { name: "Đóng phản hồi" }));
  await user.click(await screen.findByRole("button", { name: "Hủy" }));
  assert.ok(screen.getByRole("button", { name: "Đóng phản hồi" }), "cancel keeps it open");
  await user.click(screen.getByRole("button", { name: "Đóng phản hồi" }));
  await user.click(await screen.findByRole("button", { name: "Xác nhận đóng" }));
  assert.ok(await screen.findByText(/Đã đóng phản hồi/));
  assert.equal(screen.queryByRole("region", { name: "Thao tác điều phối" }), null);
  assert.deepEqual(requests.map(({ url }) => url), ["/api/v1/feedback/37/close"]);
});

test("M6 displays auto-close deadline and updates days when Replied", async () => {
  stubFetch((url, init) => {
    if (init?.method === "PUT" && url.endsWith("/auto-close")) {
      return json({ autoCloseAt: "2026-11-25T10:00:00Z" });
    }
    return new Response(null, { status: 204 });
  });
  const user = userEvent.setup();
  const initial = {
    ...withStatus("Replied"),
    autoCloseAt: "2026-11-18T10:00:00Z",
    followUp: null,
  };
  render(<FeedbackProcessing initial={initial} staff={staff} />);
  assert.ok(screen.getByLabelText("Đổi thời hạn đóng"));
  assert.ok(screen.getByText(/Thời hạn đóng dự kiến/));
  const input = screen.getByLabelText("Đổi thời hạn đóng");
  await user.clear(input);
  await user.type(input, "14");
  await user.click(screen.getByRole("button", { name: "Cập nhật" }));
  assert.ok(await screen.findByText(/Đã cập nhật thời hạn đóng dự kiến/));
  assert.deepEqual(requests.filter((r) => r.method === "PUT"), [
    { url: "/api/v1/feedback/37/auto-close", method: "PUT", body: { days: 14 } },
  ]);
});

test("M6 reports error when updating auto-close fails and keeps the input", async () => {
  stubFetch(() => json({ detail: "Trạng thái phản hồi đã thay đổi. Hãy tải lại trang." }, 409));
  const user = userEvent.setup();
  const initial = {
    ...withStatus("Replied"),
    autoCloseAt: "2026-11-18T10:00:00Z",
    followUp: null,
  };
  render(<FeedbackProcessing initial={initial} staff={staff} />);
  const input = screen.getByLabelText("Đổi thời hạn đóng");
  await user.clear(input);
  await user.type(input, "10");
  await user.click(screen.getByRole("button", { name: "Cập nhật" }));
  assert.ok(await screen.findByRole("alert"));
  assert.ok(screen.getByText("Trạng thái phản hồi đã thay đổi. Hãy tải lại trang."));
  assert.equal(screen.queryByText(/Đã cập nhật thời hạn đóng dự kiến/), null);
});

test("M6 displays correct closing label in history according to closedBy", () => {
  const base = {
    ...withStatus("Closed"),
    statusTimes: { ...withStatus("Closed").statusTimes, Closed: "2026-11-05T10:00:00Z" },
    replies: [
      { id: 1, staffName: "Lan", content: "Lần 1", createdAt: "2026-10-21T09:00:00Z", round: 1 },
      { id: 2, staffName: "Lan", content: "Lần 2", createdAt: "2026-10-22T10:00:00Z", round: 2 },
    ],
  };

  const { unmount: u1 } = render(<FeedbackProcessing initial={{ ...base, closedBy: "SecondReply" }} staff={staff} />);
  assert.ok(screen.getByText("Đóng sau câu trả lời lần 2"));
  u1();

  const { unmount: u2 } = render(<FeedbackProcessing initial={{ ...base, closedBy: "AutoClose" }} staff={staff} />);
  assert.ok(screen.getByText("Tự đóng khi hết hạn"));
  u2();

  render(<FeedbackProcessing initial={{ ...base, closedBy: "Manager" }} staff={staff} />);
  assert.ok(screen.getByText("Quản lý đóng phản hồi"));
});

test("S1 lists what the staff endpoint returns and links to S2", async () => {
  const mine = rows.filter((item) => item.assigneeId === 3);
  stubFetch(() => page(mine));
  render(withParams("size=50", <StaffFeedbackList />));
  assert.equal(within(await screen.findByRole("table", { name: /Phản hồi được giao/ })).getAllByRole("row").length - 1, mine.length);
  assert.match(requests[0].url, /^\/api\/v1\/staff\/feedback\?/);
  const waiting = mine.find((item) => item.status === "Assigned")!;
  assert.equal(screen.getByRole("link", { name: `Xử lý phản hồi #${waiting.id}` }).getAttribute("href"), `/staff/feedback/${waiting.id}`);
});

test("S2 validates the reply, sends it and hides the composer", async () => {
  stubFetch(() => json({ id: 9, staffName: "Ngô Thị Thu", content: "Cocoon đã ghi nhận góp ý của bạn.", createdAt: "2026-10-31T03:00:00Z" }, 201));
  const user = userEvent.setup();
  render(<StaffFeedbackReply initial={withStatus("Assigned")} />);
  await user.click(screen.getByRole("button", { name: "Gửi trả lời" }));
  assert.ok(screen.getByText("Nhập câu trả lời từ 10 ký tự."));
  assert.equal(screen.getByLabelText(/Câu trả lời/).getAttribute("aria-invalid"), "true");
  await user.type(screen.getByLabelText(/Câu trả lời/), "Cocoon đã ghi nhận góp ý của bạn.");
  await user.click(screen.getByRole("button", { name: "Gửi trả lời" }));
  assert.ok(await screen.findByText(/Đã gửi câu trả lời/));
  assert.ok(screen.getByText("Cocoon đã ghi nhận góp ý của bạn."));
  assert.deepEqual(requests[0].body, { content: "Cocoon đã ghi nhận góp ý của bạn." });
  assert.equal(screen.queryByRole("button", { name: "Gửi trả lời" }), null);
});

test("S2 keeps the draft and shows the API message when sending fails", async () => {
  stubFetch(() => json({ detail: "Trạng thái phản hồi đã thay đổi. Hãy tải lại trang." }, 409));
  const user = userEvent.setup();
  render(<StaffFeedbackReply initial={withStatus("Assigned")} />);
  await user.type(screen.getByLabelText(/Câu trả lời/), "Nội dung đủ dài để gửi.");
  await user.click(screen.getByRole("button", { name: "Gửi trả lời" }));
  assert.ok(await screen.findByText(/đã thay đổi/));
  assert.equal((screen.getByLabelText(/Câu trả lời/) as HTMLTextAreaElement).value, "Nội dung đủ dài để gửi.");
});

test("S2 displays follow-up and reply round 2 closes feedback", async () => {
  stubFetch(() => json({ id: 10, staffName: "Ngô Thị Thu", content: "Cocoon đã giải đáp thắc mắc bổ sung.", createdAt: "2026-11-01T03:00:00Z", round: 2 }, 201));
  const user = userEvent.setup();
  const initial = {
    ...withStatus("Assigned"),
    followUp: { content: "Khách hỏi thêm về hạn sử dụng.", createdAt: "2026-10-31T10:00:00Z" },
    replies: [{ id: 9, staffName: "Ngô Thị Thu", content: "Lần 1", createdAt: "2026-10-31T03:00:00Z", round: 1 }],
  };
  render(<StaffFeedbackReply initial={initial} />);
  assert.ok(screen.getAllByText("Khách hỏi thêm về hạn sử dụng.").length >= 1);
  assert.ok(screen.getByText(/Khách hàng gửi thêm ý kiến phản hồi/));
  await user.type(screen.getByLabelText(/Câu trả lời/), "Cocoon đã giải đáp thắc mắc bổ sung.");
  await user.click(screen.getByRole("button", { name: "Gửi trả lời" }));
  assert.ok(await screen.findByText(/Đã gửi câu trả lời đến khách hàng thành công! Hoàn tất phản hồi/));
  assert.equal(screen.queryByRole("button", { name: "Gửi trả lời" }), null);
});

test("reply validation and request trim the content", () => {
  assert.equal(validateReply("   ngắn   "), "Nhập câu trả lời từ 10 ký tự.");
  assert.equal(validateReply("x".repeat(501)), "Câu trả lời tối đa 500 ký tự.");
  assert.equal(validateReply("Nội dung đủ dài."), null);
  assert.deepEqual(toReplyRequest("  Nội dung đủ dài.  "), { content: "Nội dung đủ dài." });
});


test("M3 reports invalid fields and posts the customer without preferences", async () => {
  const user = userEvent.setup();
  stubFetch(() => json({ id: 120, email: "ha@example.com", role: "Customer", temporaryPassword: "Tam!1234", mustChangePassword: true }, 201));
  render(<CustomerCreateForm />);
  await user.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
  assert.ok(screen.getByText("Nhập họ và tên."));
  assert.ok(screen.getByText("Số điện thoại gồm 10 chữ số, bắt đầu bằng 0."));
  await user.type(screen.getByLabelText(/Họ và tên/), "Nguyễn Thu Hà");
  await user.type(screen.getByLabelText(/^Email/), "ha@example.com");
  await user.type(screen.getByLabelText(/Số điện thoại/), "0912 345 678");

  assert.equal(screen.queryByText(/Sở thích và nhu cầu ban đầu/), null);

  await user.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
  assert.ok(await screen.findByText(/Đã lưu hồ sơ Nguyễn Thu Hà/));
  assert.ok(screen.getByText("Tam!1234"));
  const post = requests.find((request) => request.method === "POST")!;
  assert.equal(post.url, "/api/v1/customers");
  assert.deepEqual((post.body as { preferenceIds: number[] }).preferenceIds, []);
  assert.equal(requests.some((request) => request.url.endsWith("/preferences")), false);
});

test("M3 shows the API conflict on the email field", async () => {
  const user = userEvent.setup();

  stubFetch(() => json({ status: 409, code: "EMAIL_TAKEN", detail: "Email này đã được dùng." }, 409));
  render(<CustomerCreateForm />);
  await user.type(screen.getByLabelText(/Họ và tên/), "Nguyễn Thu Hà");
  await user.type(screen.getByLabelText(/^Email/), "ha@example.com");
  await user.type(screen.getByLabelText(/Số điện thoại/), "0912 345 678");
  await user.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
  assert.ok(await screen.findByText("Email này đã được dùng."));
  assert.equal(screen.getByLabelText(/^Email/).getAttribute("aria-invalid"), "true");
});

test("customer draft maps to CreateCustomerRequest and rejects a future birth date", () => {
  const draft = { fullName: " Hà ", email: " ha@example.com ", phone: "0912 345 678", dateOfBirth: "", gender: "", address: "  ", preferences: [3] };
  assert.deepEqual(toCreateCustomerRequest(draft), { email: "ha@example.com", fullName: "Hà", phone: "0912345678", dateOfBirth: null, gender: null, address: null, preferenceIds: [3] });
  assert.deepEqual(validateCustomerDraft(draft, "2026-10-30"), {});
  assert.equal(validateCustomerDraft({ ...draft, dateOfBirth: "2026-10-31" }, "2026-10-30").dateOfBirth, "Ngày sinh không thể ở tương lai.");
});

const profile = { id: 9, code: "KH-0009", fullName: "Trúc Nguyễn", email: "truc@example.com", phone: null, age: 26, gender: "Nữ", preferences: ["Da khô"], orderCount: 2, lastOrderAt: "2026-10-20T03:00:00Z", joinedAt: "2025-01-10T02:00:00Z", status: "Active" as const, address: null, dateOfBirth: null, totalSpent: 390000 };
const orders = [{ id: 1, code: "CO-1", placedAt: "2026-10-20T03:00:00Z", itemCount: 1, total: 195000, status: "Completed" }, { id: 2, code: "CO-2", placedAt: "2026-09-20T03:00:00Z", itemCount: 1, total: 195000, status: "Completed" }];

test("M4 loads the profile and tabs from the API, locks and soft-deletes", async () => {
  const user = userEvent.setup();
  stubFetch((url, init) => init?.method && init.method !== "GET" ? new Response(null, { status: 204 })
    : url.includes("/orders") ? page(orders) : url.includes("/feedback") || url.includes("/surveys") ? page([])
    : url.endsWith("/recommendations") ? json([{ id: 3, productName: "Gel bí đao", score: 0.67, status: "Clicked", reasons: [{ code: "PREFERENCE", label: "Hợp với sở thích Da dầu" }, { code: "CATEGORY", label: "Bạn hay chọn Làm sạch" }] }])
    : json(profile));
  render(<CustomerDetailPage id={9} />);
  await user.click(await screen.findByRole("tab", { name: "Đơn hàng (2)" }));
  assert.equal(within(screen.getByRole("table")).getAllByRole("row").length - 1, 2);
  await user.click(screen.getByRole("tab", { name: "Gợi ý" }));
  assert.ok(screen.getByText("Hợp với sở thích Da dầu · Bạn hay chọn Làm sạch"));
  assert.ok(screen.getByText("Đã bấm xem"));
  await user.click(screen.getByRole("button", { name: "Khóa tài khoản" }));
  await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Khóa tài khoản" }));
  assert.ok(await screen.findByRole("button", { name: "Mở khóa" }));
  await user.click(screen.getByRole("button", { name: "Xóa khách hàng" }));
  await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Xóa khách hàng" }));
  assert.ok(await screen.findByRole("heading", { name: "Đã xóa khách hàng" }));
  assert.deepEqual(requests.filter((request) => request.method !== "GET").map((request) => `${request.method} ${request.url}`),
    ["POST /api/v1/customers/9/lock", "DELETE /api/v1/customers/9"]);
});

test("M4 keeps the account unlocked when the lock call fails", async () => {
  const user = userEvent.setup();
  stubFetch(() => json({ status: 409, detail: "Không thể khóa tài khoản này." }, 409));
  render(<CustomerDetail initial={{ ...profile, orders: [], feedback: [], surveys: [], recommendations: [] }} />);
  await user.click(screen.getByRole("button", { name: "Khóa tài khoản" }));
  const dialog = await screen.findByRole("alertdialog");
  await user.click(within(dialog).getByRole("button", { name: "Khóa tài khoản" }));
  assert.ok(await within(dialog).findByText("Không thể khóa tài khoản này."));
  assert.equal(screen.queryByRole("button", { name: "Mở khóa", hidden: true }), null);
});
