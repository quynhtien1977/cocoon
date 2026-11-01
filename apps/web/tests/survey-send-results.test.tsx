import "./dom-setup.mjs";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { emptySegmentFilter } from "../components/data/segment-filter-builder";
import { SurveyResults } from "../features/surveys/components/survey-results";
import { SurveySend } from "../features/surveys/components/survey-send";
import { matchesSegment, surveyResultsToCsv, toRecipientsRequest } from "../features/surveys/schemas";
import { surveyCandidatesFixture, surveyDraftByIdFixture, surveyResultsFixture, surveysFixture } from "../features/surveys/surveys.fixture";
import type { SurveyStatus } from "../features/surveys/types";

afterEach(cleanup);

const withStatus = (status: SurveyStatus) => surveysFixture.find((row) => row.status === status)!;
const candidate = surveyCandidatesFixture[0];

test("segment matching applies each rule from the API contract", () => {
  const filter = emptySegmentFilter();
  assert.equal(surveyCandidatesFixture.every((row) => matchesSegment(row, filter)), true);
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

test("M9 narrows the segment, shows at most 5 samples and sends after confirmation", async () => {
  const user = userEvent.setup();
  render(<SurveySend survey={withStatus("Draft")} />);
  assert.ok(screen.getByText(`Hiển thị 5 / ${surveyCandidatesFixture.length} người nhận`));
  await user.click(screen.getByRole("button", { name: "Nam" }));
  const men = surveyCandidatesFixture.filter((row) => row.gender === "Nam").length;
  assert.ok(screen.getByText(`Hiển thị 5 / ${men} người nhận`));
  await user.click(screen.getByRole("button", { name: "Xem lại và gửi khảo sát" }));
  const dialog = await screen.findByRole("alertdialog");
  await user.click(within(dialog).getByRole("button", { name: "Gửi khảo sát" }));
  assert.ok(await screen.findByText(new RegExp(`Đã gửi cho ${men} khách hàng`)));
});

test("M9 reports an invalid age range and an empty manual selection instead of sending", async () => {
  const user = userEvent.setup();
  render(<SurveySend survey={withStatus("Open")} />);
  await user.type(screen.getByLabelText("Từ"), "40");
  await user.type(screen.getByLabelText("Đến"), "20");
  await user.click(screen.getByRole("button", { name: "Xem lại và gửi khảo sát" }));
  assert.match(screen.getByRole("alert").textContent ?? "", /khoảng tuổi không hợp lệ/);
  await user.click(screen.getByRole("tab", { name: "Chọn thủ công" }));
  await user.click(screen.getByRole("button", { name: "Xem lại và gửi khảo sát" }));
  assert.match(screen.getByRole("alert").textContent ?? "", /chưa chọn khách nào/);
  await user.click(screen.getByRole("checkbox", { name: /Trúc Nguyễn/ }));
  assert.ok(screen.getByText("Đã chọn 1 khách"));
  assert.equal(screen.queryByRole("alert"), null);
});

test("M9 does not offer sending for a closed survey", () => {
  render(<SurveySend survey={withStatus("Closed")} />);
  assert.ok(screen.getByText("Khảo sát đã đóng"));
  assert.equal(screen.queryByRole("button", { name: "Xem lại và gửi khảo sát" }), null);
});

test("M10 shows completion rate and each question type", () => {
  const survey = surveysFixture.find((row) => row.id === 81)!;
  render(<SurveyResults survey={survey} results={surveyResultsFixture(81)} />);
  assert.ok(screen.getByText("19/28 khách"));
  assert.ok(screen.getByText("10 lượt (52,6%)"));
  assert.ok(screen.getByText("4,6"));
  assert.ok(screen.getByText(/túi refill/));
});

test("M10 tells a draft has no results yet and links to sending", () => {
  const draft = withStatus("Draft");
  render(<SurveyResults survey={draft} results={[]} />);
  assert.ok(screen.getByText("Chưa có kết quả"));
  assert.equal(screen.getByRole("link", { name: "Gửi khảo sát" }).getAttribute("href"), `/manager/surveys/${draft.id}/send`);
});

test("fixtures stay consistent: every sent survey has results for all questions, every draft is editable", () => {
  for (const row of surveysFixture) {
    if (row.status === "Draft") assert.equal(surveyDraftByIdFixture(row.id)?.questions.length, row.questionCount);
    else assert.equal(surveyResultsFixture(row.id).length, row.questionCount);
  }
  assert.equal(surveyDraftByIdFixture(81), null);
});

test("results CSV neutralizes spreadsheet formulas and starts with a BOM", () => {
  const csv = surveyResultsToCsv([{ kind: "ShortText", text: "Góp ý", answerCount: 1, answers: [{ customerName: "=A", content: 'có "ngoặc"' }] }]);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.match(csv, /"'=A"/);
  assert.match(csv, /"có ""ngoặc"""/);
});
