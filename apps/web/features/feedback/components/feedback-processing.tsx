"use client";

import { useCallback, useId, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, CircleCheck, Lock, UserCheck } from "lucide-react";
import { ConfirmDialog } from "@/components/brand/confirm-dialog";
import { FeedbackThread } from "@/components/brand/feedback-thread";
import { PageHeader } from "@/components/brand/page-header";
import { StatusBadge } from "@/components/brand/status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { acceptFeedback, assignFeedback, closeFeedback, loadFeedbackDetail, loadStaff, setAutoClose } from "../api";
import type { FeedbackDetail, FeedbackStatus, StaffOption } from "../types";
import { useApiData } from "@/lib/api/use-api-data";
import { caseCard, CustomerSummary, FeedbackTimeline, OrderProductSummary } from "./feedback-case";
import { FeedbackLoadState } from "./feedback-load-state";

const dateTime = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
const actionClass = "h-12 px-4";

function closedByLabel(closedBy: FeedbackDetail["closedBy"], hasSecondReply: boolean) {
  if (closedBy === "Customer") return "Khách đóng phản hồi";
  if (closedBy === "SecondReply") return "Đóng sau câu trả lời lần 2";
  if (closedBy === "AutoClose") return "Tự đóng khi hết hạn";
  if (closedBy === "Manager") return "Quản lý đóng phản hồi";
  return hasSecondReply ? "Đóng sau câu trả lời lần 2" : "Quản lý đóng phản hồi";
}

/** M6 shows only the moves valid from the current status (spec: no disabled buttons standing in for an error). */
export function FeedbackProcessing({ initial, staff }: { initial: FeedbackDetail; staff: readonly StaffOption[] }) {
  const id = useId();
  const [feedback, setFeedback] = useState(initial);
  const [staffId, setStaffId] = useState(initial.assigneeId ?? staff[0]?.id ?? 0);
  const [notice, setNotice] = useState<string | null>(null);
  const [autoCloseDays, setAutoCloseDays] = useState(7);
  const [autoClosePending, setAutoClosePending] = useState(false);
  const [autoCloseError, setAutoCloseError] = useState<string | null>(null);
  const staffName = staff.find((item) => item.id === staffId)?.name ?? "";
  const { status } = feedback;

  // A failed request throws into ConfirmDialog, which keeps the dialog open and shows the API's message.
  function moved(next: FeedbackStatus, message: string, assignee?: StaffOption) {
    const at = new Date().toISOString();
    setFeedback((current) => ({ ...current, status: next, assigneeId: assignee?.id ?? current.assigneeId, assigneeName: assignee?.name ?? current.assigneeName, statusTimes: { ...current.statusTimes, [next]: at } }));
    setNotice(message);
  }

  async function handleAutoCloseUpdate() {
    if (autoCloseDays < 1 || autoCloseDays > 30) {
      setAutoCloseError("Thời hạn cần từ 1 đến 30 ngày.");
      return;
    }
    setAutoClosePending(true);
    setAutoCloseError(null);
    try {
      const res = await setAutoClose(feedback.id, autoCloseDays);
      setFeedback((current) => ({ ...current, autoCloseAt: res.autoCloseAt }));
      setNotice(`Đã cập nhật thời hạn đóng dự kiến thành ${dateTime.format(new Date(res.autoCloseAt))}.`);
    } catch (err) {
      setAutoCloseError(err instanceof Error && err.message ? err.message : "Chưa cập nhật được thời hạn đóng.");
    } finally {
      setAutoClosePending(false);
    }
  }

  return (
    <>
      <Link href="/manager/feedback" className="mb-3 inline-flex min-h-12 items-center gap-1 font-label text-sm uppercase tracking-wider text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden="true" />Hộp phản hồi</Link>
      <PageHeader title={`Xử lý phản hồi #${feedback.id}`} description={`${feedback.customerName}${feedback.orderCode ? ` · Đơn #${feedback.orderCode}` : ""}`} actions={<StatusBadge kind="feedback" status={status} />} />

      {status !== "Closed" && (
        <section aria-label="Thao tác điều phối" className={cn(caseCard, "mb-6 flex flex-wrap items-end gap-3")}>
          {status === "New" && (
            <ConfirmDialog portal="manager" title="Tiếp nhận phản hồi?" description={`Phản hồi #${feedback.id} của ${feedback.customerName} chuyển sang Đã tiếp nhận để chờ giao cho nhân viên.`} confirmLabel="Xác nhận tiếp nhận"
              trigger={<Button type="button" className={actionClass}><Check aria-hidden="true" />Tiếp nhận</Button>} onConfirm={async () => { await acceptFeedback(feedback.id); moved("Accepted", "Đã tiếp nhận phản hồi."); }} />
          )}
          {(status === "Accepted" || status === "Assigned") && staff.length === 0 && <p className="basis-full text-sm text-muted-foreground">Chưa giao được: hệ thống chưa có nhân viên đang hoạt động.</p>}
          {(status === "Accepted" || status === "Assigned") && staff.length > 0 && (
            <>
              <label htmlFor={`${id}-staff`} className="grid min-w-48 flex-1 gap-2 text-sm font-semibold sm:flex-none">Nhân viên phụ trách
                <select id={`${id}-staff`} value={staffId} onChange={(event) => setStaffId(Number(event.target.value))} className="min-h-12 w-full rounded-md border border-input bg-background px-3 text-sm font-normal focus-visible:outline-2 focus-visible:outline-ring">
                  {staff.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <ConfirmDialog portal="manager" title={status === "Assigned" ? "Giao lại phản hồi?" : "Giao phản hồi?"} description={`Phản hồi #${feedback.id} sẽ được giao cho ${staffName}. Nhân viên này sẽ thấy phản hồi trong danh sách được giao.`} confirmLabel="Xác nhận giao"
                trigger={<Button type="button" className={actionClass}><UserCheck aria-hidden="true" />{status === "Assigned" ? "Giao lại" : "Giao việc"}</Button>} onConfirm={async () => { await assignFeedback(feedback.id, staffId); moved("Assigned", `Đã giao phản hồi cho ${staffName}.`, { id: staffId, name: staffName }); }} />
            </>
          )}
          {(status === "Accepted" || status === "Replied") && (
            <ConfirmDialog portal="manager" title="Đóng phản hồi?" description={`Phản hồi #${feedback.id} sẽ chuyển sang Đã đóng và không xử lý tiếp được nữa.`} confirmLabel="Xác nhận đóng"
              trigger={<Button type="button" variant="outline" className={actionClass}><Lock aria-hidden="true" />Đóng phản hồi</Button>} onConfirm={async () => { await closeFeedback(feedback.id); setFeedback((current) => ({ ...current, closedBy: "Manager" })); moved("Closed", "Đã đóng phản hồi."); }} />
          )}
          {status === "Assigned" && <p className="basis-full text-sm text-muted-foreground">Đang chờ {feedback.assigneeName} trả lời khách.</p>}
          {status === "Replied" && (
            <div className="mt-2 flex basis-full flex-wrap items-end gap-3 border-t border-border pt-4">
              <div className="min-w-48 flex-1">
                <label htmlFor={`${id}-autoclose`} className="mb-1 block text-sm font-semibold">Đổi thời hạn đóng</label>
                {feedback.autoCloseAt && (
                  <p className="mb-2 text-xs text-muted-foreground">
                    Thời hạn đóng dự kiến: <time dateTime={feedback.autoCloseAt} className="font-medium text-foreground">{dateTime.format(new Date(feedback.autoCloseAt))}</time>
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <input
                    id={`${id}-autoclose`}
                    type="number"
                    min={1}
                    max={30}
                    value={autoCloseDays}
                    onChange={(e) => {
                      setAutoCloseDays(Number(e.target.value));
                      if (autoCloseError) setAutoCloseError(null);
                    }}
                    aria-describedby={autoCloseError ? `${id}-autoclose-hint ${id}-autoclose-error` : `${id}-autoclose-hint`}
                    aria-invalid={Boolean(autoCloseError)}
                    className="min-h-12 w-28 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring aria-invalid:border-destructive"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className={actionClass}
                    disabled={autoClosePending || autoCloseDays < 1 || autoCloseDays > 30}
                    onClick={handleAutoCloseUpdate}
                  >
                    {autoClosePending ? "Đang lưu…" : "Cập nhật"}
                  </Button>
                </div>
                {autoCloseError && (
                  <p id={`${id}-autoclose-error`} role="alert" className="mt-1.5 text-xs text-destructive">
                    {autoCloseError}
                  </p>
                )}
                <p id={`${id}-autoclose-hint`} className="mt-1.5 text-xs text-muted-foreground">
                  Số ngày tính từ thời điểm cập nhật (1–30 ngày)
                </p>
              </div>
            </div>
          )}
        </section>
      )}
      <div aria-live="polite">{notice && <p className="mb-6 flex items-center gap-2 rounded-md border border-border bg-status-sage-bg p-3 text-sm text-status-sage-fg"><CircleCheck className="size-4 shrink-0" aria-hidden="true" />{notice}</p>}</div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <FeedbackTimeline status={status} times={feedback.statusTimes} />
          <FeedbackThread rating={feedback.rating} content={feedback.content} createdAt={feedback.createdAt} replies={feedback.replies} followUp={feedback.followUp} edits={feedback.edits} customerHeading={`Phản hồi của ${feedback.customerName}`} emptyReplies="Chưa có câu trả lời nào cho khách." />
        </div>
        <div className="min-w-0 space-y-6">
          <CustomerSummary feedback={feedback} />
          <OrderProductSummary feedback={feedback} />
          <section aria-labelledby="history-title" className={caseCard}>
            <h2 id="history-title" className="border-b border-border pb-3 font-heading text-lg">Lịch sử điều phối</h2>
            <ol className="mt-3 space-y-3">
              {feedback.statusTimes.Closed && (
                <li className="text-sm">
                  <span className="block font-medium">
                    {closedByLabel(feedback.closedBy, feedback.replies.some((r) => r.round === 2))}
                  </span>
                  <time dateTime={feedback.statusTimes.Closed} className="text-xs text-muted-foreground">{dateTime.format(new Date(feedback.statusTimes.Closed))}</time>
                </li>
              )}
              {feedback.replies.filter((r) => r.round === 2).map((r) => (
                <li key={`reply-${r.id}`} className="text-sm">
                  <span className="block font-medium">{r.staffName} gửi câu trả lời lần 2</span>
                  <time dateTime={r.createdAt} className="text-xs text-muted-foreground">{dateTime.format(new Date(r.createdAt))}</time>
                </li>
              ))}
              {feedback.followUp && (
                <li key="follow-up" className="text-sm">
                  <span className="block font-medium text-gold-strong">Khách gửi thêm ý kiến phản hồi</span>
                  <time dateTime={feedback.followUp.createdAt} className="text-xs text-muted-foreground">{dateTime.format(new Date(feedback.followUp.createdAt))}</time>
                </li>
              )}
              {feedback.statusTimes.Replied && (
                <li className="text-sm">
                  <span className="block">{feedback.replies.some((r) => r.round === 2) ? "Nhân viên gửi câu trả lời lần 1" : "Nhân viên gửi câu trả lời"}</span>
                  <time dateTime={feedback.statusTimes.Replied} className="text-xs text-muted-foreground">{dateTime.format(new Date(feedback.statusTimes.Replied))}</time>
                </li>
              )}
              {feedback.statusTimes.Assigned && (
                <li className="text-sm">
                  <span className="block">Quản lý giao việc cho nhân viên</span>
                  <time dateTime={feedback.statusTimes.Assigned} className="text-xs text-muted-foreground">{dateTime.format(new Date(feedback.statusTimes.Assigned))}</time>
                </li>
              )}
              {feedback.statusTimes.Accepted && (
                <li className="text-sm">
                  <span className="block">Quản lý tiếp nhận phản hồi</span>
                  <time dateTime={feedback.statusTimes.Accepted} className="text-xs text-muted-foreground">{dateTime.format(new Date(feedback.statusTimes.Accepted))}</time>
                </li>
              )}
              {feedback.statusTimes.New && (
                <li className="text-sm">
                  <span className="block">Khách gửi phản hồi</span>
                  <time dateTime={feedback.statusTimes.New} className="text-xs text-muted-foreground">{dateTime.format(new Date(feedback.statusTimes.New))}</time>
                </li>
              )}
            </ol>
          </section>
        </div>
      </div>
    </>
  );
}

export function FeedbackProcessingPage({ id }: { id: number }) {
  const load = useCallback(async (signal: AbortSignal) => {
    const [detail, staff] = await Promise.all([loadFeedbackDetail(id, signal), loadStaff(signal)]);
    return { detail, staff };
  }, [id]);
  const { data, loading, error, missing, retry } = useApiData(load, "Chưa tải được phản hồi. Kiểm tra kết nối rồi thử lại.");
  if (!data) return <FeedbackLoadState loading={loading} missing={missing} error={error} onRetry={retry} backHref="/manager/feedback" />;
  return <FeedbackProcessing initial={data.detail} staff={data.staff} />;
}
