"use client";

import { useCallback, useId, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, CircleCheck, Info, Lock, UserCheck } from "lucide-react";
import { ConfirmDialog } from "@/components/brand/confirm-dialog";
import { FeedbackThread } from "@/components/brand/feedback-thread";
import { PageHeader } from "@/components/brand/page-header";
import { StatusBadge } from "@/components/brand/status-badge";
import { Button } from "@/components/ui/button";
import { screen } from "@/lib/screens";
import { cn } from "@/lib/utils";
import { acceptFeedback, assignFeedback, closeFeedback, loadFeedbackDetail, loadStaff } from "../api";
import type { FeedbackDetail, FeedbackStatus, StaffOption } from "../types";
import { useApiData } from "../use-api-data";
import { caseCard, CustomerSummary, FeedbackTimeline, OrderProductSummary } from "./feedback-case";
import { FeedbackLoadState } from "./feedback-load-state";

const dateTime = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
const actionClass = "h-12 px-4";

const historyLabels: [FeedbackStatus, string][] = [
  ["Closed", "Quản lý đóng phản hồi"],
  ["Replied", "Nhân viên gửi câu trả lời"],
  ["Assigned", "Quản lý giao việc cho nhân viên"],
  ["Accepted", "Quản lý tiếp nhận phản hồi"],
  ["New", "Khách gửi phản hồi"],
];

/** M6 shows only the moves valid from the current status (spec: no disabled buttons standing in for an error). */
export function FeedbackProcessing({ initial, staff }: { initial: FeedbackDetail; staff: readonly StaffOption[] }) {
  const s = screen("M6");
  const id = useId();
  const [feedback, setFeedback] = useState(initial);
  const [staffId, setStaffId] = useState(initial.assigneeId ?? staff[0]?.id ?? 0);
  const [notice, setNotice] = useState<string | null>(null);
  const staffName = staff.find((item) => item.id === staffId)?.name ?? "";
  const { status } = feedback;

  // A failed request throws into ConfirmDialog, which keeps the dialog open and shows the API's message.
  function moved(next: FeedbackStatus, message: string, assignee?: StaffOption) {
    const at = new Date().toISOString();
    setFeedback((current) => ({ ...current, status: next, assigneeId: assignee?.id ?? current.assigneeId, assigneeName: assignee?.name ?? current.assigneeName, statusTimes: { ...current.statusTimes, [next]: at } }));
    setNotice(message);
  }

  return (
    <>
      <Link href="/manager/feedback" className="mb-3 inline-flex min-h-12 items-center gap-1 font-label text-sm uppercase tracking-wider text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden="true" />Hộp phản hồi</Link>
      <PageHeader eyebrow={s.code} title={`Xử lý phản hồi #${feedback.id}`} description={`${feedback.customerName}${feedback.orderCode ? ` · Đơn #${feedback.orderCode}` : ""}`} actions={<StatusBadge kind="feedback" status={status} className="whitespace-nowrap" />} />

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
              trigger={<Button type="button" variant="outline" className={actionClass}><Lock aria-hidden="true" />Đóng phản hồi</Button>} onConfirm={async () => { await closeFeedback(feedback.id); moved("Closed", "Đã đóng phản hồi."); }} />
          )}
          {status === "Assigned" && <p className="basis-full text-sm text-muted-foreground">Đang chờ {feedback.assigneeName} trả lời khách.</p>}
        </section>
      )}
      <div aria-live="polite">{notice && <p className="mb-6 flex items-center gap-2 rounded-md border border-border bg-status-sage-bg p-3 text-sm text-status-sage-fg"><CircleCheck className="size-4 shrink-0" aria-hidden="true" />{notice}</p>}</div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <FeedbackTimeline status={status} times={feedback.statusTimes} />
          <FeedbackThread rating={feedback.rating} content={feedback.content} createdAt={feedback.createdAt} replies={feedback.replies} customerHeading={`Phản hồi của ${feedback.customerName}`} emptyReplies="Chưa có câu trả lời nào cho khách." />
          <p className="flex gap-2 rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground"><Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />Nhân viên được giao trả lời khách ở màn S2. Quản lý theo dõi và điều phối tại đây.</p>
        </div>
        <div className="min-w-0 space-y-6">
          <CustomerSummary feedback={feedback} />
          <OrderProductSummary feedback={feedback} />
          <section aria-labelledby="history-title" className={caseCard}>
            <h2 id="history-title" className="border-b border-border pb-3 font-heading text-lg">Lịch sử điều phối</h2>
            <ol className="mt-3 space-y-3">
              {historyLabels.map(([step, label]) => {
                const time = feedback.statusTimes[step];
                return time ? <li key={step} className="text-sm"><span className="block">{label}</span><time dateTime={time} className="text-xs text-muted-foreground">{dateTime.format(new Date(time))}</time></li> : null;
              })}
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
  const { data, loading, error, missing, retry } = useApiData(load);
  if (!data) return <FeedbackLoadState loading={loading} missing={missing} error={error} onRetry={retry} backHref="/manager/feedback" />;
  return <FeedbackProcessing initial={data.detail} staff={data.staff} />;
}
