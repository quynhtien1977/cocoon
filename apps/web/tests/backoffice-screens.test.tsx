import "./dom-setup.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import type { ReactNode } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { CustomerList } from "../features/customers/components/customer-list";
import { customersFixture } from "../features/customers/customers.fixture";
import { customersToCsv } from "../features/customers/customers-csv";
import { FeedbackInbox } from "../features/feedback/components/feedback-inbox";
import { ManagerDashboard } from "../features/reports/components/manager-dashboard";
import { SurveyBuilder } from "../features/surveys/components/survey-builder";
import { SurveyList } from "../features/surveys/components/survey-list";
import { toSurveyUpsertRequest, validateSurveyDraft } from "../features/surveys/schemas";
import { surveyDraftFixture, surveysFixture } from "../features/surveys/surveys.fixture";

beforeEach(() => window.history.replaceState(null, "", "/"));
afterEach(cleanup);

// DataTable reads filters from the URL; tests seed it directly instead of driving the router.
const withParams = (search: string, node: ReactNode) => <SearchParamsContext.Provider value={new URLSearchParams(search)}>{node}</SearchParamsContext.Provider>;

test("M1 shows the five overview tiles and switches to customer report tab", async () => {
  render(<ManagerDashboard />);
  for (const label of ["Tổng khách hàng", "Khách mới 30 ngày", "Phản hồi mới", "Điểm trung bình", "Khảo sát đang mở"]) assert.ok(screen.getByText(label));
  assert.ok(screen.getByRole("table", { name: "Phản hồi theo tuần" }));
  await userEvent.setup().click(screen.getByRole("tab", { name: "Báo cáo khách hàng" }));
  assert.ok(screen.getByRole("table", { name: "Cơ cấu giới tính" }));
  assert.ok(screen.getByRole("table", { name: "Sở thích phổ biến" }));
});

test("M1 overview previews open the matching report tab", async () => {
  const user = userEvent.setup();
  render(<ManagerDashboard />);
  assert.ok(screen.getByText("Hạt cà phê thuần chay"));
  assert.equal(screen.getByRole("link", { name: "Xem tất cả (9)" }).getAttribute("href"), "/manager/feedback");
  await user.click(screen.getByRole("button", { name: "Xem phân tích" }));
  assert.equal(screen.getByRole("tab", { name: "Phân tích" }).getAttribute("aria-selected"), "true");
  assert.ok(screen.getByRole("table", { name: "Cặp sản phẩm hay mua cùng" }));
});

test("M2 renders a mobile card per row with a link name distinct from the table", () => {
  render(withParams("size=10", <CustomerList />));
  const first = customersFixture[0];
  assert.equal(screen.getByRole("link", { name: `Hồ sơ ${first.fullName}, ${first.code}` }).getAttribute("href"), `/manager/customers/${first.id}`);
  assert.ok(screen.getByLabelText("Sắp xếp"));
  assert.ok(screen.getByRole("button", { name: "Xuất file CSV" }));
});

test("customer CSV keeps diacritics and neutralises formula cells", () => {
  const csv = customersToCsv([{ ...customersFixture[0], fullName: "=HYPERLINK(\"x\")", preferences: ["Da dầu mụn", "Dưỡng ẩm"] }]);
  assert.ok(csv.startsWith("﻿\"Mã KH\""));
  const [, row] = csv.slice(1).split("\r\n");
  assert.ok(row.includes(`"'=HYPERLINK(""x"")"`));
  assert.ok(row.includes('"Da dầu mụn; Dưỡng ẩm"'));
});

test("M2 lists customers with links to M4 and filters by gender from the URL", () => {
  render(withParams("filter.gender=Nam&size=50", <CustomerList />));
  const table = screen.getByRole("table", { name: /Khách hàng/ });
  const expected = customersFixture.filter((row) => row.gender === "Nam");
  assert.equal(within(table).getAllByRole("row").length - 1, expected.length);
  const link = screen.getByRole("link", { name: `Xem hồ sơ ${expected[0].fullName}` });
  assert.equal(link.getAttribute("href"), `/manager/customers/${expected[0].id}`);
  assert.equal(screen.getByRole("link", { name: "Thêm khách hàng" }).getAttribute("href"), "/manager/customers/new");
});

test("M5 filters low ratings and links each row to M6", async () => {
  const feedback = (id: number, rating: number) => ({ id, customerName: `Khách ${id}`, customerCode: `KH-${id}`, orderCode: null, productName: "Gel bí đao", categoryName: "Làm sạch", rating, content: "Nội dung", status: "New", assigneeId: null, assigneeName: null, verifiedPurchase: false, createdAt: "2026-10-20T03:00:00Z" });
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ items: [feedback(41, 2), feedback(40, 5)], totalCount: 2, page: 1, pageSize: 100 }), { headers: { "content-type": "application/json" } })) as typeof fetch;
  try {
    render(withParams("feedback.filter.rating=low&feedback.size=50", <FeedbackInbox />));
    const table = await screen.findByRole("table", { name: /Phản hồi/ });
    assert.equal(within(table).getAllByRole("row").length - 1, 1);
    assert.equal(screen.getByRole("link", { name: "Xử lý phản hồi #41" }).getAttribute("href"), "/manager/feedback/41");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("M8 validation reports missing title, question text and product for NewProduct", async () => {
  const user = userEvent.setup();
  render(<SurveyBuilder />);
  await user.selectOptions(screen.getByLabelText(/Mục đích/), "NewProduct");
  await user.click(screen.getByRole("button", { name: "Lưu bản nháp" }));
  assert.ok(screen.getByText("Nhập tên khảo sát."));
  assert.ok(screen.getByText("Nhập nội dung câu hỏi."));
  assert.ok(screen.getByText("Chọn sản phẩm sắp ra mắt cho khảo sát sản phẩm mới."));
  assert.equal(screen.getByLabelText(/Tên khảo sát/).getAttribute("aria-invalid"), "true");
});

test("M8 edits questions: type change, add option, tag preference, reorder and save", async () => {
  const user = userEvent.setup();
  render(<SurveyBuilder initial={surveyDraftFixture} />);
  assert.equal(screen.getAllByRole("group").length, 4);
  const [first, , third] = screen.getAllByRole("group");
  await user.click(within(first).getByRole("button", { name: "Thêm lựa chọn" }));
  assert.equal(within(first).getAllByPlaceholderText(/Lựa chọn/).length, 5);
  await user.selectOptions(within(third).getByLabelText("Loại câu hỏi"), "SingleChoice");
  assert.equal(within(third).getAllByPlaceholderText(/Lựa chọn/).length, 2);
  await user.click(screen.getByRole("button", { name: "Đưa câu 2 lên" }));
  assert.equal((screen.getAllByLabelText("Nội dung câu hỏi")[0] as HTMLInputElement).value, surveyDraftFixture.questions[1].text);
  await user.click(screen.getByRole("button", { name: "Lưu bản nháp" }));
  assert.ok(screen.getByText(/Chưa lưu được/), "new blank options must be filled before saving");
  await user.click(within(screen.getAllByRole("group")[1]).getByRole("button", { name: "Xóa lựa chọn 5" }));
  for (const [index, input] of within(screen.getAllByRole("group")[2]).getAllByPlaceholderText(/Lựa chọn/).entries()) await user.type(input, `Mức ${index + 1}`);
  await user.selectOptions(within(screen.getAllByRole("group")[2]).getByLabelText("Gắn sở thích cho lựa chọn 1"), "6");
  await user.click(screen.getByRole("button", { name: "Lưu bản nháp" }));
  assert.ok(screen.getByText(/Đã lưu bản nháp/));
});

test("M8 collapses questions and previews the draft read-only", async () => {
  const user = userEvent.setup();
  render(<SurveyBuilder initial={surveyDraftFixture} />);
  await user.click(screen.getByRole("button", { name: "Thu gọn tất cả" }));
  assert.equal(screen.queryAllByLabelText("Nội dung câu hỏi").length, 0);
  assert.ok(screen.getByText(surveyDraftFixture.questions[0].text));
  await user.click(screen.getByRole("button", { name: "Mở rộng tất cả" }));
  assert.equal(screen.getAllByLabelText("Nội dung câu hỏi").length, 4);
  await user.click(screen.getByRole("button", { name: "Xem trước khảo sát" }));
  const dialog = await screen.findByRole("dialog");
  assert.ok(within(dialog).getByText(surveyDraftFixture.title));
  assert.equal(within(dialog).getAllByRole("radio").every((input) => (input as HTMLInputElement).disabled), true);
});

test("M7 offers actions by status and deletes a draft after confirmation", async () => {
  const user = userEvent.setup();
  render(withParams("size=50", <SurveyList />));
  const table = screen.getByRole("table", { name: /Khảo sát/ });
  const [draft] = surveysFixture.filter((row) => row.status === "Draft");
  const [closed] = surveysFixture.filter((row) => row.status === "Closed");
  const draftRow = within(table).getByText(draft.title).closest("tr")!;
  assert.equal(within(draftRow).getByRole("link", { name: `Chỉnh sửa ${draft.title}` }).getAttribute("href"), `/manager/surveys/${draft.id}/edit`);
  assert.equal(within(draftRow).queryByRole("link", { name: /Xem kết quả/ }), null);
  const closedRow = within(table).getByText(closed.title).closest("tr")!;
  assert.equal(within(closedRow).getByRole("link", { name: `Xem kết quả ${closed.title}` }).getAttribute("href"), `/manager/surveys/${closed.id}/results`);
  assert.equal(within(closedRow).queryByRole("link", { name: /Chỉnh sửa|Gửi khảo sát/ }), null);
  await user.click(within(draftRow).getByRole("button", { name: `Xóa ${draft.title}` }));
  await user.click(await screen.findByRole("button", { name: "Xóa bản nháp" }));
  assert.equal(within(table).queryByText(draft.title), null);
  assert.equal(within(table).getAllByRole("row").length - 1, surveysFixture.length - 1);
});

test("survey draft maps to SurveyUpsertRequest with API enum ordinals", () => {
  assert.deepEqual(validateSurveyDraft(surveyDraftFixture), {});
  const body = toSurveyUpsertRequest({ ...surveyDraftFixture, questions: [...surveyDraftFixture.questions, { key: "x", text: "Điểm?", type: "Rating", isRequired: true, options: [{ key: "y", text: "stale", preferenceId: null }] }] });
  assert.equal(body.purpose, 1);
  assert.equal(body.productId, 31);
  assert.equal(body.openAt, "2026-11-01T00:00:00+07:00");
  assert.equal(body.closeAt, "2026-11-15T23:59:59+07:00");
  assert.deepEqual(body.questions.map((q) => q.type), [0, 1, 2, 3, 2]);
  assert.deepEqual(body.questions[0].options[0], { text: "Da dầu", preferenceId: 1 });
  assert.deepEqual(body.questions[4].options, []);
  assert.equal(validateSurveyDraft({ ...surveyDraftFixture, closeAt: "2026-10-01" }).closeAt, "Ngày kết thúc phải sau ngày bắt đầu.");
});
