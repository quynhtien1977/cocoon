import "./dom-setup.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import type { ReactNode } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { CustomerCreateForm } from "../features/customers/components/customer-create-form";
import { CustomerDetail } from "../features/customers/components/customer-detail";
import { customerDetailFixture, customersFixture, scoreComponentsFixture } from "../features/customers/customers.fixture";
import { toCreateCustomerRequest, validateCustomerDraft } from "../features/customers/schemas";
import { FeedbackInbox } from "../features/feedback/components/feedback-inbox";
import { FeedbackProcessing, FeedbackProcessingPage } from "../features/feedback/components/feedback-processing";
import { StaffFeedbackList } from "../features/feedback/components/staff-feedback-list";
import { StaffFeedbackReply } from "../features/feedback/components/staff-feedback-reply";
import type { FeedbackDetail, FeedbackListItem, FeedbackStatus } from "../features/feedback/types";
import { toReplyRequest, validateReply } from "../features/feedback/schemas";
import { ScoreBreakdown } from "../features/recommendations/score-breakdown";

beforeEach(() => window.history.replaceState(null, "", "/"));
afterEach(cleanup);

const withParams = (search: string, node: ReactNode) => <SearchParamsContext.Provider value={new URLSearchParams(search)}>{node}</SearchParamsContext.Provider>;
const row = (id: number, status: FeedbackStatus, assigneeId: number | null, rating = 4): FeedbackListItem => ({ id, customerName: `Khách ${id}`, customerCode: `KH-${id}`, orderCode: null, productName: "Gel bí đao", categoryName: "Làm sạch", rating, content: "Nội dung phản hồi", status, assigneeId, assigneeName: assigneeId === 3 ? "Ngô Thị Thu" : assigneeId === 4 ? "Lâm Quốc Bảo" : null, verifiedPurchase: false, createdAt: "2026-10-20T03:00:00Z" });
const rows = [row(41, "New", null, 2), row(40, "Accepted", null), row(39, "Assigned", 3), row(38, "Assigned", 4), row(37, "Replied", 3), row(36, "Closed", 4)];
const detail = (item: FeedbackListItem): FeedbackDetail => ({ ...item, customerEmail: "khach@example.com", customerPhone: null, customerOrderCount: 1, customerPreferences: [], sku: "", price: 0, orderCompletedAt: null, statusTimes: { New: item.createdAt }, replies: [] });
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

test("reply validation and request trim the content", () => {
  assert.equal(validateReply("   ngắn   "), "Nhập câu trả lời từ 10 ký tự.");
  assert.equal(validateReply("x".repeat(501)), "Câu trả lời tối đa 500 ký tự.");
  assert.equal(validateReply("Nội dung đủ dài."), null);
  assert.deepEqual(toReplyRequest("  Nội dung đủ dài.  "), { content: "Nội dung đủ dài." });
});

test("M3 reports invalid fields, toggles preferences and confirms saving", async () => {
  const user = userEvent.setup();
  render(<CustomerCreateForm />);
  await user.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
  assert.ok(screen.getByText("Nhập họ và tên."));
  assert.ok(screen.getByText("Số điện thoại gồm 10 chữ số, bắt đầu bằng 0."));
  await user.type(screen.getByLabelText(/Họ và tên/), "Nguyễn Thu Hà");
  await user.type(screen.getByLabelText(/^Email/), "ha@example.com");
  await user.type(screen.getByLabelText(/Số điện thoại/), "0912 345 678");
  const chip = screen.getByRole("button", { name: "Da khô" });
  await user.click(chip);
  assert.equal(chip.getAttribute("aria-pressed"), "true");
  assert.ok(screen.getByText("1 mục đã chọn"));
  await user.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
  assert.ok(screen.getByText(/Đã lưu hồ sơ Nguyễn Thu Hà/));
});

test("customer draft maps to CreateCustomerRequest and rejects a future birth date", () => {
  const draft = { fullName: " Hà ", email: " ha@example.com ", phone: "0912 345 678", dateOfBirth: "", gender: "", address: "  ", preferences: ["Da khô"] };
  assert.deepEqual(toCreateCustomerRequest(draft), { email: "ha@example.com", fullName: "Hà", phone: "0912345678", dateOfBirth: null, gender: null, address: null });
  assert.deepEqual(validateCustomerDraft(draft, "2026-10-30"), {});
  assert.equal(validateCustomerDraft({ ...draft, dateOfBirth: "2026-10-31" }, "2026-10-30").dateOfBirth, "Ngày sinh không thể ở tương lai.");
});

test("M4 switches tabs, locks after confirmation and soft-deletes", async () => {
  const user = userEvent.setup();
  const row = customersFixture.find((item) => item.status === "Active" && item.orderCount > 0)!;
  const customer = customerDetailFixture(row.id)!;
  render(<CustomerDetail initial={customer} scoreBreakdown={<ScoreBreakdown components={scoreComponentsFixture} productName="Gel bí đao" />} />);
  await user.click(screen.getByRole("tab", { name: new RegExp(`Đơn hàng \\(${customer.orders.length}\\)`) }));
  assert.equal(within(screen.getByRole("table")).getAllByRole("row").length - 1, customer.orders.length);
  await user.click(screen.getByRole("tab", { name: "Gợi ý" }));
  assert.ok(within(screen.getByRole("region", { name: "Gel bí đao" })).getByText("0,67"), "spec 5.7 worked example totals 0.67");
  await user.click(screen.getByRole("button", { name: "Khóa tài khoản" }));
  await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Khóa tài khoản" }));
  assert.ok(screen.getByRole("button", { name: "Mở khóa" }));
  await user.click(screen.getByRole("button", { name: "Xóa khách hàng" }));
  await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Xóa khách hàng" }));
  assert.ok(screen.getByRole("heading", { name: "Đã xóa khách hàng" }));
});
