import "./dom-setup.mjs";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { SurveyStepper } from "../features/surveys/survey-stepper";
import { SurveyResponsePage } from "../features/customer/survey-response-page";
import { loadCustomerSurvey, parseCustomerSurvey, submitSurveyResponse, readSurveyDraft, writeSurveyDraft, surveyDraftKey, type CustomerSurveyDetail } from "../features/customer/survey-response-service";

const originalFetch = globalThis.fetch;
const router = { push() {}, replace() {}, back() {}, forward() {}, refresh() {}, prefetch() {}, bfcacheId: "survey-test" };
afterEach(() => { cleanup(); globalThis.fetch = originalFetch; window.localStorage.clear(); });
const survey: CustomerSurveyDetail = {
  id: 81, title: "Lắng nghe làn da", description: "Chia sẻ cùng Cocoon", status: "Open", openAt: null, closeAt: null, completedAt: null,
  questions: [
    { id: 11, text: "Loại da của bạn?", description: "Chọn một", section: "Làn da", type: "SingleChoice", isRequired: true, options: [{ id: 71, text: "Da dầu", description: "" }, { id: 72, text: "Da khô", description: "" }] },
    { id: 12, text: "Nhu cầu của bạn?", description: "Chọn nhiều", section: "Nhu cầu", type: "MultiChoice", isRequired: true, options: [{ id: 73, text: "Làm sạch", description: "" }, { id: 74, text: "Dưỡng ẩm", description: "" }] },
    { id: 13, text: "Mức độ hài lòng?", description: "", section: "Trải nghiệm", type: "Rating", isRequired: false, options: [] },
    { id: 14, text: "Góp ý thêm", description: "", section: "Lời nhắn", type: "ShortText", isRequired: false, options: [] },
  ],
};

test("customer survey detail rejects mismatched IDs and malformed question data", async () => {
  globalThis.fetch = async url => { assert.equal(String(url), "/api/v1/me/surveys/81"); return Response.json(survey); };
  assert.equal((await loadCustomerSurvey("81")).questions[0].options[0].id, 71);
  globalThis.fetch = async () => Response.json({ ...survey, id: 82 });
  await assert.rejects(loadCustomerSurvey("81"));
  assert.throws(() => parseCustomerSurvey({ ...survey, questions: [{ ...survey.questions[0], type: "Unknown" }] }));
  assert.throws(() => parseCustomerSurvey({ ...survey, questions: [survey.questions[0], survey.questions[0]] }));
  await assert.rejects(loadCustomerSurvey("../81"));
});

test("submit validates option ownership and sends actual IDs only; server failure stays a failure", async () => {
  const answers = { 11: { optionIds: [72], numericValue: null, textValue: null }, 12: { optionIds: [73, 74], numericValue: null, textValue: null } };
  let writes = 0;
  globalThis.fetch = async (url, options) => {
    writes++;
    assert.equal(String(url), "/api/v1/me/surveys/81/responses");
    assert.equal(options?.method, "POST");
    assert.deepEqual(JSON.parse(String(options?.body)), { answers: [{ questionId: 11, optionIds: [72], numericValue: null, textValue: null }, { questionId: 12, optionIds: [73, 74], numericValue: null, textValue: null }] });
    return new Response(null, { status: 204 });
  };
  await submitSurveyResponse(survey, answers);
  await assert.rejects(submitSurveyResponse(survey, { ...answers, 11: { optionIds: [73], numericValue: null, textValue: null } }));
  assert.equal(writes, 1);
  globalThis.fetch = async () => Response.json({}, { status: 501 });
  await assert.rejects(submitSurveyResponse(survey, answers), error => (error as { status: number }).status === 501);
});

test("drafts resume per account and survey; changed questions and corrupt storage cannot restore stale answers", () => {
  const key = surveyDraftKey(5, 81);
  writeSurveyDraft(window.localStorage, key, survey, { answers: { 11: { optionIds: [72], numericValue: null, textValue: null } }, step: 1, review: false });
  assert.deepEqual(readSurveyDraft(window.localStorage, key, survey)?.answers[11].optionIds, [72]);
  assert.equal(readSurveyDraft(window.localStorage, surveyDraftKey(6, 81), survey), null);
  assert.equal(readSurveyDraft(window.localStorage, key, { ...survey, questions: [{ ...survey.questions[0], text: "Câu hỏi đã thay đổi" }] }), null);
  window.localStorage.setItem(key, "broken json");
  assert.equal(readSurveyDraft(window.localStorage, key, survey), null);
});

test("stepper blocks required answers, retains selections, previews all four answer types and retries failed submit", async () => {
  const user = userEvent.setup(); let attempts = 0;
  render(<SurveyStepper survey={survey} storageKey="test-survey" onExit={() => {}} onSubmit={async () => { if (++attempts === 1) throw Error("Chưa gửi được"); }} />);
  await user.click(screen.getByRole("button", { name: /Tiếp tục/ }));
  assert.ok(screen.getByRole("alert"));
  assert.ok(screen.getByRole("heading", { name: "Loại da của bạn?" }));
  await user.click(screen.getByRole("radio", { name: "Da dầu" }));
  await user.click(screen.getByRole("button", { name: /Tiếp tục/ }));
  await user.click(screen.getByRole("checkbox", { name: "Làm sạch" }));
  await user.click(screen.getByRole("checkbox", { name: "Dưỡng ẩm" }));
  await user.click(screen.getByRole("button", { name: /Quay lại/ }));
  assert.equal((screen.getByRole("radio", { name: "Da dầu" }) as HTMLInputElement).checked, true);
  await user.click(screen.getByRole("button", { name: /Tiếp tục/ }));
  await user.click(screen.getByRole("button", { name: /Tiếp tục/ }));
  await user.click(screen.getByRole("radio", { name: "4 sao" }));
  await user.click(screen.getByRole("button", { name: /Tiếp tục/ }));
  await user.type(screen.getByRole("textbox", { name: "Góp ý thêm" }), "Mình thích kết cấu nhẹ.");
  await user.click(screen.getByRole("button", { name: /Xem lại câu trả lời/ }));
  assert.ok(screen.getByText("Làm sạch, Dưỡng ẩm"));
  assert.ok(screen.getByText("4 / 5 sao"));
  assert.ok(screen.getByText("Mình thích kết cấu nhẹ."));
  await user.click(screen.getByRole("button", { name: "Gửi khảo sát" }));
  assert.match(screen.getByRole("alert").textContent ?? "", /Chưa gửi được/);
  assert.equal(screen.queryByText("Cảm ơn bạn đã chia sẻ!"), null);
  await user.click(screen.getByRole("button", { name: "Gửi khảo sát" }));
  await screen.findByText("Cảm ơn bạn đã chia sẻ!");
  assert.equal(attempts, 2);
  assert.equal(window.localStorage.getItem("test-survey"), null);
});

test("save and exit persists incomplete work; remount restores the current question", async () => {
  let exited = false;
  const props = { survey, storageKey: "resume-survey", onExit: () => { exited = true; }, onSubmit: async () => {} };
  const view = render(<SurveyStepper {...props} />);
  fireEvent.click(screen.getByRole("radio", { name: "Da khô" }));
  fireEvent.click(screen.getByRole("button", { name: /Tiếp tục/ }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Dưỡng ẩm" }));
  fireEvent.click(screen.getByRole("button", { name: /Lưu & thoát/ }));
  assert.equal(exited, true);
  view.unmount(); render(<SurveyStepper {...props} />);
  assert.ok(screen.getByRole("heading", { name: "Nhu cầu của bạn?" }));
  assert.equal((screen.getByRole("checkbox", { name: "Dưỡng ẩm" }) as HTMLInputElement).checked, true);
  await waitFor(() => assert.ok(window.localStorage.getItem("resume-survey")));
});

test("unavailable and already-completed surveys never expose answer controls", () => {
  let writes = 0;
  const props = { storageKey: "closed", onExit: () => {}, onSubmit: async () => { writes++; } };
  const view = render(<SurveyStepper {...props} survey={{ ...survey, closeAt: "2020-01-01T00:00:00Z" }} />);
  assert.equal(screen.queryByRole("radio"), null);
  assert.equal(screen.queryByRole("button", { name: /Tiếp tục/ }), null);
  view.unmount();
  render(<SurveyStepper {...props} survey={{ ...survey, completedAt: "2026-01-01T00:00:00Z" }} />);
  assert.match(screen.getByRole("status").textContent ?? "", /đã hoàn thành/);
  assert.equal(writes, 0);
});

test("an API error does not silently become sample questions; explicit preview makes no API requests", async () => {
  globalThis.fetch = async url => String(url).endsWith("/me") ? Response.json({ id: 5, role: "Customer" }) : Response.json({}, { status: 501 });
  const view = render(<AppRouterContext.Provider value={router}><SurveyResponsePage id="81" /></AppRouterContext.Provider>);
  await screen.findByRole("alert");
  assert.equal(screen.queryByRole("radio"), null);
  assert.equal(screen.getByRole("link", { name: "Xem giao diện mẫu" }).getAttribute("href"), "/account/surveys/1?preview=1");
  view.unmount();
  globalThis.fetch = async () => { throw Error("Preview must not call API"); };
  render(<AppRouterContext.Provider value={router}><SurveyResponsePage id="1" preview /></AppRouterContext.Provider>);
  await screen.findByRole("radio", { name: /Buổi sáng và buổi tối/ });
  assert.ok(screen.getByText("Giao diện mẫu"));
});
