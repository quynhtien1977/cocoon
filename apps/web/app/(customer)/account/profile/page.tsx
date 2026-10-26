import type { Metadata } from "next";
import { ProfilePage } from "@/features/customer/profile-page";

export const metadata: Metadata = { title: "Hồ sơ của bạn | Cocoon", description: "Quản lý thông tin cá nhân và sở thích của bạn cùng Cocoon." };

export default function Page() {
  return <ProfilePage />;
}
