import { apiRequest } from "@/lib/api/client";
import { toReplyRequest } from "./schemas";
import type { FeedbackDetail, FeedbackListItem, FeedbackReply, StaffOption } from "./types";

interface PagedResult<T> { items: T[]; totalCount: number; page: number; pageSize: number }

// DataTable filters and sorts in the browser, so it needs every row; the API caps a page at 100.
const PAGE_SIZE = 100;

async function loadAllPages(path: string, signal?: AbortSignal): Promise<FeedbackListItem[]> {
  const rows: FeedbackListItem[] = [];
  for (let page = 1; ; page++) {
    const result = await apiRequest<PagedResult<FeedbackListItem>>(`${path}?page=${page}&pageSize=${PAGE_SIZE}`, { signal });
    rows.push(...result.items);
    if (result.items.length === 0 || rows.length >= result.totalCount) return rows;
  }
}

export const loadFeedback = (signal?: AbortSignal) => loadAllPages("/feedback", signal);
export const loadAssignedFeedback = (signal?: AbortSignal) => loadAllPages("/staff/feedback", signal);
export const loadFeedbackDetail = (id: number, signal?: AbortSignal) => apiRequest<FeedbackDetail>(`/feedback/${id}`, { signal });

export const loadStaff = (signal?: AbortSignal) => apiRequest<StaffOption[]>("/staff", { signal });

export const acceptFeedback = (id: number) => apiRequest<void>(`/feedback/${id}/accept`, { method: "POST" });
export const assignFeedback = (id: number, staffId: number) => apiRequest<void>(`/feedback/${id}/assign`, { method: "POST", json: { staffId } });
export const closeFeedback = (id: number) => apiRequest<void>(`/feedback/${id}/close`, { method: "POST" });
export const replyToFeedback = (id: number, content: string) => apiRequest<FeedbackReply>(`/feedback/${id}/replies`, { method: "POST", json: toReplyRequest(content) });
