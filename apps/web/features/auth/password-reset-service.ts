import { apiRequest } from "../../lib/api/client";

/**
 * "Quên mật khẩu" and the first password of an invited account, in three steps (decision 15/11/2026):
 * POST /auth/password/forgot sends a 6-digit code by email, /verify checks it and returns a ticket,
 * /reset spends the ticket with the new password. All three are anonymous.
 */

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const anonymous = { redirectOnUnauthorized: false, refresh: false } as const;

export function validateEmail(email: string): string | undefined {
  return emailPattern.test(email.trim()) ? undefined : "Email không hợp lệ.";
}

/** Shape only; the API decides whether the code is right (INVALID_CODE on the code field). */
export function validateCode(code: string): string | undefined {
  return /^\d{6}$/.test(code.trim()) ? undefined : "Mã xác nhận gồm 6 chữ số.";
}

export type NewPasswordDraft = { newPassword: string; confirmPassword: string };

/** Same rule as the API: 8–128 characters with a letter and a digit. */
export function validateNewPassword(draft: NewPasswordDraft): Partial<Record<keyof NewPasswordDraft, string>> {
  const errors: Partial<Record<keyof NewPasswordDraft, string>> = {};
  const password = draft.newPassword;
  if (password.length < 8 || password.length > 128 || !/\p{L}/u.test(password) || !/\d/.test(password))
    errors.newPassword = "Mật khẩu cần 8–128 ký tự, có chữ và số.";
  if (draft.confirmPassword !== password) errors.confirmPassword = "Mật khẩu nhập lại chưa khớp.";
  return errors;
}

/** Always resolves with the same message whether or not the email has an account (202). */
export async function requestPasswordCode(email: string): Promise<string> {
  const result = await apiRequest<{ message: string }>("/auth/password/forgot", { method: "POST", json: { email: email.trim() }, ...anonymous });
  return result.message;
}

export type PasswordTicket = { ticket: string; expiresAt: string };

/** 200 with a ticket valid for up to 10 minutes; ApiError 400 INVALID_CODE (field code) for a wrong, used or expired code. */
export function verifyPasswordCode(email: string, code: string): Promise<PasswordTicket> {
  return apiRequest<PasswordTicket>("/auth/password/verify", { method: "POST", json: { email: email.trim(), code: code.trim() }, ...anonymous });
}

/** 204; ApiError 400 VALIDATION_ERROR (field newPassword) or RESET_EXPIRED (ask for the code again). */
export async function resetPassword(ticket: string, newPassword: string): Promise<void> {
  await apiRequest<void>("/auth/password/reset", { method: "POST", json: { ticket, newPassword }, ...anonymous });
}
