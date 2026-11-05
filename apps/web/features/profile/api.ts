import { apiRequest } from "@/lib/api/client";
import { toChangePasswordRequest, toUpdateProfileRequest } from "./schemas";
import type { PasswordDraft, ProfileDraft, StaffProfile } from "./types";

export const loadMyProfile = (signal?: AbortSignal) => apiRequest<StaffProfile>("/me", { signal });
export const saveMyProfile = (draft: ProfileDraft) => apiRequest<void>("/me", { method: "PUT", json: toUpdateProfileRequest(draft) });
/** The API signs the session out on success, so the caller must send the user to log in again. */
export const changeMyPassword = (draft: PasswordDraft) => apiRequest<void>("/auth/change-password", { method: "POST", json: toChangePasswordRequest(draft), redirectOnUnauthorized: false });
