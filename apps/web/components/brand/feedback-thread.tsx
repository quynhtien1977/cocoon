import { MessageSquare, UserRound } from "lucide-react";
import { RatingStars } from "./rating-stars";

export type FeedbackThreadProps = {
  rating: number;
  content: string;
  createdAt: string;
  replies: { id: number; staffName: string; content: string; createdAt: string; round?: number }[];
  followUp?: { content: string; createdAt: string } | null;
  edits?: { originalRating: number | null; ratingEditedAt: string | null; contentEditedAt: string | null } | null;
  canEdit?: boolean;
  onEdit?: () => void;
  isEditing?: boolean;
  editForm?: React.ReactNode;
  /** Photos the customer attached; urls are API paths that check access, so they load with the session cookie. */
  photos?: { id: number; url: string }[];
  /** Back-office screens name the customer; the defaults address the customer on C5. */
  customerHeading?: string;
  emptyReplies?: string;
};
const date = (value: string) => new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value));

export function FeedbackThread({ rating, content, createdAt, replies, followUp, edits, photos = [], canEdit, onEdit, isEditing, editForm, customerHeading = "Đánh giá của bạn", emptyReplies = "Cocoon đã nhận được đánh giá của bạn. Khi nhân viên trả lời, nội dung sẽ được hiển thị tại đây." }: FeedbackThreadProps) {
  const round1Replies = replies.filter(r => (r.round ?? 1) === 1);
  const round2Replies = replies.filter(r => r.round === 2);

  return <div className="grid min-w-0 gap-6">
    {isEditing && editForm ? editForm : (
      <section aria-label="Phản hồi của khách hàng" className="rounded border border-[#e4dbc9] bg-[#fffcf7] p-4 sm:p-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-[#eee6d5] text-[#826438]"><UserRound size={20} aria-hidden="true" /></span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-heading text-xl">{customerHeading}</h2>
                {edits?.contentEditedAt && <span className="rounded bg-[#eee6d5] px-2 py-0.5 text-xs text-[#826438]">Đã chỉnh sửa</span>}
              </div>
              <time dateTime={createdAt} className="text-xs text-[#81745e]">{date(createdAt)}</time>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {canEdit && onEdit && (
              <button type="button" onClick={onEdit} className="inline-flex min-h-8 items-center gap-1 rounded border border-[#a18b66] px-3 py-1 text-xs font-semibold text-[#806439] hover:bg-[#eee7d5]">
                Sửa đánh giá
              </button>
            )}
            {edits?.originalRating != null && <span className="text-xs text-[#81745e]">Đã sửa từ {edits.originalRating}★</span>}
            <RatingStars value={rating} />
          </div>
        </header>
        <p className="mt-6 whitespace-pre-wrap break-words text-base leading-8 text-[#514837]">{content}</p>
        {photos.length > 0 && <ul aria-label={`Ảnh đính kèm (${photos.length})`} className="mt-4 flex flex-wrap gap-3">
          {photos.map((photo, index) => <li key={photo.id}>
            <a href={photo.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded border border-[#e4dbc9] focus-visible:outline-2 focus-visible:outline-[#81916c]">
              {/* eslint-disable-next-line @next/next/no-img-element -- photos are access-checked API responses, not optimizable assets */}
              <img src={photo.url} alt={`Ảnh đính kèm ${index + 1}`} width={112} height={112} loading="lazy" decoding="async" className="size-28 object-cover" />
            </a>
          </li>)}
        </ul>}
      </section>
    )}
    <section aria-label="Phản hồi của nhân viên" className="rounded border border-[#e4dbc9] bg-[#f5f0e6] p-4 sm:p-6">
      <h2 className="flex items-center gap-3 font-heading text-2xl"><MessageSquare size={22} strokeWidth={1.5} aria-hidden="true" />Phản hồi từ Cocoon</h2>
      {round1Replies.length ? <ol className="mt-6 grid gap-6">
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
      </ol> : <p className="mt-4 text-sm leading-7 text-[#81745e]">{emptyReplies}</p>}
    </section>
    {followUp && (
      <section aria-label="Ý kiến bổ sung của khách hàng" className="rounded border border-[#e4dbc9] bg-[#fffcf7] p-4 sm:p-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-[#eee6d5] text-[#826438]"><UserRound size={20} aria-hidden="true" /></span>
            <div>
              <h2 className="font-heading text-xl">{customerHeading === "Đánh giá của bạn" ? "Ý kiến bổ sung của bạn" : "Ý kiến bổ sung của khách hàng"}</h2>
              <time dateTime={followUp.createdAt} className="text-xs text-[#81745e]">{date(followUp.createdAt)}</time>
            </div>
          </div>
        </header>
        <p className="mt-6 whitespace-pre-wrap break-words text-base leading-8 text-[#514837]">{followUp.content}</p>
      </section>
    )}
    {round2Replies.length > 0 && (
      <section aria-label="Giải đáp từ Cocoon" className="rounded border border-[#e4dbc9] bg-[#f5f0e6] p-4 sm:p-6">
        <h2 className="flex items-center gap-3 font-heading text-2xl"><MessageSquare size={22} strokeWidth={1.5} aria-hidden="true" />Giải đáp từ Cocoon</h2>
        <ol className="mt-6 grid gap-6">
          {round2Replies.map(reply => (
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
        </ol>
      </section>
    )}
  </div>;
}
