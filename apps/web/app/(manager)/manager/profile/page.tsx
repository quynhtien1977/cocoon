import { screenMetadata } from "@/components/brand/screen-placeholder";
import { LogoutButton } from "@/features/auth/logout-button";
import { AccountProfile } from "@/features/profile/components/account-profile";

export const metadata = screenMetadata("M15");

export default function Page() {
  return <AccountProfile code="M15" loginHref="/login" logout={<LogoutButton />} />;
}
