import { screenMetadata } from "@/components/brand/screen-placeholder";
import { CustomerCreateForm } from "@/features/customers/components/customer-create-form";

export const metadata = screenMetadata("M3");

export default function Page() {
  return <CustomerCreateForm />;
}
