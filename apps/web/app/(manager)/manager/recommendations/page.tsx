import { screenMetadata } from "@/components/brand/screen-placeholder";
import { RecommendationOverviewPage } from "@/features/recommendations/components/recommendation-overview";

export const metadata = screenMetadata("M13");

export default function Page() {
  return <RecommendationOverviewPage />;
}
