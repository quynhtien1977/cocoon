import type { Metadata } from "next";
import { LandingPage } from "@/features/landing/landing-page";

export const metadata: Metadata = {
  title: { absolute: "Cocoon · Mỹ phẩm thuần chay từ Việt Nam" },
  description: "Khám phá vẻ đẹp từ thực vật Việt Nam cùng Cocoon. Chăm sóc da, tóc và cơ thể, kết nối với hành trình chăm sóc dành riêng cho bạn.",
};

export default function Page() {
  return <LandingPage />;
}
