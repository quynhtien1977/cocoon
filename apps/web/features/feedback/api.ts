import { apiRequest } from "@/lib/api/client";
import { loadAllPages } from "@/lib/api/pages";
import { toReplyRequest } from "./schemas";
import type { FeedbackDetail, FeedbackListItem, FeedbackReply, StaffOption } from "./types";

export const loadFeedback = (signal?: AbortSignal) => loadAllPages<FeedbackListItem>("/feedback", signal);
export const loadAssignedFeedback = (signal?: AbortSignal) => loadAllPages<FeedbackListItem>("/staff/feedback", signal);
export const loadFeedbackDetail = (id: number, signal?: AbortSignal) => apiRequest<FeedbackDetail>(`/feedback/${id}`, { signal });

export const loadStaff = (signal?: AbortSignal) => apiRequest<StaffOption[]>("/staff", { signal });

export const acceptFeedback = (id: number) => apiRequest<void>(`/feedback/${id}/accept`, { method: "POST" });
export const assignFeedback = (id: number, staffId: number) => apiRequest<void>(`/feedback/${id}/assign`, { method: "POST", json: { staffId } });
export const closeFeedback = (id: number) => apiRequest<void>(`/feedback/${id}/close`, { method: "POST" });
export const replyToFeedback = (id: number, content: string) => apiRequest<FeedbackReply>(`/feedback/${id}/replies`, { method: "POST", json: toReplyRequest(content) });
