import { screenMetadata } from "@/components/brand/screen-placeholder";
import { LogoutButton } from "@/features/auth/logout-button";
import { AccountProfile } from "@/features/profile/components/account-profile";

export const metadata = screenMetadata("A4");

export default function Page() {
  return <AccountProfile variant="admin" logout={<LogoutButton />} />;
}
