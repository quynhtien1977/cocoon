import { MessageSquare, UserRound } from "lucide-react";
import { RatingStars } from "./rating-stars";

export type FeedbackThreadProps = {
  rating: number;
  content: string;
  createdAt: string;
  replies: { id: number; staffName: string; content: string; createdAt: string; round?: number }[];
  followUp?: { content: string; createdAt: string } | null;
  /** Back-office screens name the customer; the defaults address the customer on C5. */
  customerHeading?: string;
  emptyReplies?: string;
};
const date = (value: string) => new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value));

export function FeedbackThread({ rating, content, createdAt, replies, followUp, customerHeading = "Đánh giá của bạn", emptyReplies = "Cocoon đã nhận được đánh giá của bạn. Khi nhân viên trả lời, nội dung sẽ được hiển thị tại đây." }: FeedbackThreadProps) {
  const round1Replies = replies.filter(r => (r.round ?? 1) === 1);
  const round2Replies = replies.filter(r => r.round === 2);

  return <div className="grid min-w-0 gap-6">
    <section aria-label="Phản hồi của khách hàng" className="rounded border border-[#e4dbc9] bg-[#fffcf7] p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-[#eee6d5] text-[#826438]"><UserRound size={20} aria-hidden="true" /></span><div><h2 className="font-heading text-xl">{customerHeading}</h2><time dateTime={createdAt} className="text-xs text-[#81745e]">{date(createdAt)}</time></div></div><RatingStars value={rating} /></header>
      <p className="mt-6 whitespace-pre-wrap break-words text-base leading-8 text-[#514837]">{content}</p>
    </section>
    <section aria-label="Phản hồi của nhân viên" className="rounded border border-[#e4dbc9] bg-[#f5f0e6] p-4 sm:p-6">
      <h2 className="flex items-center gap-3 font-heading text-2xl"><MessageSquare size={22} strokeWidth={1.5} aria-hidden="true" />Phản hồi từ Cocoon</h2>
      {replies.length ? <ol className="mt-6 grid gap-6">
        {round1Replies.map(reply => (
          <li key={reply.id} className="border-l-2 border-[#c4ad83] pl-4 sm:pl-6">
            <article>
              <header className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-[#695631]">{reply.staffName}</h3>
                <time dateTime={reply.createdAt} className="text-xs text-[#81745e]">{date(reply.createdAt)}</time>
              </header>
              <p className="mt-3 whitespace-pre-wrap break-words text-base leading-8 text-[#514837]">{reply.content}</p>
            </article>
          </li>
        ))}
        {followUp && (
          <li key="follow-up" className="rounded-md border border-[#e4dbc9] bg-[#fffcf7] p-4 sm:p-5">
            <article>
              <header className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="grid size-7 place-items-center rounded-full bg-[#eee6d5] text-[#826438]"><UserRound size={15} aria-hidden="true" /></span>
                  <h3 className="text-sm font-semibold text-[#826438]">{customerHeading === "Đánh giá của bạn" ? "Ý kiến bổ sung của bạn" : "Ý kiến bổ sung của khách hàng"}</h3>
                </div>
                <time dateTime={followUp.createdAt} className="text-xs text-[#81745e]">{date(followUp.createdAt)}</time>
              </header>
              <p className="mt-3 whitespace-pre-wrap break-words text-base leading-8 text-[#514837]">{followUp.content}</p>
            </article>
          </li>
        )}
        {round2Replies.map(reply => (
          <li key={reply.id} className="border-l-2 border-[#826438] pl-4 sm:pl-6">
            <article>
              <header className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-[#695631]">{reply.staffName}</h3>
                  <span className="rounded bg-[#e8dfcf] px-1.5 py-0.5 text-xs font-medium text-[#7d6740]">Trả lời lần 2</span>
                </div>
                <time dateTime={reply.createdAt} className="text-xs text-[#81745e]">{date(reply.createdAt)}</time>
              </header>
              <p className="mt-3 whitespace-pre-wrap break-words text-base leading-8 text-[#514837]">{reply.content}</p>
            </article>
          </li>
        ))}
      </ol> : <p className="mt-4 text-sm leading-7 text-[#81745e]">{emptyReplies}</p>}
    </section>
  </div>;
}
