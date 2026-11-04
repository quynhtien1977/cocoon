import type { Metadata } from "next";
import { SurveyResponsePage } from "@/features/customer/survey-response-page";

export const metadata: Metadata = { title: "Chia sẻ cùng Cocoon | Khảo sát" };

export default async function Page({ params, searchParams }: PageProps<"/account/surveys/[id]">) {
  const { id } = await params;
  const preview = (await searchParams).preview === "1";
  return <SurveyResponsePage key={`${id}:${preview}`} id={id} preview={preview} />;
}
