import { apiRequest } from "../../lib/api/client";

/**
 * "Quên mật khẩu" and the first password of an invited account, with a 6-digit code sent by email
 * (POST /auth/password/forgot and /reset, decision 15/11/2026). Both endpoints are anonymous.
 */

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type ResetDraft = { email: string; code: string; newPassword: string; confirmPassword: string };

/** Per-field messages; the API re-checks everything and answers INVALID_CODE on the code field. */
export function validateResetDraft(draft: ResetDraft): Partial<Record<keyof ResetDraft, string>> {
  const errors: Partial<Record<keyof ResetDraft, string>> = {};
  if (!emailPattern.test(draft.email.trim())) errors.email = "Email không hợp lệ.";
  if (!/^\d{6}$/.test(draft.code.trim())) errors.code = "Mã xác nhận gồm 6 chữ số.";
  const password = draft.newPassword;
  if (password.length < 8 || password.length > 128 || !/\p{L}/u.test(password) || !/\d/.test(password))
    errors.newPassword = "Mật khẩu cần 8–128 ký tự, có chữ và số.";
  if (draft.confirmPassword !== password) errors.confirmPassword = "Mật khẩu nhập lại chưa khớp.";
  return errors;
}

/** Always resolves with the same message whether or not the email has an account (202). */
export async function requestPasswordCode(email: string): Promise<string> {
  const result = await apiRequest<{ message: string }>("/auth/password/forgot", {
    method: "POST", json: { email: email.trim() }, redirectOnUnauthorized: false, refresh: false,
  });
  return result.message;
}

/** 204 on success; ApiError 400 with code INVALID_CODE (field code) or VALIDATION_ERROR (field newPassword) otherwise. */
export async function resetPassword(draft: ResetDraft): Promise<void> {
  await apiRequest<void>("/auth/password/reset", {
    method: "POST", json: { email: draft.email.trim(), code: draft.code.trim(), newPassword: draft.newPassword },
    redirectOnUnauthorized: false, refresh: false,
  });
}
