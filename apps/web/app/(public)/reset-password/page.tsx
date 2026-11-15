import type { Metadata } from "next";
import { LandingPage } from "@/features/landing/landing-page";
import { ResetPasswordDialog } from "@/features/auth/reset-password-dialog";

export const metadata: Metadata = {
  title: "Đặt lại mật khẩu",
  description: "Nhập mã xác nhận từ email để đặt mật khẩu mới hoặc kích hoạt tài khoản Cocoon.",
  robots: { index: false, follow: false },
};

export default async function Page({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  return <><LandingPage /><ResetPasswordDialog initialEmail={typeof email === "string" ? email : ""} /></>;
}
