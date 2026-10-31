import { notFound } from "next/navigation";
import { screenMetadata } from "@/components/brand/screen-placeholder";
import { SurveySend } from "@/features/surveys/components/survey-send";
import { surveysFixture } from "@/features/surveys/surveys.fixture";

export const metadata = screenMetadata("M9");

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const survey = surveysFixture.find((row) => row.id === Number(id));
  if (!survey) notFound();
  return <SurveySend survey={survey} />;
}
