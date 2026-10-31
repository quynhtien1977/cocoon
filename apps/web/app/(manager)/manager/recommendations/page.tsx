import { screenMetadata } from "@/components/brand/screen-placeholder";
import { RecommendationOverview } from "@/features/recommendations/components/recommendation-overview";
import { plansFixture } from "@/features/recommendations/recommendations.fixture";
import { preferencesFixture, segmentCategoriesFixture } from "@/features/surveys/surveys.fixture";

export const metadata = screenMetadata("M13");

export default function Page() {
  return <RecommendationOverview initialPlans={plansFixture} preferences={preferencesFixture} categories={segmentCategoriesFixture} />;
}
