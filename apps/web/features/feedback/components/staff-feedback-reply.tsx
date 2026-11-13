"use client";

import { useCallback, useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, CircleCheck, Info, Send } from "lucide-react";
import { FeedbackThread } from "@/components/brand/feedback-thread";
import { PageHeader } from "@/components/brand/page-header";
import { StatusBadge } from "@/components/brand/status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { loadFeedbackDetail, replyToFeedback } from "../api";
import { REPLY_MAX, validateReply } from "../schemas";
import type { FeedbackDetail, FeedbackStatus } from "../types";
import { useApiData } from "@/lib/api/use-api-data";
import { caseCard, CustomerSummary, FeedbackTimeline, OrderProductSummary } from "./feedback-case";
import { FeedbackLoadState } from "./feedback-load-state";

export function StaffFeedbackReply({ initial }: { initial: FeedbackDetail }) {
  const id = useId();
  const [feedback, setFeedback] = useState(initial);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found = validateReply(content);
    setError(found);
    if (found || pending) return;
    setPending(true);
    try {
      const reply = await replyToFeedback(feedback.id, content);
      const nextStatus: FeedbackStatus = reply.round === 2 ? "Closed" : "Replied";
      setFeedback((current) => ({
        ...current,
        status: nextStatus,
        statusTimes: { ...current.statusTimes, [nextStatus]: reply.createdAt },
        replies: [...current.replies, reply],
      }));
      setContent("");
      setSent(true);
    } catch (reason) {
      setError(reason instanceof Error && reason.message ? reason.message : "Chưa gửi được câu trả lời. Hãy thử lại.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Link href="/staff/feedback" className="mb-3 inline-flex min-h-12 items-center gap-1 font-label text-sm uppercase tracking-wider text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden="true" />Phản hồi được giao</Link>
      <PageHeader title={`Xử lý phản hồi khách hàng #${feedback.id}`} description={`${feedback.customerName}${feedback.orderCode ? ` · Đơn #${feedback.orderCode}` : ""}`} actions={<StatusBadge kind="feedback" status={feedback.status} />} />
      <div aria-live="polite">
        {sent && (
          <p className="mb-6 flex items-center gap-2 rounded-md border border-border bg-status-sage-bg p-3 text-sm text-status-sage-fg">
            <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
            {feedback.status === "Closed"
              ? "Đã gửi câu trả lời đến khách hàng thành công! Hoàn tất phản hồi."
              : "Đã gửi câu trả lời đến khách hàng thành công."}
          </p>
        )}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <FeedbackTimeline status={feedback.status} times={feedback.statusTimes} />
          <FeedbackThread rating={feedback.rating} content={feedback.content} createdAt={feedback.createdAt} replies={feedback.replies} followUp={feedback.followUp} edits={feedback.edits} customerHeading={`Phản hồi của ${feedback.customerName}`} emptyReplies="Bạn chưa trả lời phản hồi này." />
          {feedback.status === "Assigned" && (
            <>
              {feedback.followUp && (
                <div className={cn(caseCard, "border-gold bg-status-beige-bg")}>
                  <h3 className="font-heading text-lg font-semibold text-gold-strong">
                    Khách hàng gửi thêm ý kiến phản hồi
                  </h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                    {feedback.followUp.content}
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Sau khi bạn gửi câu trả lời, phản hồi sẽ được hoàn tất và đóng lại.
                  </p>
                </div>
              )}
              <form onSubmit={submit} noValidate aria-labelledby={`${id}-title`} className={caseCard}>
                <h2 id={`${id}-title`} className="border-b border-border pb-3 font-heading text-xl">Soạn câu trả lời gửi khách hàng</h2>
                <div className="mt-4 space-y-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <label htmlFor={`${id}-content`} className="font-label text-sm uppercase tracking-wider">Câu trả lời <span aria-hidden="true" className="text-destructive">*</span></label>
                    <span id={`${id}-count`} className="text-xs tabular-nums text-muted-foreground">{content.trim().length}/{REPLY_MAX} ký tự</span>
                  </div>
                  <textarea id={`${id}-content`} value={content} onChange={(event) => { setContent(event.target.value); if (error) setError(null); }} rows={6} maxLength={REPLY_MAX} required placeholder="Nhập nội dung trả lời khách hàng…"
                    aria-invalid={!!error} aria-describedby={error ? `${id}-count ${id}-error` : `${id}-count`} className="w-full rounded-md border border-input bg-background p-3 text-sm focus-visible:outline-2 focus-visible:outline-ring aria-invalid:border-destructive" />
                  {error && <p id={`${id}-error`} className="text-sm text-destructive">{error}</p>}
                </div>
                <p className="mt-4 flex gap-2 rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground"><Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />Trả lời lịch sự, đúng trọng tâm. Không tự ý cam kết lịch ra mắt sản phẩm hoặc cung cấp thông tin kỹ thuật nội bộ.</p>
                <div className="mt-4 flex flex-wrap justify-end gap-3 border-t border-border pt-4">
                  <Button type="button" variant="outline" className="h-12 flex-1 px-6 sm:flex-none" onClick={() => { setContent(""); setError(null); }}>Xóa nội dung</Button>
                  <Button type="submit" disabled={pending} className="h-12 flex-1 px-6 sm:flex-none"><Send aria-hidden="true" />{pending ? "Đang gửi…" : "Gửi trả lời"}</Button>
                </div>
              </form>
            </>
          )}
        </div>
        <div className="min-w-0 space-y-6">
          <CustomerSummary feedback={feedback} />
          <OrderProductSummary feedback={feedback} />
        </div>
      </div>
    </>
  );
}

export function StaffFeedbackReplyPage({ id }: { id: number }) {
  const load = useCallback((signal: AbortSignal) => loadFeedbackDetail(id, signal), [id]);
  const { data, loading, error, missing, retry } = useApiData(load, "Chưa tải được phản hồi. Kiểm tra kết nối rồi thử lại.");
  if (!data) return <FeedbackLoadState loading={loading} missing={missing} error={error} onRetry={retry} backHref="/staff/feedback" />;
  return <StaffFeedbackReply initial={data} />;
}
