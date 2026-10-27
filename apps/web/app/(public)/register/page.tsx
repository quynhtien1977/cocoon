import type { Metadata } from "next";
import { LandingPage } from "@/features/landing/landing-page";

export const metadata: Metadata = { title: "Đăng ký khách hàng", robots: { index: false, follow: false } };

export default function Page() {
  return <LandingPage />;
}
