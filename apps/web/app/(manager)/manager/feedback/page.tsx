import { screenMetadata } from "@/components/brand/screen-placeholder";
import { FeedbackInbox } from "@/features/feedback/components/feedback-inbox";

export const metadata = screenMetadata("M5");

export default function Page() {
  return <FeedbackInbox />;
}
