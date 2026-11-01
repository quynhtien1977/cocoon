import { notFound } from "next/navigation";
import { screenMetadata } from "@/components/brand/screen-placeholder";
import { SurveyResults } from "@/features/surveys/components/survey-results";
import { surveyResultsFixture, surveysFixture } from "@/features/surveys/surveys.fixture";

export const metadata = screenMetadata("M10");

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const survey = surveysFixture.find((row) => row.id === Number(id));
  if (!survey) notFound();
  return <SurveyResults survey={survey} results={surveyResultsFixture(survey.id)} />;
}
