import type { Metadata } from "next";
import { LoginDialog } from "@/features/auth/login-dialog";
import { LandingPage } from "@/features/landing/landing-page";

export const metadata: Metadata = { title: "Đăng nhập", robots: { index: false, follow: false } };

export default function Page() {
  return <><LandingPage /><LoginDialog direct /></>;
}
