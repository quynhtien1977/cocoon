import { screenMetadata } from "@/components/brand/screen-placeholder";
import { CustomerReport } from "@/features/reports/components/customer-report";

export const metadata = screenMetadata("M18");

export default function Page() {
  return <CustomerReport />;
}
