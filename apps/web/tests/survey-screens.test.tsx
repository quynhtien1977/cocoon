import "./dom-setup.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import type { ReactNode } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { SurveyBuilder, SurveyBuilderPage } from "../features/surveys/components/survey-builder";
import { SurveyList } from "../features/surveys/components/survey-list";
import { fromSurveyDetail, toSurveyUpsertRequest, validateSurveyDraft } from "../features/surveys/schemas";
import type { SurveyDetail, SurveyDraft, SurveyListItem } from "../features/surveys/types";

beforeEach(() => window.history.replaceState(null, "", "/"));
afterEach(cleanup);

// DataTable reads filters from the URL; tests seed it directly instead of driving the router.
const withParams = (search: string, node: ReactNode) => <SearchParamsContext.Provider value={new URLSearchParams(search)}>{node}</SearchParamsContext.Provider>;

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
const writes = () => requests.filter((request) => request.method !== "GET").map(({ method, url, body }) => [method, url, body]);
afterEach(() => { globalThis.fetch = realFetch; });

const preferences = [{ id: 1, name: "Da dầu mụn" }, { id: 2, name: "Da nhạy cảm" }, { id: 3, name: "Da khô" }, { id: 4, name: "Da hỗn hợp" }, { id: 6, name: "Dưỡng ẩm" }];
const products = [{ id: 31, name: "Kem dưỡng ẩm hoa hồng Cao Bằng 50ml" }];

const draft: SurveyDraft = {
  title: "Khảo sát sản phẩm mới: Kem dưỡng ẩm hoa hồng",
  description: "Ghi nhận mong đợi về kết cấu và mùi hương.",
  purpose: "NewProduct",
  productId: 31,
  openAt: "2026-11-01",
  closeAt: "2026-11-15",
  questions: [
    { key: "q1", text: "Loại da hiện tại của bạn là gì?", type: "SingleChoice", isRequired: true, options: [
      { key: "q1o1", text: "Da dầu", preferenceId: 1 }, { key: "q1o2", text: "Da hỗn hợp thiên dầu", preferenceId: 4 },
      { key: "q1o3", text: "Da khô", preferenceId: 3 }, { key: "q1o4", text: "Da nhạy cảm", preferenceId: 2 },
    ] },
    { key: "q2", text: "Bạn ưu tiên công dụng nào nhất ở một loại kem dưỡng?", type: "MultiChoice", isRequired: true, options: [
      { key: "q2o1", text: "Khóa ẩm chuyên sâu", preferenceId: 6 }, { key: "q2o2", text: "Làm dịu mẩn đỏ", preferenceId: 2 },
      { key: "q2o3", text: "Thấm nhanh, không nhờn rít", preferenceId: null },
    ] },
    { key: "q3", text: "Bạn mong đợi sản phẩm kem dưỡng hoa hồng ở mức nào?", type: "Rating", isRequired: false, options: [] },
    { key: "q4", text: "Bạn muốn góp ý gì về mùi hương và bao bì?", type: "ShortText", isRequired: false, options: [] },
  ],
};

const detail = (id: number, status: SurveyDetail["status"]): SurveyDetail => ({
  id, title: draft.title, description: draft.description, purpose: "NewProduct", productId: 31, status,
  openAt: "2026-10-31T17:00:00Z", closeAt: "2026-11-15T16:59:59Z", createdAt: "2026-10-20T03:00:00Z", recipientCount: 0, responseCount: 0,
  questions: draft.questions.map((question, index) => ({ id: 10 + index, text: question.text, type: question.type, isRequired: question.isRequired,
    options: question.options.map((option, position) => ({ id: 100 + index * 10 + position, text: option.text, preferenceId: option.preferenceId })) })),
});

const listRow = (id: number, status: SurveyListItem["status"], title: string): SurveyListItem =>
  ({ id, title, purpose: "Satisfaction", status, openAt: null, closeAt: null, questionCount: 2, recipientCount: status === "Draft" ? 0 : 20, responseCount: status === "Draft" ? 0 : 10 });

test("M8 validation reports missing title, question text and product for NewProduct without calling the API", async () => {
  stubFetch(() => json({}));
  const user = userEvent.setup();
  render(<SurveyBuilder preferences={preferences} products={products} />);
  await user.selectOptions(screen.getByLabelText(/Mục đích/), "NewProduct");
  await user.click(screen.getByRole("button", { name: "Lưu bản nháp" }));
  assert.ok(screen.getByText("Nhập tên khảo sát."));
  assert.ok(screen.getByText("Nhập nội dung câu hỏi."));
  assert.ok(screen.getByText("Chọn sản phẩm sắp ra mắt cho khảo sát sản phẩm mới."));
  assert.equal(screen.getByLabelText(/Tên khảo sát/).getAttribute("aria-invalid"), "true");
  assert.equal(requests.length, 0);
});

test("M8 creates a draft with POST, then saves again with PUT to the same survey", async () => {
  stubFetch((url, init) => json(detail(90, "Draft"), init?.method === "POST" ? 201 : 200));
  const user = userEvent.setup();
  render(<SurveyBuilder preferences={preferences} products={products} />);
  await user.type(screen.getByLabelText(/Tên khảo sát/), "Khảo sát mới");
  await user.type(screen.getByLabelText("Nội dung câu hỏi"), "Bạn thích gì?");
  for (const [index, input] of screen.getAllByPlaceholderText(/Lựa chọn/).entries()) await user.type(input, `Ý ${index + 1}`);
  await user.selectOptions(screen.getByLabelText("Gắn sở thích cho lựa chọn 1"), "6");
  await user.click(screen.getByRole("button", { name: "Lưu bản nháp" }));
  assert.ok(await screen.findByText(/Đã lưu bản nháp/));
  assert.equal(screen.getByRole("link", { name: "Gửi khảo sát" }).getAttribute("href"), "/manager/surveys/90/send");
  await user.click(screen.getByRole("button", { name: "Lưu bản nháp" }));
  await screen.findByRole("button", { name: "Lưu bản nháp" });
  const [[method, url, body], second] = writes();
  assert.deepEqual([method, url], ["POST", "/api/v1/surveys"]);
  assert.deepEqual(body, { title: "Khảo sát mới", description: null, purpose: 0, productId: null, openAt: null, closeAt: null,
    questions: [{ text: "Bạn thích gì?", type: 0, isRequired: true, options: [{ text: "Ý 1", preferenceId: 6 }, { text: "Ý 2", preferenceId: null }] }] });
  assert.deepEqual(second.slice(0, 2), ["PUT", "/api/v1/surveys/90"]);
});

test("M8 edits questions of an existing draft and sends them with PUT", async () => {
  stubFetch(() => json(detail(83, "Draft")));
  const user = userEvent.setup();
  render(<SurveyBuilder initial={draft} surveyId={83} preferences={preferences} products={products} />);
  assert.equal(screen.getAllByRole("group").length, 4);
  const [first, , third] = screen.getAllByRole("group");
  await user.click(within(first).getByRole("button", { name: "Thêm lựa chọn" }));
  assert.equal(within(first).getAllByPlaceholderText(/Lựa chọn/).length, 5);
  await user.selectOptions(within(third).getByLabelText("Loại câu hỏi"), "SingleChoice");
  assert.equal(within(third).getAllByPlaceholderText(/Lựa chọn/).length, 2);
  await user.click(screen.getByRole("button", { name: "Đưa câu 2 lên" }));
  assert.equal((screen.getAllByLabelText("Nội dung câu hỏi")[0] as HTMLInputElement).value, draft.questions[1].text);
  await user.click(screen.getByRole("button", { name: "Lưu bản nháp" }));
  assert.ok(screen.getByText(/Chưa lưu được/), "new blank options must be filled before saving");
  assert.equal(requests.length, 0);
  await user.click(within(screen.getAllByRole("group")[1]).getByRole("button", { name: "Xóa lựa chọn 5" }));
  for (const [index, input] of within(screen.getAllByRole("group")[2]).getAllByPlaceholderText(/Lựa chọn/).entries()) await user.type(input, `Mức ${index + 1}`);
  await user.selectOptions(within(screen.getAllByRole("group")[2]).getByLabelText("Gắn sở thích cho lựa chọn 1"), "6");
  await user.click(screen.getByRole("button", { name: "Lưu bản nháp" }));
  assert.ok(await screen.findByText(/Đã lưu bản nháp/));
  const [[method, url, body]] = writes() as [string, string, ReturnType<typeof toSurveyUpsertRequest>][];
  assert.deepEqual([method, url], ["PUT", "/api/v1/surveys/83"]);
  assert.equal(body.productId, 31);
  assert.deepEqual(body.questions.map((question) => question.type), [1, 0, 0, 3]);
  assert.deepEqual(body.questions[2].options, [{ text: "Mức 1", preferenceId: 6 }, { text: "Mức 2", preferenceId: null }]);
});

test("M8 shows the API message when the survey is no longer a draft", async () => {
  stubFetch(() => json({ detail: "Chỉ sửa hoặc mở được khảo sát ở trạng thái nháp.", code: "SURVEY_NOT_DRAFT" }, 409));
  const user = userEvent.setup();
  render(<SurveyBuilder initial={draft} surveyId={83} preferences={preferences} products={products} />);
  await user.click(screen.getByRole("button", { name: "Lưu bản nháp" }));
  assert.match((await screen.findByRole("alert")).textContent ?? "", /Chưa lưu được: Chỉ sửa hoặc mở được/);
  assert.equal(screen.queryByText(/Đã lưu bản nháp/), null);
});

test("M8 edit route loads the draft, preferences and Upcoming products, and refuses an open survey", async () => {
  let status: SurveyDetail["status"] = "Draft";
  stubFetch((url) => url.startsWith("/api/v1/preferences") ? json(preferences) : url.startsWith("/api/v1/products") ? page(products) : json(detail(83, status)));
  render(<SurveyBuilderPage id={83} />);
  assert.equal((await screen.findByLabelText<HTMLInputElement>(/Tên khảo sát/)).value, draft.title);
  assert.equal((screen.getByLabelText<HTMLInputElement>("Ngày mở")).value, "2026-11-01");
  assert.equal((screen.getByLabelText<HTMLSelectElement>(/Sản phẩm sắp ra mắt/)).value, "31");
  assert.deepEqual(requests.map((request) => request.url).sort(), ["/api/v1/preferences", "/api/v1/products?status=Upcoming&pageSize=100", "/api/v1/surveys/83"]);
  cleanup();
  status = "Open";
  render(<SurveyBuilderPage id={83} />);
  assert.ok(await screen.findByText("Không sửa được khảo sát"));
});

test("M8 collapses questions and previews the draft read-only", async () => {
  const user = userEvent.setup();
  render(<SurveyBuilder initial={draft} preferences={preferences} products={products} />);
  await user.click(screen.getByRole("button", { name: "Thu gọn tất cả" }));
  assert.equal(screen.queryAllByLabelText("Nội dung câu hỏi").length, 0);
  assert.ok(screen.getByText(draft.questions[0].text));
  await user.click(screen.getByRole("button", { name: "Mở rộng tất cả" }));
  assert.equal(screen.getAllByLabelText("Nội dung câu hỏi").length, 4);
  await user.click(screen.getByRole("button", { name: "Xem trước khảo sát" }));
  const dialog = await screen.findByRole("dialog");
  assert.ok(within(dialog).getByText(draft.title));
  assert.equal(within(dialog).getAllByRole("radio").every((input) => (input as HTMLInputElement).disabled), true);
});

test("M7 loads surveys, offers actions by status, publishes and deletes drafts through the API", async () => {
  let rows = [listRow(83, "Draft", "Nghiên cứu mặt nạ nghệ"), listRow(84, "Draft", "Nhu cầu dung tích lớn"), listRow(81, "Open", "Hài lòng gel bí đao"), listRow(75, "Closed", "Thói quen chống nắng")];
  stubFetch((url, init) => {
    const id = Number(url.match(/surveys\/(\d+)/)?.[1]);
    if (init?.method === "DELETE") rows = rows.filter((row) => row.id !== id);
    if (url.endsWith("/publish")) rows = rows.map((row) => row.id === id ? { ...row, status: "Open" } : row);
    return init?.method === "GET" ? page(rows) : new Response(null, { status: 204 });
  });
  const user = userEvent.setup();
  render(withParams("size=50", <SurveyList />));
  const table = await screen.findByRole("table", { name: /Khảo sát/ });
  const draftRow = within(table).getByText("Nghiên cứu mặt nạ nghệ").closest("tr")!;
  assert.equal(within(draftRow).getByRole("link", { name: "Chỉnh sửa Nghiên cứu mặt nạ nghệ" }).getAttribute("href"), "/manager/surveys/83/edit");
  assert.equal(within(draftRow).queryByRole("link", { name: /Xem kết quả/ }), null);
  const closedRow = within(table).getByText("Thói quen chống nắng").closest("tr")!;
  assert.equal(within(closedRow).getByRole("link", { name: "Xem kết quả Thói quen chống nắng" }).getAttribute("href"), "/manager/surveys/75/results");
  assert.equal(within(closedRow).queryByRole("link", { name: /Chỉnh sửa|Gửi khảo sát/ }), null);
  assert.equal(within(closedRow).queryByRole("button", { name: /Mở khảo sát|Đóng khảo sát/ }), null);
  assert.ok(within(within(table).getByText("Hài lòng gel bí đao").closest("tr")!).getByRole("button", { name: "Đóng khảo sát Hài lòng gel bí đao" }));

  await user.click(within(draftRow).getByRole("button", { name: "Xóa Nghiên cứu mặt nạ nghệ" }));
  await user.click(await screen.findByRole("button", { name: "Xóa bản nháp" }));
  const afterDelete = await screen.findByRole("table", { name: /Khảo sát/ });
  await user.click(await within(afterDelete).findByRole("button", { name: "Mở khảo sát Nhu cầu dung tích lớn" }));
  await user.click(await screen.findByRole("button", { name: "Mở khảo sát" }));
  const reloaded = await screen.findByRole("table", { name: /Khảo sát/ });
  assert.ok(await within(reloaded).findByRole("button", { name: "Đóng khảo sát Nhu cầu dung tích lớn" }));
  assert.equal(within(reloaded).queryByText("Nghiên cứu mặt nạ nghệ"), null);
  assert.deepEqual(writes(), [["DELETE", "/api/v1/surveys/83", undefined], ["POST", "/api/v1/surveys/84/publish", undefined]]);
});

test("M7 keeps the close dialog open with the API message on conflict", async () => {
  stubFetch((url, init) => init?.method === "GET" ? page([listRow(81, "Open", "Hài lòng gel bí đao")]) : json({ detail: "Khảo sát không ở trạng thái đang mở.", code: "SURVEY_NOT_OPEN" }, 409));
  const user = userEvent.setup();
  render(withParams("size=50", <SurveyList />));
  await user.click(within(await screen.findByRole("table", { name: /Khảo sát/ })).getByRole("button", { name: "Đóng khảo sát Hài lòng gel bí đao" }));
  await user.click(await screen.findByRole("button", { name: "Đóng khảo sát" }));
  assert.match((await within(screen.getByRole("alertdialog")).findByRole("alert")).textContent ?? "", /không ở trạng thái đang mở/);
  assert.deepEqual(writes(), [["POST", "/api/v1/surveys/81/close", undefined]]);
});

test("M7 shows a retry when the list fails to load", async () => {
  stubFetch(() => json({}, 500));
  render(withParams("size=50", <SurveyList />));
  assert.match((await screen.findByRole("alert")).textContent ?? "", /Chưa tải được danh sách khảo sát/);
  assert.ok(screen.getByRole("button", { name: "Thử lại" }));
});

test("survey draft maps to SurveyUpsertRequest with API enum ordinals and back from SurveyDetail", () => {
  assert.deepEqual(validateSurveyDraft(draft), {});
  const body = toSurveyUpsertRequest({ ...draft, questions: [...draft.questions, { key: "x", text: "Điểm?", type: "Rating", isRequired: true, options: [{ key: "y", text: "stale", preferenceId: null }] }] });
  assert.equal(body.purpose, 1);
  assert.equal(body.productId, 31);
  assert.equal(body.openAt, "2026-11-01T00:00:00+07:00");
  assert.equal(body.closeAt, "2026-11-15T23:59:59+07:00");
  assert.deepEqual(body.questions.map((q) => q.type), [0, 1, 2, 3, 2]);
  assert.deepEqual(body.questions[0].options[0], { text: "Da dầu", preferenceId: 1 });
  assert.deepEqual(body.questions[4].options, []);
  assert.equal(validateSurveyDraft({ ...draft, closeAt: "2026-10-01" }).closeAt, "Ngày kết thúc phải sau ngày bắt đầu.");
  const back = fromSurveyDetail(detail(83, "Draft"));
  assert.deepEqual([back.openAt, back.closeAt], ["2026-11-01", "2026-11-15"], "UTC instants map back to the Vietnam calendar day");
  assert.deepEqual(toSurveyUpsertRequest(back), toSurveyUpsertRequest(draft));
});
