import { notFound } from "next/navigation";
import { screenMetadata } from "@/components/brand/screen-placeholder";
import { FeedbackProcessingPage } from "@/features/feedback/components/feedback-processing";

export const metadata = screenMetadata("M6");

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <FeedbackProcessingPage key={id} id={Number(id)} />;
}
