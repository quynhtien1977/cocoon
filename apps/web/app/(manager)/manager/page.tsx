import { screenMetadata } from "@/components/brand/screen-placeholder";
import { ManagerDashboard } from "@/features/reports/components/manager-dashboard";

export const metadata = screenMetadata("M1");

export default function Page() {
  return <ManagerDashboard />;
}
