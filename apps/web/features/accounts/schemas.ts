import { z } from "zod";
import type { components } from "@/lib/api/schema";
import type { AccountRole } from "@/lib/auth/roles";
import type { AccountDraft } from "./types";

type CreateAccountRequest = components["schemas"]["CreateAccountRequest"];

export const roleLabels: Record<AccountRole, string> = {
  Admin: "Quản trị viên",
  Manager: "Quản lý",
  Staff: "Nhân viên",
  Customer: "Khách hàng",
};

/** Least privilege first, so the form's default is the narrowest role. */
export const assignableRoles: AccountRole[] = ["Staff", "Manager", "Admin", "Customer"];

export const roleSummaries: Record<AccountRole, { tag: string; description: string; scope: string }> = {
  Staff: { tag: "Xử lý phản hồi", description: "Xem và trả lời những phản hồi được giao.", scope: "Không gian nhân viên: phản hồi được giao." },
  Manager: { tag: "Điều phối vận hành", description: "Quản lý khách hàng, phân công phản hồi, tạo khảo sát và theo dõi báo cáo.", scope: "Không gian quản lý: khách hàng, phản hồi, khảo sát, sản phẩm, gợi ý, báo cáo." },
  Admin: { tag: "Toàn quyền tài khoản", description: "Tạo tài khoản, đổi vai trò, khóa và xóa tài khoản.", scope: "Admin console: quản trị tài khoản toàn hệ thống." },
  Customer: { tag: "Tài khoản thành viên", description: "Xem đơn hàng, gửi phản hồi, làm khảo sát và nhận gợi ý sản phẩm.", scope: "Cổng khách hàng, không vào được back-office." },
};

// Ordinals follow declaration order in Cocoon.Domain.Enums (System.Text.Json default serialization).
export const roleOrdinal: Record<AccountRole, number> = { Admin: 0, Manager: 1, Staff: 2, Customer: 3 };

export const accountDraftSchema = z.object({
  fullName: z.string().trim().min(1, "Nhập họ và tên.").max(200, "Họ tên tối đa 200 ký tự."),
  email: z.string().trim().min(1, "Nhập email đăng nhập.").max(256, "Email tối đa 256 ký tự.").email("Email không hợp lệ."),
  role: z.enum(["Admin", "Manager", "Staff", "Customer"]),
});

/** Flattens zod issues to field → message, first message per field. */
export function validateAccountDraft(draft: AccountDraft): Record<string, string> {
  const result = accountDraftSchema.safeParse(draft);
  if (result.success) return {};
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) errors[issue.path.join(".")] ??= issue.message;
  return errors;
}

export function toCreateAccountRequest(draft: AccountDraft): CreateAccountRequest {
  return { email: draft.email.trim(), fullName: draft.fullName.trim(), role: roleOrdinal[draft.role] };
}
