import { screenMetadata } from "@/components/brand/screen-placeholder";
import { SurveyBuilderPage } from "@/features/surveys/components/survey-builder";

export const metadata = screenMetadata("M8");

export default function Page() {
  return <SurveyBuilderPage />;
}
