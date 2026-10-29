import { screenMetadata } from "@/components/brand/screen-placeholder";
import { SurveyBuilder } from "@/features/surveys/components/survey-builder";
import { surveyDraftFixture } from "@/features/surveys/surveys.fixture";

export const metadata = screenMetadata("M8");

// Static phase: every id shows the same draft fixture until GET surveys/{id} is wired up.
export default function Page() {
  return <SurveyBuilder initial={surveyDraftFixture} />;
}
