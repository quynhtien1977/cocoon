import { notFound } from "next/navigation";
import { screenMetadata } from "@/components/brand/screen-placeholder";
import { SurveyBuilder } from "@/features/surveys/components/survey-builder";
import { surveyDraftByIdFixture } from "@/features/surveys/surveys.fixture";

export const metadata = screenMetadata("M8");

// Only drafts can be edited (spec: questions lock once a survey opens).
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const draft = surveyDraftByIdFixture(Number(id));
  if (!draft) notFound();
  return <SurveyBuilder initial={draft} />;
}
