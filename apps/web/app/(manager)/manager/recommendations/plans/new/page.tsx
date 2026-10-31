import { screenMetadata } from "@/components/brand/screen-placeholder";
import { PlanEditor } from "@/features/recommendations/components/plan-editor";
import { planProductsFixture } from "@/features/recommendations/recommendations.fixture";
import { preferencesFixture, segmentCategoriesFixture, surveyCandidatesFixture } from "@/features/surveys/surveys.fixture";

export const metadata = screenMetadata("M14");

// The route supplies the audience data because features/recommendations must not import features/surveys.
export default function Page() {
  return <PlanEditor products={planProductsFixture} customers={surveyCandidatesFixture} preferences={preferencesFixture} categories={segmentCategoriesFixture} />;
}
