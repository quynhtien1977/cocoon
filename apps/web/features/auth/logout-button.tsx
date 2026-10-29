"use client";

import { Info, LogOut } from "lucide-react";
import { ConfirmDialog } from "@/components/brand/confirm-dialog";
import { logout } from "./logout-service";

export function LogoutButton() {
  async function handleLogout() {
    try {
      await logout();
    } catch {
      throw new Error("Chưa thể đăng xuất. Vui lòng thử lại.");
    }
  }

  return <ConfirmDialog
    appearance="soft"
    eyebrow="Tài khoản Cocoon"
    icon={<LogOut size={18} strokeWidth={1.5} />}
    title="Bạn muốn đăng xuất?"
    description="Bạn có chắc muốn đăng xuất khỏi tài khoản? Sau khi đăng xuất, bạn sẽ trở về trang chủ và có thể đăng nhập lại bất cứ lúc nào."
    confirmLabel="Đăng xuất"
    cancelLabel="Hủy"
    pendingLabel="Đang đăng xuất…"
    portal="customer"
    onConfirm={handleLogout}
    trigger={<button type="button" className="inline-flex min-h-11 items-center gap-2 text-sm text-[#756b5e] hover:text-[#846530] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8a6a2b]"><LogOut size={16} aria-hidden="true" />Đăng xuất</button>}
  >
    <div className="flex items-start gap-3 rounded-lg bg-[#f4eedf] p-4 text-xs leading-6 text-[#97815c]"><Info size={17} aria-hidden="true" className="mt-1 shrink-0" /><p>Những thay đổi chưa lưu trong hồ sơ sẽ không được giữ lại. Hãy lưu thông tin trước khi đăng xuất nhé.</p></div>
  </ConfirmDialog>;
}
