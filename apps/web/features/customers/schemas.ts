import { z } from "zod";
import type { components } from "@/lib/api/schema";
import type { CustomerDraft } from "./types";

type CreateCustomerRequest = components["schemas"]["CreateCustomerRequest"];

export const genderOptions = ["Nữ", "Nam", "Khác"];

const digits = (value: string) => value.replace(/\s/g, "");

export const customerDraftSchema = z.object({
  fullName: z.string().trim().min(1, "Nhập họ và tên.").max(200, "Họ tên tối đa 200 ký tự."),
  email: z.string().trim().min(1, "Nhập email.").max(256, "Email tối đa 256 ký tự.").email("Email không hợp lệ."),
  phone: z.string().refine((value) => /^0\d{9}$/.test(digits(value)), "Số điện thoại gồm 10 chữ số, bắt đầu bằng 0."),
  dateOfBirth: z.string(),
  gender: z.string(),
  address: z.string().trim().max(500, "Địa chỉ tối đa 500 ký tự."),
  preferences: z.array(z.string()),
});

/** Flattens zod issues to field → message; today is passed in so the rule stays testable. */
export function validateCustomerDraft(draft: CustomerDraft, today: string): Record<string, string> {
  const result = customerDraftSchema.safeParse(draft);
  const errors: Record<string, string> = {};
  if (!result.success) for (const issue of result.error.issues) errors[issue.path.join(".")] ??= issue.message;
  if (draft.dateOfBirth && draft.dateOfBirth > today) errors.dateOfBirth = "Ngày sinh không thể ở tương lai.";
  return errors;
}

/** Preferences are not part of this request; they go to a separate call once the API offers one for a customer. */
export function toCreateCustomerRequest(draft: CustomerDraft): CreateCustomerRequest {
  return {
    email: draft.email.trim(),
    fullName: draft.fullName.trim(),
    phone: digits(draft.phone),
    dateOfBirth: draft.dateOfBirth || null,
    gender: draft.gender || null,
    address: draft.address.trim() || null,
  };
}
