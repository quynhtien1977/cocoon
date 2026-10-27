import { FeedbackDetailPage } from "@/features/customer/feedback-detail-page";

export const metadata = { title: "Chi tiết phản hồi | Cocoon" };

export default async function Page({ params, searchParams }: PageProps<"/account/feedback/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const preview = query.preview === "1";
  return <FeedbackDetailPage key={`${id}:${preview}`} id={id} preview={preview} />;
}
