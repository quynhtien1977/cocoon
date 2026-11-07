import { apiRequest } from "@/lib/api/client";
import { toChangePasswordRequest, toUpdateProfileRequest } from "./schemas";
import type { PasswordDraft, ProfileDraft, StaffProfile } from "./types";

export const loadMyProfile = (signal?: AbortSignal) => apiRequest<StaffProfile>("/me", { signal });
export const saveMyProfile = (draft: ProfileDraft) => apiRequest<void>("/me", { method: "PUT", json: toUpdateProfileRequest(draft) });
/** The API signs the session out on success, so the caller must send the user to log in again. */
export const changeMyPassword = (draft: PasswordDraft) => apiRequest<void>("/auth/change-password", { method: "POST", json: toChangePasswordRequest(draft), redirectOnUnauthorized: false });

const totalCount = (path: string, signal?: AbortSignal) => apiRequest<{ totalCount: number }>(path, { signal }).then((page) => page.totalCount);

/** S3 tiles: feedback assigned to me, already answered vs still waiting. */
export async function loadStaffStats(signal?: AbortSignal) {
  const [replied, closed, assigned] = await Promise.all(["Replied", "Closed", "Assigned"].map((status) => totalCount(`/staff/feedback?status=${status}&pageSize=1`, signal)));
  return { resolved: replied + closed, inProgress: assigned };
}

/** M15 tiles: feedback closed by managers and surveys currently open. */
export async function loadManagerStats(signal?: AbortSignal) {
  const [closedFeedback, openSurveys] = await Promise.all([totalCount("/feedback?status=Closed&pageSize=1", signal), totalCount("/surveys?status=Open&pageSize=1", signal)]);
  return { closedFeedback, openSurveys };
}

/** GET me has no login time; the admin account list does, so A4 looks itself up there. */
export async function loadLastLogin(profile: Pick<StaffProfile, "id" | "email">, signal?: AbortSignal) {
  const page = await apiRequest<{ items: { id: number; lastLoginAt: string | null }[] }>(`/admin/accounts?search=${encodeURIComponent(profile.email)}&pageSize=20`, { signal });
  return page.items.find((row) => row.id === profile.id)?.lastLoginAt ?? null;
}
