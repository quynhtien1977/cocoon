import { screenMetadata } from "@/components/brand/screen-placeholder";
import { SurveyList } from "@/features/surveys/components/survey-list";

export const metadata = screenMetadata("M7");

export default function Page() {
  return <SurveyList />;
}
