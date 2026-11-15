import type { Metadata } from "next";
import { ResetPasswordPage } from "@/features/auth/reset-password-page";

export const metadata: Metadata = {
  title: "Đặt lại mật khẩu",
  description: "Nhập mã xác nhận từ email để đặt mật khẩu mới hoặc kích hoạt tài khoản Cocoon.",
  robots: { index: false, follow: false },
};

export default async function Page({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  return <ResetPasswordPage initialEmail={typeof email === "string" ? email : ""} />;
}
