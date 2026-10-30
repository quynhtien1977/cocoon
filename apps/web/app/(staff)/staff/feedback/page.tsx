import { screenMetadata } from "@/components/brand/screen-placeholder";
import { StaffFeedbackList } from "@/features/feedback/components/staff-feedback-list";

export const metadata = screenMetadata("S1");

export default function Page() {
  return <StaffFeedbackList />;
}
