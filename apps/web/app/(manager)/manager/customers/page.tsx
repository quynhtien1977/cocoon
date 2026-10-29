import { screenMetadata } from "@/components/brand/screen-placeholder";
import { CustomerList } from "@/features/customers/components/customer-list";

export const metadata = screenMetadata("M2");

export default function Page() {
  return <CustomerList />;
}
