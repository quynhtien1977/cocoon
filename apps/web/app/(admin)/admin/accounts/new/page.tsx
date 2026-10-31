import { screenMetadata } from "@/components/brand/screen-placeholder";
import { AccountCreateForm } from "@/features/accounts/components/account-create-form";

export const metadata = screenMetadata("A2");

export default function Page() {
  return <AccountCreateForm />;
}
