import { MessageSquare, UserRound } from "lucide-react";
import { RatingStars } from "./rating-stars";

export type FeedbackThreadProps = {
  rating: number;
  content: string;
  createdAt: string;
  replies: { id: number; staffName: string; content: string; createdAt: string }[];
};
const date = (value: string) => new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value));

export function FeedbackThread({ rating, content, createdAt, replies }: FeedbackThreadProps) {
  return <div className="grid min-w-0 gap-6">
    <section aria-label="Phản hồi của khách hàng" className="rounded border border-[#e4dbc9] bg-[#fffcf7] p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-[#eee6d5] text-[#826438]"><UserRound size={20} aria-hidden="true" /></span><div><h2 className="font-heading text-xl">Đánh giá của bạn</h2><time dateTime={createdAt} className="text-xs text-[#81745e]">{date(createdAt)}</time></div></div><RatingStars value={rating} /></header>
      <p className="mt-6 whitespace-pre-wrap break-words text-base leading-8 text-[#514837]">{content}</p>
    </section>
    <section aria-label="Phản hồi của nhân viên" className="rounded border border-[#e4dbc9] bg-[#f5f0e6] p-4 sm:p-6">
      <h2 className="flex items-center gap-3 font-heading text-2xl"><MessageSquare size={22} strokeWidth={1.5} aria-hidden="true" />Phản hồi từ Cocoon</h2>
      {replies.length ? <ol className="mt-6 grid gap-6">{replies.map(reply => <li key={reply.id} className="border-l-2 border-[#c4ad83] pl-4 sm:pl-6"><article><header className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-sm font-semibold text-[#695631]">{reply.staffName}</h3><time dateTime={reply.createdAt} className="text-xs text-[#81745e]">{date(reply.createdAt)}</time></header><p className="mt-3 whitespace-pre-wrap break-words text-base leading-8 text-[#514837]">{reply.content}</p></article></li>)}</ol> : <p className="mt-4 text-sm leading-7 text-[#81745e]">Cocoon đã nhận được đánh giá của bạn. Khi nhân viên trả lời, nội dung sẽ được hiển thị tại đây.</p>}
    </section>
  </div>;
}
