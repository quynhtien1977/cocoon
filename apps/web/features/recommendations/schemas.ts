import { z } from "zod";
import type { SegmentFilterValue, SegmentOption } from "@/components/data/segment-filter-builder";
import type { components } from "@/lib/api/schema";
import type { PlanDraft, RecommendationPlan } from "./types";

type PlanUpsertRequest = components["schemas"]["PlanUpsertRequest"];

/** From the Stitch M14 mock; the API takes any number of products. */
export const MAX_PLAN_PRODUCTS = 3;

const details = z.object({
  name: z.string().trim().min(1, "Nhập tên kế hoạch.").max(120, "Tên kế hoạch tối đa 120 ký tự."),
  goal: z.string(),
  startAt: z.string().min(1, "Chọn ngày bắt đầu."),
  endAt: z.string().min(1, "Chọn ngày kết thúc."),
}).superRefine((value, ctx) => {
  if (value.startAt && value.endAt && value.endAt <= value.startAt) ctx.addIssue({ code: "custom", path: ["endAt"], message: "Ngày kết thúc phải sau ngày bắt đầu." });
});

/** Step 1 fields, as "field" → first message. */
export function validatePlanDetails(draft: PlanDraft): Record<string, string> {
  const result = details.safeParse(draft);
  if (result.success) return {};
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) errors[issue.path.join(".")] ??= issue.message;
  return errors;
}

export const toPlanDraft = (plan: RecommendationPlan): PlanDraft => ({ name: plan.name, goal: plan.goal ?? "", startAt: plan.startAt.slice(0, 10), endAt: plan.endAt.slice(0, 10), segment: plan.segment, productIds: plan.productIds });

export const toPlanUpsertRequest = (draft: PlanDraft): PlanUpsertRequest => ({
  name: draft.name.trim(),
  goal: draft.goal.trim() || null,
  // Vietnam has no DST, so a fixed +07:00 offset keeps dates on the chosen calendar day.
  startAt: `${draft.startAt}T00:00:00+07:00`,
  endAt: `${draft.endAt}T23:59:59+07:00`,
  segment: draft.segment,
  productIds: draft.productIds,
});

const names = (ids: readonly number[], options: readonly SegmentOption[]) => ids.map((id) => options.find((item) => item.id === id)?.name).filter(Boolean).join(", ");

export function segmentSummary(filter: SegmentFilterValue, preferences: readonly SegmentOption[], categories: readonly SegmentOption[]): string {
  const parts = [
    filter.ageMin !== null || filter.ageMax !== null ? `${filter.ageMin ?? "…"}–${filter.ageMax ?? "…"} tuổi` : "",
    filter.genders.join(", "),
    names(filter.preferenceIds, preferences),
    filter.purchasedCategoryIds.length ? `Đã mua ${names(filter.purchasedCategoryIds, categories)}` : "",
    filter.lastPurchaseWithinDays !== null ? `Mua trong ${filter.lastPurchaseWithinDays} ngày` : "",
    filter.excludeLowRatedCategoryIds.length ? `Loại trừ đánh giá thấp ${names(filter.excludeLowRatedCategoryIds, categories)}` : "",
  ].filter(Boolean);
  return parts.join(" · ") || "Mọi khách hàng";
}
