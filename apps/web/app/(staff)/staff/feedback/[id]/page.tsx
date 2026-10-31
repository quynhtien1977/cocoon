import { notFound } from "next/navigation";
import { screenMetadata } from "@/components/brand/screen-placeholder";
import { StaffFeedbackReplyPage } from "@/features/feedback/components/staff-feedback-reply";

export const metadata = screenMetadata("S2");

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <StaffFeedbackReplyPage key={id} id={Number(id)} />;
}
