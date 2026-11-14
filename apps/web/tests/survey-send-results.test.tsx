import "./dom-setup.mjs";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { emptySegmentFilter, matchesSegment, type SegmentCustomer } from "../components/data/segment-filter-builder";
import { SurveyResults, SurveyResultsPage } from "../features/surveys/components/survey-results";
import { SurveySend, SurveySendPage } from "../features/surveys/components/survey-send";
import { surveyResultsToCsv, toRecipientsRequest } from "../features/surveys/schemas";
import type { QuestionResult, RecipientCustomer, SurveyInfo, SurveyStatus } from "../features/surveys/types";

afterEach(cleanup);

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
const sends = () => requests.filter((request) => request.url.startsWith("/api/v1/surveys/")).map(({ method, url, body }) => [method, url, body]);
afterEach(() => { globalThis.fetch = realFetch; });

const survey = (status: SurveyStatus): SurveyInfo => ({ id: 83, title: "Nghiên cứu mặt nạ nghệ", purpose: "NewProduct", status, openAt: null, closeAt: "2026-11-15T16:59:59Z", recipientCount: 0, responseCount: 0 });
const customer = (id: number, fullName: string, gender: string | null): RecipientCustomer => ({ id, code: `KH-${String(id).padStart(4, "0")}`, fullName, email: `khach${id}@example.com`, age: 26, gender });
const customers = [customer(108, "Trúc Nguyễn", "Nữ"), customer(109, "Lê Minh Quân", "Nam"), customer(110, "Trần Tuấn Anh", "Nam")];
const preferences = [{ id: 1, name: "Da dầu mụn" }, { id: 6, name: "Dưỡng ẩm" }];
const categories = [{ id: 1, name: "Làm sạch" }, { id: 4, name: "Dưỡng da" }];
const sendProps = { preferences, categories, customers };

/** POST segments/preview: 12 customers, 3 of them men. */
const preview = (init?: RequestInit) => {
  const men = (JSON.parse(init?.body as string) as { genders: string[] }).genders.includes("Nam");
  return json({ count: men ? 3 : 12, sample: men ? customers.slice(1) : customers });
};

test("segment matching applies each rule from the API contract", () => {
  const candidate: SegmentCustomer = { ...customer(108, "Trúc Nguyễn", "Nữ"), preferenceIds: [1], purchasedCategoryIds: [1], lowRatedCategoryIds: [], daysSinceLastOrder: 12 };
  const filter = emptySegmentFilter();
  assert.equal(matchesSegment(candidate, filter), true);
  assert.equal(matchesSegment({ ...candidate, age: null }, { ...filter, ageMin: 18 }), false);
  assert.equal(matchesSegment({ ...candidate, gender: "Nam" }, { ...filter, genders: ["Nữ"] }), false);
  assert.equal(matchesSegment({ ...candidate, preferenceIds: [1, 2] }, { ...filter, preferenceIds: [2, 7] }), true);
  assert.equal(matchesSegment({ ...candidate, daysSinceLastOrder: null }, { ...filter, lastPurchaseWithinDays: 90 }), false);
  assert.equal(matchesSegment({ ...candidate, lowRatedCategoryIds: [3] }, { ...filter, excludeLowRatedCategoryIds: [3] }), false);
});

test("recipients request carries either a segment or customer ids", () => {
  const segment = emptySegmentFilter();
  assert.deepEqual(toRecipientsRequest({ segment }), { segment, customerIds: null });
  assert.deepEqual(toRecipientsRequest({ customerIds: [108] }), { segment: null, customerIds: [108] });
});

test("M9 counts the segment with the API, publishes a draft and sends the segment", async () => {
  stubFetch((url, init) => url.endsWith("/segments/preview") ? preview(init) : url.endsWith("/recipients") ? json({ added: 3, total: 3 }) : new Response(null, { status: 204 }));
  const user = userEvent.setup();
  render(<SurveySend survey={survey("Draft")} {...sendProps} />);
  assert.ok(await screen.findByText("Hiển thị 3 / 12 người nhận"));
  await user.click(screen.getByRole("button", { name: "Nam" }));
  assert.ok(await screen.findByText("Hiển thị 2 / 3 người nhận"));
  assert.ok(screen.getAllByText("Lê Minh Quân").length > 0);
  await user.click(screen.getByRole("button", { name: "Gửi khảo sát" }));
  const dialog = await screen.findByRole("alertdialog");
  assert.match(dialog.textContent ?? "", /gửi cho 3 khách hàng/);
  await user.click(within(dialog).getByRole("button", { name: "Gửi khảo sát" }));
  assert.ok(await screen.findByText(/Đã gửi cho 3 khách hàng/));
  assert.deepEqual(requests.filter((request) => request.url.endsWith("/segments/preview")).at(-1)?.body, { ...emptySegmentFilter(), genders: ["Nam"] }, "the last preview carries the filter");
  assert.deepEqual(sends(), [
    ["POST", "/api/v1/surveys/83/publish", undefined],
    ["POST", "/api/v1/surveys/83/recipients", { segment: { ...emptySegmentFilter(), genders: ["Nam"] }, customerIds: null }],
  ]);
});

test("M9 reports an invalid age range and an empty manual selection, then sends picked customers", async () => {
  stubFetch((url, init) => url.endsWith("/segments/preview") ? preview(init) : json({ added: 1, total: 21 }));
  const user = userEvent.setup();
  render(<SurveySend survey={survey("Open")} {...sendProps} />);
  await user.type(screen.getByLabelText("Từ"), "40");
  await user.type(screen.getByLabelText("Đến"), "20");
  await user.click(screen.getByRole("button", { name: "Gửi khảo sát" }));
  assert.match(screen.getByRole("alert").textContent ?? "", /khoảng tuổi không hợp lệ/);
  await user.click(screen.getByRole("tab", { name: "Chọn thủ công" }));
  await user.click(screen.getByRole("button", { name: "Gửi khảo sát" }));
  assert.match(screen.getByRole("alert").textContent ?? "", /chưa chọn khách nào/);
  await user.click(screen.getByRole("checkbox", { name: /Trúc Nguyễn/ }));
  assert.ok(screen.getByText("Đã chọn 1 khách"));
  assert.equal(screen.queryByRole("alert"), null);
  await user.click(screen.getByRole("button", { name: "Gửi khảo sát" }));
  await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Gửi khảo sát" }));
  assert.ok(await screen.findByText(/Đã gửi cho 1 khách hàng. Khảo sát hiện có 21 người nhận/));
  assert.deepEqual(sends(), [["POST", "/api/v1/surveys/83/recipients", { segment: null, customerIds: [108] }]]);
});

test("M9 keeps the dialog open with the API message when the survey is no longer open", async () => {
  stubFetch((url, init) => url.endsWith("/segments/preview") ? preview(init) : json({ detail: "Khảo sát không ở trạng thái đang mở.", code: "SURVEY_NOT_OPEN" }, 409));
  const user = userEvent.setup();
  render(<SurveySend survey={survey("Open")} {...sendProps} />);
  await screen.findByText("Hiển thị 3 / 12 người nhận");
  await user.click(screen.getByRole("button", { name: "Gửi khảo sát" }));
  await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Gửi khảo sát" }));
  assert.match((await within(screen.getByRole("alertdialog")).findByRole("alert")).textContent ?? "", /không ở trạng thái đang mở/);
  assert.equal(screen.queryByText(/Đã gửi cho/), null);
});

test("M9 route loads the survey and offers only active customers for manual selection", async () => {
  stubFetch((url, init) => url.endsWith("/segments/preview") ? preview(init)
    : url.startsWith("/api/v1/customers") ? page([{ ...customers[0], status: "Active" }, { ...customers[1], status: "Locked" }])
    : url === "/api/v1/surveys/83" ? json({ ...survey("Open"), description: null, productId: null, createdAt: "2026-10-20T03:00:00Z", questions: [] })
    : json(url.endsWith("/categories") ? categories : preferences));
  const user = userEvent.setup();
  render(<SurveySendPage id={83} />);
  assert.equal((await screen.findAllByRole("button", { name: "Dưỡng da" })).length, 2, "segment categories come from GET categories");
  await user.click(screen.getByRole("tab", { name: "Chọn thủ công" }));
  assert.ok(screen.getByRole("checkbox", { name: /Trúc Nguyễn/ }));
  assert.equal(screen.queryByRole("checkbox", { name: /Lê Minh Quân/ }), null);
});

test("M9 does not offer sending for a closed survey", () => {
  stubFetch((url, init) => preview(init));
  render(<SurveySend survey={survey("Closed")} {...sendProps} />);
  assert.ok(screen.getByText("Khảo sát đã đóng"));
  assert.equal(screen.queryByRole("button", { name: "Gửi khảo sát" }), null);
});

const results: QuestionResult[] = [
  { questionId: 1, kind: "SingleChoice", text: "Loại da hiện tại của bạn là gì?", answerCount: 19, options: [{ id: 11, text: "Da dầu", count: 6 }, { id: 12, text: "Da hỗn hợp thiên dầu", count: 10 }, { id: 13, text: "Da khô", count: 3 }] },
  { questionId: 2, kind: "Rating", text: "Đánh giá cảm giác sau khi rửa mặt", answerCount: 19, average: 4.6, distribution: { 5: 13, 4: 5, 3: 1, 2: 0, 1: 0 } },
  { questionId: 3, kind: "Rating", text: "Chưa ai chấm", answerCount: 0, distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } },
  { questionId: 4, kind: "ShortText", text: "Góp ý bao bì", answerCount: 2, answers: [{ customerName: "Khách đã xóa", content: "Mong có túi refill." }, { customerName: "Khách đã xóa", content: "Chai lớn hơn." }] },
];

test("M10 route loads the survey and its results, then shows completion rate and each question type", async () => {
  stubFetch((url) => url.endsWith("/results")
    ? json({ surveyId: 81, title: "Hài lòng gel bí đao", status: "Open", recipientCount: 28, responseCount: 19, completionRate: 0.6786, questions: results })
    : json({ ...survey("Open"), id: 81, title: "Hài lòng gel bí đao", description: null, productId: null, createdAt: "2026-10-20T03:00:00Z", questions: [] }));
  render(<SurveyResultsPage id={81} />);
  assert.ok(await screen.findByText("19/28 khách"));
  assert.ok(screen.getByText("10 lượt (52,6%)"));
  assert.ok(screen.getByText("4,6"));
  assert.ok(screen.getByText("—"), "a rating nobody answered has no average");
  assert.ok(screen.getByText(/túi refill/));
  assert.ok(screen.getByText(/Chai lớn hơn/), "answers by the same name are all listed");
  assert.deepEqual(requests.map((request) => request.url).sort(), ["/api/v1/surveys/81", "/api/v1/surveys/81/results"]);
});

test("M10 route offers a retry when results fail to load", async () => {
  stubFetch(() => json({}, 500));
  render(<SurveyResultsPage id={81} />);
  assert.match((await screen.findByRole("alert")).textContent ?? "", /Chưa tải được kết quả khảo sát/);
  assert.ok(screen.getByRole("button", { name: "Thử lại" }));
});

test("M10 tells a draft has no results yet and links to sending", () => {
  render(<SurveyResults survey={survey("Draft")} results={[]} />);
  assert.ok(screen.getByText("Chưa có kết quả"));
  assert.equal(screen.getByRole("link", { name: "Gửi khảo sát" }).getAttribute("href"), "/manager/surveys/83/send");
});

test("results CSV neutralizes spreadsheet formulas and starts with a BOM", () => {
  const csv = surveyResultsToCsv([{ questionId: 1, kind: "ShortText", text: "Góp ý", answerCount: 1, answers: [{ customerName: "=A", content: 'có "ngoặc"' }] }]);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.match(csv, /"'=A"/);
  assert.match(csv, /"có ""ngoặc"""/);
});
