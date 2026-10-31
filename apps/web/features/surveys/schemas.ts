import { z } from "zod";
import type { components } from "@/lib/api/schema";
import type { QuestionType, SurveyDraft, SurveyPurpose } from "./types";

type SurveyUpsertRequest = components["schemas"]["SurveyUpsertRequest"];

export const questionTypeLabels: Record<QuestionType, string> = {
  SingleChoice: "Chọn một",
  MultiChoice: "Chọn nhiều",
  Rating: "Đánh giá 1–5 sao",
  ShortText: "Trả lời ngắn",
};

export const purposeLabels: Record<SurveyPurpose, string> = {
  Satisfaction: "Mức độ hài lòng",
  NewProduct: "Sản phẩm mới",
  Other: "Khác",
};

// Ordinals follow declaration order in Cocoon.Domain.Enums (System.Text.Json default serialization).
const questionTypeOrdinal: Record<QuestionType, number> = { SingleChoice: 0, MultiChoice: 1, Rating: 2, ShortText: 3 };
const purposeOrdinal: Record<SurveyPurpose, number> = { Satisfaction: 0, NewProduct: 1, Other: 2 };

export const isChoice = (type: QuestionType) => type === "SingleChoice" || type === "MultiChoice";

const option = z.object({
  key: z.string(),
  text: z.string().trim().min(1, "Nhập nội dung lựa chọn.").max(200, "Lựa chọn tối đa 200 ký tự."),
  preferenceId: z.number().int().nullable(),
});

const question = z.object({
  key: z.string(),
  text: z.string().trim().min(1, "Nhập nội dung câu hỏi.").max(500, "Câu hỏi tối đa 500 ký tự."),
  type: z.enum(["SingleChoice", "MultiChoice", "Rating", "ShortText"]),
  isRequired: z.boolean(),
  options: z.array(option),
}).superRefine((value, ctx) => {
  if (isChoice(value.type) && value.options.length < 2) ctx.addIssue({ code: "custom", path: ["options"], message: "Câu chọn lựa cần ít nhất 2 lựa chọn." });
});

export const surveyDraftSchema = z.object({
  title: z.string().trim().min(1, "Nhập tên khảo sát.").max(200, "Tên khảo sát tối đa 200 ký tự."),
  description: z.string().max(1000, "Mô tả tối đa 1000 ký tự."),
  purpose: z.enum(["Satisfaction", "NewProduct", "Other"]),
  productId: z.number().int().nullable(),
  openAt: z.string(),
  closeAt: z.string(),
  questions: z.array(question).min(1, "Thêm ít nhất một câu hỏi."),
}).superRefine((value, ctx) => {
  if (value.purpose === "NewProduct" && value.productId === null) ctx.addIssue({ code: "custom", path: ["productId"], message: "Chọn sản phẩm sắp ra mắt cho khảo sát sản phẩm mới." });
  if (value.openAt && value.closeAt && value.closeAt <= value.openAt) ctx.addIssue({ code: "custom", path: ["closeAt"], message: "Ngày kết thúc phải sau ngày bắt đầu." });
});

/** Flattens zod issues to "questions.0.options.1.text" → message, first message per path. */
export function validateSurveyDraft(draft: SurveyDraft): Record<string, string> {
  const result = surveyDraftSchema.safeParse(draft);
  if (result.success) return {};
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) errors[issue.path.join(".")] ??= issue.message;
  return errors;
}

/** Vietnam has no DST, so a fixed +07:00 offset keeps dates on the chosen calendar day. */
const toDateTime = (value: string, endOfDay: boolean) => value ? `${value}T${endOfDay ? "23:59:59" : "00:00:00"}+07:00` : null;

export function toSurveyUpsertRequest(draft: SurveyDraft): SurveyUpsertRequest {
  return {
    title: draft.title.trim(),
    description: draft.description.trim() || null,
    purpose: purposeOrdinal[draft.purpose],
    productId: draft.purpose === "NewProduct" ? draft.productId : null,
    openAt: toDateTime(draft.openAt, false),
    closeAt: toDateTime(draft.closeAt, true),
    questions: draft.questions.map((item) => ({
      text: item.text.trim(),
      type: questionTypeOrdinal[item.type],
      isRequired: item.isRequired,
      options: isChoice(item.type) ? item.options.map((choice) => ({ text: choice.text.trim(), preferenceId: choice.preferenceId })) : [],
    })),
  };
}
