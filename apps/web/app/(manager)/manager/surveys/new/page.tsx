import { screenMetadata } from "@/components/brand/screen-placeholder";
import { SurveyBuilder } from "@/features/surveys/components/survey-builder";

export const metadata = screenMetadata("M8");

export default function Page() {
  return <SurveyBuilder />;
}
