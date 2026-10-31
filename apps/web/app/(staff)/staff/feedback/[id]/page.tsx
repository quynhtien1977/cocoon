import { notFound } from "next/navigation";
import { screenMetadata } from "@/components/brand/screen-placeholder";
import { StaffFeedbackReply } from "@/features/feedback/components/staff-feedback-reply";
import { currentStaffFixture, feedbackDetailFixture } from "@/features/feedback/feedback.fixture";

export const metadata = screenMetadata("S2");

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const feedback = feedbackDetailFixture(Number(id));
  // Staff only reach feedback assigned to them.
  if (!feedback || feedback.assigneeName !== currentStaffFixture.name) notFound();
  return <StaffFeedbackReply key={id} initial={feedback} />;
}
