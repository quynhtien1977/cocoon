import { screenMetadata } from "@/components/brand/screen-placeholder";
import { AnalyticsReport } from "@/features/reports/components/analytics-report";

export const metadata = screenMetadata("M17");

export default function Page() {
  return <AnalyticsReport />;
}
