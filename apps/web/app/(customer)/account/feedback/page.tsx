import type { Metadata } from "next";
import { MyFeedbackPage } from "@/features/customer/my-feedback-page";

export const metadata: Metadata = {
  title: "Phản hồi của tôi | Cocoon",
};

export default function Page() {
  return <MyFeedbackPage />;
}
