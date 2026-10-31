import { notFound } from "next/navigation";
import { screenMetadata } from "@/components/brand/screen-placeholder";
import { FeedbackProcessing } from "@/features/feedback/components/feedback-processing";
import { feedbackDetailFixture } from "@/features/feedback/feedback.fixture";

export const metadata = screenMetadata("M6");

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const feedback = feedbackDetailFixture(Number(id));
  if (!feedback) notFound();
  return <FeedbackProcessing key={id} initial={feedback} />;
}
