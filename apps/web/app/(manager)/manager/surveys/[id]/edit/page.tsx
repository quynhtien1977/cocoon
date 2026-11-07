import { notFound } from "next/navigation";
import { screenMetadata } from "@/components/brand/screen-placeholder";
import { SurveyBuilderPage } from "@/features/surveys/components/survey-builder";

export const metadata = screenMetadata("M8");

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[1-9]\d{0,9}$/.test(id) || Number(id) > 2147483647) notFound();
  return <SurveyBuilderPage key={id} id={Number(id)} />;
}
