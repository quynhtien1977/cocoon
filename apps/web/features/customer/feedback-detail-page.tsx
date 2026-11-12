"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CircleCheck, Clock, LoaderCircle, MessageSquare, Send, ShoppingBag } from "lucide-react";
import { ConfirmDialog } from "../../components/brand/confirm-dialog";
import { FeedbackThread } from "../../components/brand/feedback-thread";
import { RatingInput } from "../../components/brand/rating-input";
import { StatusBadge } from "../../components/brand/status-badge";
import { cn } from "../../lib/utils";
import {
  closeFeedback,
  closeFeedbackError,
  editFeedback,
  editFeedbackError,
  feedbackDetailError,
  followUpError,
  loadFeedbackDetail,
  sendFollowUp,
  type FeedbackDetail,
} from "./feedback-detail-service";

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value));

export function FeedbackDetailPage({ id, preview = false }: { id: string; preview?: boolean }) {
  const [detail, setDetail] = useState<FeedbackDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [failedImage, setFailedImage] = useState<string | null>(null);

  // Follow-up state
  const [followUpContent, setFollowUpContent] = useState("");
  const [followUpErrorMsg, setFollowUpErrorMsg] = useState("");
  const [followUpPending, setFollowUpPending] = useState(false);
  const [followUpNotice, setFollowUpNotice] = useState<string | null>(null);

  // Edit review state
  const [isEditing, setIsEditing] = useState(false);
  const [editRating, setEditRating] = useState(5);
  const [editContent, setEditContent] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editPending, setEditPending] = useState(false);
  const [editNotice, setEditNotice] = useState<string | null>(null);
  const [ratingConfirmOpen, setRatingConfirmOpen] = useState(false);

  // Self-close state
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [closeNotice, setCloseNotice] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    loadFeedbackDetail(id, preview, AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]))
      .then(value => {
        if (!controller.signal.aborted) {
          setDetail(value);
          setEditRating(value.rating);
          setEditContent(value.content);
        }
      })
      .catch(reason => { if (!controller.signal.aborted) setError(feedbackDetailError(reason)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, preview, attempt]);

  function handleStartEdit() {
    if (!detail) return;
    setIsEditing(true);
    setEditRating(detail.rating);
    setEditContent(detail.content);
    setEditError(null);
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!detail) return;
    const content = editContent.trim();
    if (content.length < 20) {
      setEditError("Nội dung phản hồi cần từ 20 đến 1.000 ký tự.");
      return;
    }
    if (content.length > 1000) {
      setEditError("Nội dung phản hồi tối đa 1.000 ký tự.");
      return;
    }
    setEditError(null);

    const ratingChanged = editRating !== detail.rating;
    if (ratingChanged) {
      setRatingConfirmOpen(true);
    } else {
      await executeSaveEdit();
    }
  }

  async function executeSaveEdit() {
    if (!detail) return;
    const content = editContent.trim();
    const ratingChanged = editRating !== detail.rating;
    const contentChanged = content !== detail.content;
    setEditPending(true);
    setEditError(null);
    try {
      if (preview) {
        setDetail((curr) => curr ? {
          ...curr,
          rating: editRating,
          content,
          edits: {
            originalRating: ratingChanged ? (curr.edits?.originalRating ?? curr.rating) : (curr.edits?.originalRating ?? null),
            ratingEditedAt: ratingChanged ? new Date().toISOString() : (curr.edits?.ratingEditedAt ?? null),
            contentEditedAt: contentChanged ? new Date().toISOString() : (curr.edits?.contentEditedAt ?? null),
          },
          canEditRating: ratingChanged ? false : curr.canEditRating,
        } : null);
        setIsEditing(false);
        setEditNotice("Đã cập nhật đánh giá thành công.");
      } else {
        await editFeedback(detail.id, editRating, content);
        setDetail((curr) => curr ? {
          ...curr,
          rating: editRating,
          content,
          edits: {
            originalRating: ratingChanged ? (curr.edits?.originalRating ?? curr.rating) : (curr.edits?.originalRating ?? null),
            ratingEditedAt: ratingChanged ? new Date().toISOString() : (curr.edits?.ratingEditedAt ?? null),
            contentEditedAt: contentChanged ? new Date().toISOString() : (curr.edits?.contentEditedAt ?? null),
          },
          canEditRating: ratingChanged ? false : curr.canEditRating,
        } : null);
        setIsEditing(false);
        setEditNotice("Đã cập nhật đánh giá thành công.");
      }
    } catch (err) {
      setEditError(editFeedbackError(err));
    } finally {
      setEditPending(false);
    }
  }

  async function handleCloseFeedback() {
    if (!detail) return;
    try {
      if (preview) {
        setDetail((curr) => curr ? {
          ...curr,
          status: "Closed",
          canClose: false,
          canFollowUp: false,
          canEditContent: false,
          autoCloseAt: null,
        } : null);
        setCloseNotice("Bạn đã hoàn tất cuộc trao đổi. Cảm ơn bạn đã phản hồi cùng Cocoon!");
      } else {
        await closeFeedback(detail.id);
        setDetail((curr) => curr ? {
          ...curr,
          status: "Closed",
          canClose: false,
          canFollowUp: false,
          canEditContent: false,
          autoCloseAt: null,
        } : null);
        setCloseNotice("Bạn đã hoàn tất cuộc trao đổi. Cảm ơn bạn đã phản hồi cùng Cocoon!");
      }
    } catch (err) {
      setEditError(closeFeedbackError(err));
      throw err;
    }
  }

  async function handleFollowUpSubmit(e: React.FormEvent) {
    e.preventDefault();
    const content = followUpContent.trim();
    if (content.length < 20) {
      setFollowUpErrorMsg("Nội dung ý kiến cần từ 20 đến 1.000 ký tự.");
      return;
    }
    if (content.length > 1000) {
      setFollowUpErrorMsg("Nội dung ý kiến tối đa 1.000 ký tự.");
      return;
    }
    setFollowUpErrorMsg("");
    setFollowUpPending(true);
    try {
      if (preview) {
        setDetail((curr) => curr ? {
          ...curr,
          status: "Assigned",
          canFollowUp: false,
          autoCloseAt: null,
          followUp: { content, createdAt: new Date().toISOString() },
        } : null);
        setFollowUpNotice("Cocoon đã nhận được ý kiến của bạn.");
        setFollowUpContent("");
      } else {
        await sendFollowUp(detail!.id, content);
        setDetail((curr) => curr ? {
          ...curr,
          status: "Assigned",
          canFollowUp: false,
          autoCloseAt: null,
          followUp: { content, createdAt: new Date().toISOString() },
        } : null);
        setFollowUpNotice("Cocoon đã nhận được ý kiến của bạn và sẽ phản hồi trong thời gian sớm nhất.");
        setFollowUpContent("");
      }
    } catch (err) {
      setFollowUpErrorMsg(followUpError(err));
    } finally {
      setFollowUpPending(false);
    }
  }

  const editFormElement = detail ? (
    <section aria-label="Chỉnh sửa đánh giá" className="rounded border border-[#c4ad83] bg-[#fffcf7] p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4dbc9] pb-4">
        <div>
          <h2 className="font-heading text-xl text-[#302b23]">Chỉnh sửa đánh giá</h2>
          <p className="mt-1 text-xs text-[#887c68]">Cập nhật nhận xét hoặc số sao cho sản phẩm.</p>
        </div>
        <button type="button" onClick={() => setIsEditing(false)} className="text-xs text-[#81745e] hover:underline">
          Hủy
        </button>
      </div>

      <form onSubmit={handleEditSubmit} noValidate className="mt-5 space-y-5">
        <div>
          <RatingInput
            label="Đánh giá số sao"
            value={editRating}
            disabled={!detail.canEditRating}
            onValueChange={(val) => setEditRating(val)}
          />
          {detail.canEditRating ? (
            <p className="mt-1.5 text-xs text-[#826438]">
              Bạn được sửa số sao một lần{detail.ratingEditableUntil && `, đến ${formatDateTime(detail.ratingEditableUntil)}`}.
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-[#81745e]">
              {detail.edits?.originalRating != null ? "Bạn đã sửa số sao một lần cho đánh giá này." : "Đã hết thời hạn sửa số sao."}
            </p>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <label htmlFor="edit-content" className="text-xs font-semibold uppercase tracking-wide text-[#977c4d]">
              Nội dung nhận xét <span className="text-red-500">*</span>
            </label>
            <span className="text-xs tabular-nums text-[#887c68]">
              {editContent.trim().length}/1.000 ký tự
            </span>
          </div>
          <textarea
            id="edit-content"
            value={editContent}
            disabled={!detail.canEditContent}
            onChange={(e) => {
              setEditContent(e.target.value);
              if (editError) setEditError(null);
            }}
            rows={4}
            maxLength={1000}
            placeholder="Chia sẻ cảm nhận của bạn (từ 20 đến 1.000 ký tự)…"
            className={cn(
              "w-full rounded border border-[#d7c9af] p-3 text-sm focus:border-[#806439] focus:outline-none",
              !detail.canEditContent ? "cursor-not-allowed bg-[#f5f0e6] text-[#81745e]" : "bg-white"
            )}
            aria-invalid={Boolean(editError)}
            aria-describedby={editError ? "edit-error" : undefined}
          />
          {!detail.canEditContent && (
            <p className="mt-1 text-xs text-[#81745e]">
              {detail.status === "Closed"
                ? "Phản hồi đã đóng nên không sửa được nội dung."
                : "Cocoon đã trả lời, bạn có thể gửi thêm ý kiến."}
            </p>
          )}
          {editError && (
            <p id="edit-error" role="alert" className="mt-1 text-sm text-red-600">
              {editError}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            disabled={editPending}
            onClick={() => setIsEditing(false)}
            className="min-h-10 rounded border border-[#d7c9af] px-4 py-2 text-sm text-[#81745e] hover:bg-[#eee7d5]"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={editPending}
            className="inline-flex min-h-10 items-center gap-2 rounded bg-[#806439] px-6 py-2 text-sm font-semibold text-white hover:bg-[#69522e] disabled:opacity-50"
          >
            {editPending ? "Đang lưu…" : "Lưu thay đổi"}
          </button>
        </div>
      </form>
    </section>
  ) : null;

  return <div className="pb-8 text-[#302b23]">
    <Link href={`/account/orders?tab=reviewed${preview ? "&preview=1" : ""}`} className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm text-[#806439] hover:underline"><ArrowLeft size={17} />Quay lại đơn hàng đã đánh giá</Link>
    <header className="mb-8"><p className="font-label text-sm uppercase tracking-widest text-[#977c4d]">Cocoon lắng nghe bạn</p><h1 className="mt-3 font-heading text-4xl sm:text-5xl">Chi tiết phản hồi</h1><p className="mt-3 text-sm leading-7 text-[#887c68]">Cảm nhận của bạn và những lời hồi đáp từ Cocoon, trong cùng một cuộc trò chuyện.</p></header>
    {preview && <aside className="mb-6 rounded border border-[#dcc9a5] bg-[#eee7d5] p-4 text-sm leading-6 text-[#7e6946]"><strong>Giao diện mẫu</strong> · Đánh giá và câu trả lời dưới đây chỉ để minh họa, không phải phản hồi thực tế của bạn.</aside>}
    {loading ? <p role="status" className="flex min-h-48 items-center justify-center gap-3 text-[#81745e]"><LoaderCircle className="motion-safe:animate-spin" size={20} />Đang tải phản hồi…</p> : error ? <div className="grid justify-items-center gap-4 rounded border border-dashed border-[#d7c9af] p-8 text-center"><MessageSquare size={32} className="text-[#977c4d]" /><h2 className="font-heading text-2xl">Chưa thể hiển thị phản hồi</h2><p role="alert" className="text-sm text-[#81745e]">{error}</p><button type="button" onClick={() => { setError(""); setLoading(true); setAttempt(value => value + 1); }} className="min-h-11 border border-[#a18b66] px-6 py-3 text-sm">Thử lại</button></div> : detail && <div className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="min-w-0 rounded border border-[#e4dbc9] bg-[#fffcf7] p-6">
        <div className="mb-6 grid aspect-square place-items-center bg-[#f1ecdf] text-[#b4a58a]">{detail.product.imageUrl && failedImage !== detail.product.imageUrl ? (
          // API media hosts are not known yet; use a native image with a fallback.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={detail.product.imageUrl} alt={detail.product.name} width={240} height={240} className="h-full w-full object-contain" onError={() => setFailedImage(detail.product.imageUrl)} />
        ) : <ShoppingBag size={40} aria-label="Chưa có ảnh sản phẩm" />}</div>
        <p className="text-xs uppercase tracking-wide text-[#977c4d]">Sản phẩm đã đánh giá</p><h2 className="mt-3 break-words font-heading text-2xl">{detail.product.name}</h2><p className="mt-2 text-sm text-[#887c68]">{detail.product.variant}</p>
        <dl className="my-6 grid gap-3 border-t border-[#e4dbc9] pt-6 text-sm"><div className="flex flex-wrap justify-between gap-2"><dt className="text-[#887c68]">Đơn hàng</dt><dd>{detail.orderCode || "—"}</dd></div><div className="flex justify-between gap-2"><dt className="text-[#887c68]">Mã phản hồi</dt><dd>#{detail.id}</dd></div></dl><StatusBadge kind="feedback" status={detail.status} />
      </aside>
      <div className="grid min-w-0 gap-6">
        <FeedbackThread
          rating={detail.rating}
          content={detail.content}
          createdAt={detail.createdAt}
          replies={detail.replies}
          followUp={detail.followUp}
          edits={detail.edits}
          canEdit={Boolean(detail.canEditRating || detail.canEditContent)}
          onEdit={handleStartEdit}
          isEditing={isEditing}
          editForm={editFormElement}
        />
        {detail.status === "Replied" && detail.autoCloseAt && (
          <div className="flex items-center gap-2 rounded-md border border-[#dcc9a5] bg-[#fbf8f2] p-4 text-sm text-[#826438]">
            <Clock size={18} className="shrink-0 text-[#977c4d]" aria-hidden="true" />
            <span>Thời hạn gửi thêm câu hỏi đến {formatDateTime(detail.autoCloseAt)}</span>
          </div>
        )}
        <div aria-live="polite" className="space-y-3">
          {editNotice && (
            <p className="flex items-center gap-2 rounded-md border border-[#c2d7b5] bg-[#f2f7ef] p-4 text-sm text-[#3d652f]">
              <CircleCheck size={18} className="shrink-0" aria-hidden="true" />
              {editNotice}
            </p>
          )}
          {closeNotice && (
            <p className="flex items-center gap-2 rounded-md border border-[#c2d7b5] bg-[#f2f7ef] p-4 text-sm text-[#3d652f]">
              <CircleCheck size={18} className="shrink-0" aria-hidden="true" />
              {closeNotice}
            </p>
          )}
          {followUpNotice && (
            <p className="flex items-center gap-2 rounded-md border border-[#c2d7b5] bg-[#f2f7ef] p-4 text-sm text-[#3d652f]">
              <CircleCheck size={18} className="shrink-0" aria-hidden="true" />
              {followUpNotice}
            </p>
          )}
        </div>
        {detail.canFollowUp && (
          <section aria-label="Gửi thêm ý kiến" className="rounded border border-[#e4dbc9] bg-[#fffcf7] p-4 sm:p-6">
            <h2 className="font-heading text-xl text-[#302b23]">Gửi thêm ý kiến</h2>
            <p className="mt-2 text-sm text-[#887c68]">
              Bạn có thể gửi thêm ý kiến hoặc câu hỏi nếu cần Cocoon hỗ trợ thêm.
            </p>
            <form onSubmit={handleFollowUpSubmit} noValidate className="mt-4 space-y-4">
              <div>
                <div className="mb-2 flex items-baseline justify-between">
                  <label htmlFor="follow-up-content" className="text-xs font-semibold uppercase tracking-wide text-[#977c4d]">
                    Nội dung ý kiến <span className="text-red-500">*</span>
                  </label>
                  <span className="text-xs tabular-nums text-[#887c68]">
                    {followUpContent.trim().length}/1.000 ký tự
                  </span>
                </div>
                <textarea
                  id="follow-up-content"
                  value={followUpContent}
                  onChange={(e) => {
                    setFollowUpContent(e.target.value);
                    if (followUpErrorMsg) setFollowUpErrorMsg("");
                  }}
                  rows={4}
                  maxLength={1000}
                  placeholder="Nhập nội dung bạn muốn chia sẻ thêm với Cocoon (từ 20 đến 1.000 ký tự)…"
                  className="w-full rounded border border-[#d7c9af] bg-white p-3 text-sm focus:border-[#806439] focus:outline-none"
                  aria-invalid={Boolean(followUpErrorMsg)}
                  aria-describedby={followUpErrorMsg ? "follow-up-error" : undefined}
                />
                {followUpErrorMsg && (
                  <p id="follow-up-error" role="alert" className="mt-1 text-sm text-red-600">
                    {followUpErrorMsg}
                  </p>
                )}
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={followUpPending}
                  className="inline-flex min-h-11 items-center gap-2 rounded bg-[#806439] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#69522e] disabled:opacity-50"
                >
                  <Send size={16} aria-hidden="true" />
                  {followUpPending ? "Đang gửi…" : "Gửi ý kiến"}
                </button>
              </div>
            </form>
          </section>
        )}
        {detail.canClose && (
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setCloseConfirmOpen(true)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded border border-[#d7c9af] bg-[#fffcf7] px-4 py-2 text-xs font-semibold text-[#806439] hover:bg-[#eee7d5]"
            >
              Tôi không cần hỗ trợ thêm
            </button>
          </div>
        )}
      </div>
    </div>}

    {detail && (
      <>
        <ConfirmDialog
          open={ratingConfirmOpen}
          onOpenChange={setRatingConfirmOpen}
          appearance="soft"
          portal="customer"
          title="Xác nhận đổi số sao"
          description={`Bạn chỉ được sửa số sao một lần duy nhất cho đánh giá này. Bạn có chắc chắn muốn đổi sang ${editRating} sao không?`}
          confirmLabel="Xác nhận lưu"
          cancelLabel="Hủy"
          pendingLabel="Đang lưu…"
          onConfirm={executeSaveEdit}
        />

        <ConfirmDialog
          open={closeConfirmOpen}
          onOpenChange={setCloseConfirmOpen}
          appearance="soft"
          portal="customer"
          title="Đóng cuộc trao đổi"
          description="Bạn có chắc chắn muốn hoàn tất cuộc trao đổi này không? Đánh giá của bạn vẫn được giữ lại."
          confirmLabel="Xác nhận đóng"
          cancelLabel="Tiếp tục trao đổi"
          pendingLabel="Đang xử lý…"
          onConfirm={handleCloseFeedback}
        />
      </>
    )}
  </div>;
}
