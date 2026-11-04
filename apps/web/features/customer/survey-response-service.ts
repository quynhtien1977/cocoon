import { apiRequest } from "../../lib/api/client";
import type { QuestionType, SurveyStatus } from "../surveys/types";
import type { components } from "../../lib/api/schema";

export type SurveyQuestion = {
  id: number; text: string; description: string; section: string;
  type: QuestionType; isRequired: boolean;
  options: { id: number; text: string; description: string }[];
};
export type CustomerSurveyDetail = {
  id: number; title: string; description: string; status: SurveyStatus;
  openAt: string | null; closeAt: string | null; completedAt: string | null;
  questions: SurveyQuestion[];
};
export type SurveyAnswer = { optionIds: number[]; numericValue: number | null; textValue: string | null };
export type SurveyAnswers = Record<number, SurveyAnswer>;
export type SurveyDraftState = { answers: SurveyAnswers; step: number; review: boolean };
const questionTypes: QuestionType[] = ["SingleChoice", "MultiChoice", "Rating", "ShortText"];
const statuses: SurveyStatus[] = ["Draft", "Open", "Closed"];
const validId = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 2147483647;
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const optionalText = (value: unknown) => typeof value === "string" ? value : "";
const validDate = (value: unknown): value is string | null => value === null || typeof value === "string" && Number.isFinite(Date.parse(value));

/** GET is currently a stub without a response DTO. Keep the anticipated detail shape at this boundary. */
export function parseCustomerSurvey(payload: unknown): CustomerSurveyDetail {
  const data = record(payload);
  const status = typeof data.status === "number" ? statuses[data.status] : data.status;
  if (!validId(data.id) || typeof data.title !== "string" || !data.title.trim() || !statuses.includes(status as SurveyStatus) || !validDate(data.openAt) || !validDate(data.closeAt) || !validDate(data.completedAt) || !Array.isArray(data.questions) || data.questions.length < 1 || data.questions.length > 100) throw new Error("Thông tin khảo sát chưa hợp lệ.");
  const questionIds = new Set<number>();
  const questions = data.questions.map(raw => {
    const q = record(raw);
    const type = typeof q.type === "number" ? questionTypes[q.type] : q.type;
    if (!validId(q.id) || questionIds.has(q.id) || typeof q.text !== "string" || !q.text.trim() || !questionTypes.includes(type as QuestionType) || typeof q.isRequired !== "boolean" || !Array.isArray(q.options)) throw new Error("Câu hỏi khảo sát chưa hợp lệ.");
    questionIds.add(q.id);
    const ids = new Set<number>();
    const options = q.options.map(raw => {
      const option = record(raw);
      if (!validId(option.id) || ids.has(option.id) || typeof option.text !== "string" || !option.text.trim()) throw new Error("Lựa chọn khảo sát chưa hợp lệ.");
      ids.add(option.id); return { id: option.id, text: option.text, description: optionalText(option.description) };
    });
    if ((type === "SingleChoice" || type === "MultiChoice") && (options.length < 2 || options.length > 30)) throw new Error("Câu chọn lựa chưa có đủ lựa chọn.");
    return { id: q.id, text: q.text, description: optionalText(q.description), section: optionalText(q.section), type: type as QuestionType, isRequired: q.isRequired, options };
  });
  return { id: data.id, title: data.title, description: optionalText(data.description), status: status as SurveyStatus, openAt: data.openAt, closeAt: data.closeAt, completedAt: data.completedAt, questions };
}

export async function loadCustomerSurvey(value: string, signal?: AbortSignal): Promise<CustomerSurveyDetail> {
  const id = Number(value);
  if (!/^[1-9]\d*$/.test(value) || !validId(id)) throw new Error("Mã khảo sát không hợp lệ.");
  const survey = parseCustomerSurvey(await apiRequest<unknown>(`/me/surveys/${id}`, { signal }));
  if (survey.id !== id) throw new Error("Thông tin khảo sát không khớp.");
  return survey;
}

export function surveyUnavailable(survey: CustomerSurveyDetail, now = Date.now()): string | null {
  if (survey.completedAt) return "Bạn đã hoàn thành khảo sát này. Cảm ơn bạn đã chia sẻ cùng Cocoon.";
  if (survey.status !== "Open" || survey.closeAt && Date.parse(survey.closeAt) <= now) return "Khảo sát đã kết thúc hoặc chưa được mở để trả lời.";
  if (survey.openAt && Date.parse(survey.openAt) > now) return "Khảo sát chưa đến thời gian bắt đầu. Bạn hãy quay lại sau nhé.";
  return null;
}

/** Reject foreign option IDs and incompatible values before any submission or draft restore. */
export function answerError(question: SurveyQuestion, answer?: SurveyAnswer): string | null {
  if (!answer) return question.isRequired ? "Bạn hãy trả lời câu hỏi này trước khi tiếp tục nhé." : null;
  if (!Array.isArray(answer.optionIds) || new Set(answer.optionIds).size !== answer.optionIds.length) return "Lựa chọn chưa hợp lệ.";
  if (question.type === "SingleChoice" || question.type === "MultiChoice") {
    if (answer.numericValue !== null || answer.textValue !== null || answer.optionIds.some(id => !question.options.some(option => option.id === id)) || question.type === "SingleChoice" && answer.optionIds.length > 1) return "Lựa chọn chưa hợp lệ.";
    if (question.isRequired && !answer.optionIds.length) return "Bạn hãy chọn câu trả lời trước khi tiếp tục nhé.";
  } else if (question.type === "Rating") {
    if (answer.optionIds.length || answer.textValue !== null || answer.numericValue !== null && (!Number.isInteger(answer.numericValue) || answer.numericValue < 1 || answer.numericValue > 5)) return "Điểm đánh giá cần từ 1 đến 5 sao.";
    if (question.isRequired && answer.numericValue === null) return "Bạn hãy chọn số sao trước khi tiếp tục nhé.";
  } else {
    if (answer.optionIds.length || answer.numericValue !== null || answer.textValue !== null && (typeof answer.textValue !== "string" || answer.textValue.length > 1000)) return "Câu trả lời tối đa 1.000 ký tự.";
    if (question.isRequired && !answer.textValue?.trim()) return "Bạn hãy nhập câu trả lời trước khi tiếp tục nhé.";
  }
  return null;
}
const hasValue = (answer: SurveyAnswer) => answer.optionIds.length > 0 || answer.numericValue !== null || !!answer.textValue?.trim();

export async function submitSurveyResponse(survey: CustomerSurveyDetail, answers: SurveyAnswers, signal?: AbortSignal): Promise<void> {
  const unavailable = surveyUnavailable(survey);
  if (unavailable) throw new Error(unavailable);
  if (!validId(survey.id)) throw new Error("Mã khảo sát không hợp lệ.");
  const body: components["schemas"]["SubmitSurveyRequest"] = { answers: [] };
  for (const question of survey.questions) {
    const answer = answers[question.id];
    const error = answerError(question, answer);
    if (error) throw new Error(error);
    if (answer && hasValue(answer)) body.answers.push({ questionId: question.id, optionIds: question.type.endsWith("Choice") ? answer.optionIds : null, numericValue: answer.numericValue, textValue: answer.textValue?.trim() || null });
  }
  await apiRequest<unknown>(`/me/surveys/${survey.id}/responses`, { method: "POST", json: body, signal });
}

export const surveyDraftKey = (accountId: number | "preview", surveyId: number) => `cocoon:survey-draft:v1:${accountId}:${surveyId}`;
const schemaKey = (survey: CustomerSurveyDetail) => JSON.stringify(survey.questions);
export function readSurveyDraft(storage: Pick<Storage, "getItem">, key: string, survey: CustomerSurveyDetail): SurveyDraftState | null {
  try {
    const raw = storage.getItem(key);
    if (!raw || raw.length > 200000) return null;
    const data = record(JSON.parse(raw));
    if (data.schema !== schemaKey(survey) || data.version !== 1 || !Number.isInteger(data.step) || (data.step as number) < 0 || (data.step as number) >= survey.questions.length || typeof data.review !== "boolean") return null;
    const answers: SurveyAnswers = {};
    for (const q of survey.questions) {
      const answer = record(data.answers)[q.id] as SurveyAnswer | undefined;
      if (answer && !answerError(q, answer) && hasValue(answer)) answers[q.id] = answer;
    }
    // An older incomplete draft must never jump past required answers into review.
    const review = data.review && survey.questions.every(q => !answerError(q, answers[q.id]));
    return { answers, step: data.step as number, review };
  } catch { return null; }
}
export function writeSurveyDraft(storage: Pick<Storage, "setItem">, key: string, survey: CustomerSurveyDetail, state: SurveyDraftState): void {
  storage.setItem(key, JSON.stringify({ version: 1, schema: schemaKey(survey), ...state }));
}
