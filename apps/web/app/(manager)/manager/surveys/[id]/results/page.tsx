import { notFound } from "next/navigation";
import { screenMetadata } from "@/components/brand/screen-placeholder";
import { SurveyResultsPage } from "@/features/surveys/components/survey-results";

export const metadata = screenMetadata("M10");

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[1-9]\d{0,9}$/.test(id) || Number(id) > 2147483647) notFound();
  return <SurveyResultsPage key={id} id={Number(id)} />;
}
