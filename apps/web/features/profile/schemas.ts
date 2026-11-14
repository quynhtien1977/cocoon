import { z } from "zod";
import type { components } from "@/lib/api/schema";
import type { PasswordDraft, ProfileDraft } from "./types";

type UpdateProfileRequest = components["schemas"]["UpdateProfileRequest"];
/** schema.d.ts predates POST auth/change-password; mirrors ChangePasswordRequest in ChangePasswordController.cs. */
type ChangePasswordRequest = { currentPassword: string; newPassword: string };

const firstErrors = (issues: z.ZodError["issues"]) => {
  const errors: Record<string, string> = {};
  for (const issue of issues) errors[issue.path.join(".")] ??= issue.message;
  return errors;
};

const profile = z.object({
  fullName: z.string().trim().min(1, "Nhập họ và tên.").max(150, "Họ và tên tối đa 150 ký tự."),
  // Same rule as the customer profile (C1): 8–15 digits, common separators allowed.
  phone: z.string().trim().max(32, "Số điện thoại tối đa 32 ký tự.").refine((value) => !value || (/^\+?[\d\s().-]+$/.test(value) && value.replace(/\D/g, "").length >= 8 && value.replace(/\D/g, "").length <= 15), "Nhập số điện thoại hợp lệ (8–15 chữ số)."),
});

/** requirePhone: manager accounts must keep a phone number (the API rejects a blank one). */
export function validateProfileDraft(draft: ProfileDraft, requirePhone = false): Record<string, string> {
  const result = profile.safeParse(draft);
  const errors = result.success ? {} : firstErrors(result.error.issues);
  if (requirePhone && !draft.phone.trim()) errors.phone ??= "Quản lý cần có số điện thoại.";
  return errors;
}

// Mirrors AccountManagementService.ChangePasswordAsync so most mistakes are caught before the request.
const password = z.object({
  currentPassword: z.string().min(1, "Nhập mật khẩu hiện tại."),
  newPassword: z.string().min(8, "Mật khẩu cần 8–128 ký tự, có chữ và số.").max(128, "Mật khẩu cần 8–128 ký tự, có chữ và số.")
    .refine((value) => /\p{L}/u.test(value) && /\d/.test(value), "Mật khẩu cần 8–128 ký tự, có chữ và số."),
  confirmPassword: z.string(),
}).superRefine((value, ctx) => {
  if (value.newPassword && value.newPassword === value.currentPassword) ctx.addIssue({ code: "custom", path: ["newPassword"], message: "Mật khẩu mới phải khác mật khẩu hiện tại." });
  if (value.confirmPassword !== value.newPassword) ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "Mật khẩu nhập lại không khớp." });
});

export function validatePasswordDraft(draft: PasswordDraft): Record<string, string> {
  const result = password.safeParse(draft);
  return result.success ? {} : firstErrors(result.error.issues);
}

/** Internal accounts only store name and phone; the rest of UpdateProfileRequest is customer-only. */
export const toUpdateProfileRequest = (draft: ProfileDraft): UpdateProfileRequest => ({
  fullName: draft.fullName.trim(), phone: draft.phone.trim() || null, dateOfBirth: null, gender: null, address: null, consentPersonalData: false,
});

export const toChangePasswordRequest = (draft: PasswordDraft): ChangePasswordRequest => ({ currentPassword: draft.currentPassword, newPassword: draft.newPassword });
