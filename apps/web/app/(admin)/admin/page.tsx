import { screenMetadata } from "@/components/brand/screen-placeholder";
import { AccountList } from "@/features/accounts/components/account-list";

export const metadata = screenMetadata("A1");

export default function Page() {
  return <AccountList />;
}
