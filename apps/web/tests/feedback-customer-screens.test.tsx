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
import { FeedbackProcessing } from "../features/feedback/components/feedback-processing";
import { StaffFeedbackList } from "../features/feedback/components/staff-feedback-list";
import { StaffFeedbackReply } from "../features/feedback/components/staff-feedback-reply";
import { currentStaffFixture, feedbackDetailFixture, feedbackFixture } from "../features/feedback/feedback.fixture";
import { toReplyRequest, validateReply } from "../features/feedback/schemas";
import { ScoreBreakdown } from "../features/recommendations/score-breakdown";

beforeEach(() => window.history.replaceState(null, "", "/"));
afterEach(cleanup);

const withParams = (search: string, node: ReactNode) => <SearchParamsContext.Provider value={new URLSearchParams(search)}>{node}</SearchParamsContext.Provider>;
const withStatus = (status: string) => feedbackDetailFixture(feedbackFixture.find((row) => row.status === status)!.id)!;

test("M5 status tab writes the same URL param as the status filter", async () => {
  render(withParams("feedback.size=50", <FeedbackInbox />));
  await userEvent.setup().click(screen.getByRole("button", { name: /^Đã trả lời/ }));
  assert.equal(new URLSearchParams(window.location.search).get("feedback.filter.status"), "Replied");
  assert.ok(screen.getByLabelText("Phụ trách"));
});

test("M5 filters by assignee and flags low ratings", () => {
  render(withParams("feedback.filter.assignee=none&feedback.size=50", <FeedbackInbox />));
  const table = screen.getByRole("table", { name: /Phản hồi/ });
  assert.equal(within(table).getAllByRole("row").length - 1, feedbackFixture.filter((row) => row.assigneeName === null).length);
  assert.ok(within(table).getAllByText("Cần chú ý").length > 0);
});

test("M6 offers only the moves valid for the status and walks the workflow", async () => {
  const user = userEvent.setup();
  render(<FeedbackProcessing initial={withStatus("New")} />);
  assert.equal(screen.queryByRole("button", { name: "Đóng phản hồi" }), null);
  assert.equal(screen.queryByLabelText("Nhân viên phụ trách"), null);
  await user.click(screen.getByRole("button", { name: "Tiếp nhận" }));
  await user.click(await screen.findByRole("button", { name: "Xác nhận tiếp nhận" }));
  assert.ok(screen.getByText(/Đã tiếp nhận phản hồi/));
  await user.selectOptions(screen.getByLabelText("Nhân viên phụ trách"), "12");
  await user.click(screen.getByRole("button", { name: "Giao việc" }));
  await user.click(await screen.findByRole("button", { name: "Xác nhận giao" }));
  assert.ok(screen.getByText(/Đã giao phản hồi cho Lâm Quốc Bảo/));
  assert.equal(screen.queryByRole("button", { name: "Đóng phản hồi" }), null, "assigned feedback cannot be closed");
  assert.ok(screen.getByRole("button", { name: "Giao lại" }));
});

test("M6 closes replied feedback after confirmation and then offers no moves", async () => {
  const user = userEvent.setup();
  render(<FeedbackProcessing initial={withStatus("Replied")} />);
  await user.click(screen.getByRole("button", { name: "Đóng phản hồi" }));
  await user.click(await screen.findByRole("button", { name: "Hủy" }));
  assert.ok(screen.getByRole("button", { name: "Đóng phản hồi" }), "cancel keeps it open");
  await user.click(screen.getByRole("button", { name: "Đóng phản hồi" }));
  await user.click(await screen.findByRole("button", { name: "Xác nhận đóng" }));
  assert.equal(screen.queryByRole("region", { name: "Thao tác điều phối" }), null);
  assert.ok(screen.getByText(/Đã đóng phản hồi/));
});

test("S1 lists only feedback assigned to the signed-in staff and links to S2", () => {
  render(withParams("size=50", <StaffFeedbackList />));
  const mine = feedbackFixture.filter((row) => row.assigneeName === currentStaffFixture.name);
  assert.equal(within(screen.getByRole("table", { name: /Phản hồi được giao/ })).getAllByRole("row").length - 1, mine.length);
  const waiting = mine.find((row) => row.status === "Assigned")!;
  assert.equal(screen.getByRole("link", { name: `Xử lý phản hồi #${waiting.id}` }).getAttribute("href"), `/staff/feedback/${waiting.id}`);
});

test("S2 validates the reply, sends it and hides the composer", async () => {
  const user = userEvent.setup();
  const mine = feedbackFixture.find((row) => row.assigneeName === currentStaffFixture.name && row.status === "Assigned")!;
  render(<StaffFeedbackReply initial={feedbackDetailFixture(mine.id)!} />);
  await user.click(screen.getByRole("button", { name: "Gửi trả lời" }));
  assert.ok(screen.getByText("Nhập câu trả lời từ 10 ký tự."));
  assert.equal(screen.getByLabelText(/Câu trả lời/).getAttribute("aria-invalid"), "true");
  await user.type(screen.getByLabelText(/Câu trả lời/), "Cocoon đã ghi nhận góp ý của bạn.");
  await user.click(screen.getByRole("button", { name: "Gửi trả lời" }));
  assert.ok(screen.getByText(/Đã gửi câu trả lời/));
  assert.ok(screen.getByText("Cocoon đã ghi nhận góp ý của bạn."));
  assert.equal(screen.queryByRole("button", { name: "Gửi trả lời" }), null);
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
