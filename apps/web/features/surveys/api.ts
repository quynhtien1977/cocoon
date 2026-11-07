import { apiRequest } from "@/lib/api/client";
import { loadAllPages, type PagedResult } from "@/lib/api/pages";
import type { SegmentFilterValue } from "@/components/data/segment-filter-builder";
import { fromSurveyDetail, toRecipientsRequest, toSurveyUpsertRequest } from "./schemas";
import type { PreferenceOption, RecipientCustomer, RecipientsAdded, SegmentPreview, SurveyDetail, SurveyDraft, SurveyListItem, SurveyResultsData, UpcomingProduct } from "./types";

export const loadSurveys = (signal?: AbortSignal) => loadAllPages<SurveyListItem>("/surveys", signal);
export const loadSurvey = (id: number, signal?: AbortSignal) => apiRequest<SurveyDetail>(`/surveys/${id}`, { signal });

export const createSurvey = (draft: SurveyDraft) => apiRequest<SurveyDetail>("/surveys", { method: "POST", json: toSurveyUpsertRequest(draft) });
export const updateSurvey = (id: number, draft: SurveyDraft) => apiRequest<SurveyDetail>(`/surveys/${id}`, { method: "PUT", json: toSurveyUpsertRequest(draft) });
export const deleteSurvey = (id: number) => apiRequest<void>(`/surveys/${id}`, { method: "DELETE" });
export const publishSurvey = (id: number) => apiRequest<void>(`/surveys/${id}/publish`, { method: "POST" });
export const closeSurvey = (id: number) => apiRequest<void>(`/surveys/${id}/close`, { method: "POST" });

export const addRecipients = (id: number, target: { segment: SegmentFilterValue } | { customerIds: number[] }) =>
  apiRequest<RecipientsAdded>(`/surveys/${id}/recipients`, { method: "POST", json: toRecipientsRequest(target) });
export const previewSegment = (filter: SegmentFilterValue, signal?: AbortSignal) =>
  apiRequest<SegmentPreview>("/segments/preview", { method: "POST", json: filter, signal });

const loadPreferences = (signal?: AbortSignal) => apiRequest<PreferenceOption[]>("/preferences", { signal });
const loadCategories = (signal?: AbortSignal) => apiRequest<PreferenceOption[]>("/categories", { signal });
// shortcut: first 100 Upcoming products only, page through them if the catalogue ever has more.
const loadUpcomingProducts = (signal?: AbortSignal) =>
  apiRequest<PagedResult<UpcomingProduct>>("/products?status=Upcoming&pageSize=100", { signal }).then((result) => result.items);

export interface BuilderData { surveyId?: number; status?: SurveyDetail["status"]; draft?: SurveyDraft; preferences: PreferenceOption[]; products: UpcomingProduct[] }

/** M8: option lists, plus the survey being edited when there is an id. */
export async function loadBuilder(id: number | undefined, signal?: AbortSignal): Promise<BuilderData> {
  const [preferences, products, survey] = await Promise.all([
    loadPreferences(signal), loadUpcomingProducts(signal), id === undefined ? undefined : loadSurvey(id, signal),
  ]);
  return { preferences, products, ...(survey && { surveyId: survey.id, status: survey.status, draft: fromSurveyDetail(survey) }) };
}

export interface SendData { survey: SurveyDetail; preferences: PreferenceOption[]; categories: PreferenceOption[]; customers: RecipientCustomer[] }

/** M9: the survey, segment options and active customers for manual selection (locked ones are rejected by the API). */
export async function loadSend(id: number, signal?: AbortSignal): Promise<SendData> {
  const [survey, preferences, categories, customers] = await Promise.all([
    loadSurvey(id, signal), loadPreferences(signal), loadCategories(signal),
    loadAllPages<RecipientCustomer & { status: string }>("/customers", signal),
  ]);
  return { survey, preferences, categories, customers: customers.filter((row) => row.status === "Active") };
}

/** M10: counts come from the results call so they match the per-question numbers. */
export async function loadResults(id: number, signal?: AbortSignal) {
  const [survey, results] = await Promise.all([loadSurvey(id, signal), apiRequest<SurveyResultsData>(`/surveys/${id}/results`, { signal })]);
  return { survey: { ...survey, recipientCount: results.recipientCount, responseCount: results.responseCount }, results: results.questions };
}
