import type { SegmentFilterValue, SegmentOption } from "@/components/data/segment-filter-builder";
import { apiRequest } from "@/lib/api/client";
import { loadAllPages } from "@/lib/api/pages";
import { toPlanUpsertRequest } from "./schemas";
import type { PlanDraft, PlanProduct, PlanRunResult, RebuildResult, RecommendationPlan, RecommendationReport, SegmentPreview } from "./types";

export interface SegmentOptions { preferences: SegmentOption[]; categories: SegmentOption[] }
export interface OverviewData extends SegmentOptions { plans: RecommendationPlan[]; report: RecommendationReport }
export interface PlanPageData extends SegmentOptions { plan: RecommendationPlan | null; products: PlanProduct[] }

const loadOptions = async (signal?: AbortSignal): Promise<SegmentOptions> => {
  const [preferences, categories] = await Promise.all([
    apiRequest<SegmentOption[]>("/preferences", { signal }),
    apiRequest<SegmentOption[]>("/categories", { signal }),
  ]);
  return { preferences, categories };
};

export const loadReport = (signal?: AbortSignal) => apiRequest<RecommendationReport>("/reports/recommendations", { signal });

/** M13: plans, the all-time report and the names a segment summary needs. */
export async function loadOverview(signal?: AbortSignal): Promise<OverviewData> {
  const [plans, report, options] = await Promise.all([loadAllPages<RecommendationPlan>("/recommendation-plans", signal), loadReport(signal), loadOptions(signal)]);
  return { plans, report, ...options };
}

/** M14: the plan (null for a new one) plus every product, so a plan still names products hidden since. */
export async function loadPlanPage(id: number | undefined, signal?: AbortSignal): Promise<PlanPageData> {
  const [plan, products, options] = await Promise.all([
    id === undefined ? null : apiRequest<RecommendationPlan>(`/recommendation-plans/${id}`, { signal }),
    loadAllPages<PlanProduct>("/products", signal),
    loadOptions(signal),
  ]);
  return { plan, products, ...options };
}

export const previewSegment = (segment: SegmentFilterValue, signal?: AbortSignal) => apiRequest<SegmentPreview>("/segments/preview?consentOnly=true", { method: "POST", json: segment, signal });
export const createPlan = (draft: PlanDraft) => apiRequest<RecommendationPlan>("/recommendation-plans", { method: "POST", json: toPlanUpsertRequest(draft) });
export const updatePlan = (id: number, draft: PlanDraft) => apiRequest<RecommendationPlan>(`/recommendation-plans/${id}`, { method: "PUT", json: toPlanUpsertRequest(draft) });
export const deletePlan = (id: number) => apiRequest<void>(`/recommendation-plans/${id}`, { method: "DELETE" });
export const activatePlan = (id: number) => apiRequest<PlanRunResult>(`/recommendation-plans/${id}/activate`, { method: "POST" });
export const endPlan = (id: number) => apiRequest<PlanRunResult>(`/recommendation-plans/${id}/end`, { method: "POST" });
export const rebuildRecommendations = () => apiRequest<RebuildResult>("/recommendations/rebuild", { method: "POST" });
