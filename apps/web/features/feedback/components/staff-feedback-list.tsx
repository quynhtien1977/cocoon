"use client";

import Link from "next/link";
import { Info } from "lucide-react";
import { PageHeader } from "@/components/brand/page-header";
import { RatingStars } from "@/components/brand/rating-stars";
import { StatTile } from "@/components/brand/stat-tile";
import { StatusBadge } from "@/components/brand/status-badge";
import { DataTable, type DataColumn, type DataFilter } from "@/components/data/data-table";
import { screen } from "@/lib/screens";
import { cn } from "@/lib/utils";
import { currentStaffFixture, feedbackFixture } from "../feedback.fixture";
import type { FeedbackListItem } from "../types";

const date = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" });
const actionClass = "inline-flex min-h-12 items-center rounded-md px-3 font-label text-sm uppercase tracking-wider whitespace-nowrap focus-visible:outline-2 focus-visible:outline-ring";
const needsAction = (row: FeedbackListItem) => row.status === "Assigned";
const LowRating = ({ row }: { row: FeedbackListItem }) => row.rating <= 2 ? <span className="w-fit rounded-sm bg-status-danger-bg px-2 py-0.5 font-label text-xs uppercase tracking-wider text-status-danger-fg">Cần chú ý</span> : null;

function ReplyAction({ row, label }: { row: FeedbackListItem; label: string }) {
  return <Link href={`/staff/feedback/${row.id}`} aria-label={label} className={cn(actionClass, needsAction(row) ? "bg-primary text-primary-foreground hover:bg-primary/80" : "border border-input hover:bg-muted")}>{needsAction(row) ? "Xử lý" : "Xem lại"}</Link>;
}

const columns: DataColumn<FeedbackListItem>[] = [
  { id: "id", header: "Mã", value: (row) => row.id, sortable: true, searchable: false, cell: (row) => <span className="font-mono text-xs">#{row.id}</span> },
  { id: "customer", header: "Khách hàng", value: (row) => `${row.customerName} ${row.orderCode ?? ""}`, sortable: true, cell: (row) => <span className="block min-w-32"><span className="block font-semibold">{row.customerName}</span>{row.orderCode && <span className="block text-xs text-muted-foreground">Đơn #{row.orderCode}</span>}</span> },
  { id: "product", header: "Sản phẩm", value: (row) => `${row.productName} ${row.categoryName}`, cell: (row) => <span className="block w-44 whitespace-normal"><span className="block">{row.productName}</span><span className="block text-xs text-muted-foreground">{row.categoryName}</span></span> },
  { id: "rating", header: "Số sao", value: (row) => row.rating, sortable: true, searchable: false, cell: (row) => <span className="flex flex-col gap-1 whitespace-nowrap"><RatingStars value={row.rating} /><LowRating row={row} /></span> },
  { id: "content", header: "Trích đoạn", value: (row) => row.content, cell: (row) => <span className="line-clamp-3 w-56 whitespace-normal text-muted-foreground italic">“{row.content}”</span> },
  { id: "status", header: "Trạng thái", value: (row) => row.status, searchable: false, cell: (row) => <StatusBadge kind="feedback" status={row.status} className="whitespace-nowrap" /> },
  { id: "createdAt", header: "Ngày gửi", value: (row) => row.createdAt, sortable: true, searchable: false, cell: (row) => <time dateTime={row.createdAt} className="whitespace-nowrap">{date.format(new Date(row.createdAt))}</time> },
  { id: "actions", header: "Thao tác", value: () => null, searchable: false, cell: (row) => <ReplyAction row={row} label={`${needsAction(row) ? "Xử lý" : "Xem lại"} phản hồi #${row.id}`} /> },
];

const filters: DataFilter<FeedbackListItem>[] = [
  { id: "status", label: "Trạng thái", options: [{ value: "Assigned", label: "Chờ trả lời" }, { value: "Replied", label: "Đã trả lời" }, { value: "Closed", label: "Đã đóng" }], matches: (row, value) => row.status === value },
  { id: "rating", label: "Đánh giá", options: [{ value: "low", label: "1–2 sao (cần chú ý)" }, { value: "high", label: "3–5 sao" }], matches: (row, value) => value === "low" ? row.rating <= 2 : row.rating >= 3 },
];

export function StaffFeedbackList() {
  const s = screen("S1");
  const assigned = feedbackFixture.filter((row) => row.assigneeName === currentStaffFixture.name);
  const waiting = assigned.filter(needsAction).length;

  return (
    <>
      <PageHeader eyebrow={s.code} title="Phản hồi được giao xử lý" description={`Phản hồi quản lý giao cho ${currentStaffFixture.name}. Ưu tiên các phản hồi điểm thấp.`} />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4">
        <StatTile label="Chờ trả lời" value={waiting} />
        <StatTile label="Đã hoàn thành" value={assigned.length - waiting} />
      </div>
      <DataTable data={assigned} columns={columns} getRowId={(row) => row.id} caption="Phản hồi được giao" filters={filters} cardsUntil="wide" renderCard={(row) => (
        <article className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
          <header className="flex items-start justify-between gap-3">
            <span className="min-w-0"><span className="block font-mono text-xs text-muted-foreground">#{row.id}{row.orderCode && ` · Đơn #${row.orderCode}`}</span><span className="block font-semibold">{row.customerName}</span><span className="block text-sm text-muted-foreground">{row.productName}</span></span>
            <StatusBadge kind="feedback" status={row.status} className="shrink-0 whitespace-nowrap" />
          </header>
          <span className="flex flex-wrap items-center gap-2"><RatingStars value={row.rating} /><LowRating row={row} /></span>
          <p className="line-clamp-2 text-sm text-muted-foreground italic">“{row.content}”</p>
          <div className="mt-auto flex items-center justify-between gap-3"><time dateTime={row.createdAt} className="text-xs text-muted-foreground">{date.format(new Date(row.createdAt))}</time><ReplyAction row={row} label={`Mở phản hồi #${row.id}`} /></div>
        </article>
      )} emptyTitle="Không có phản hồi phù hợp" emptyDescription="Thử bỏ bớt bộ lọc." />
      <p className="mt-6 flex gap-3 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground"><Info className="mt-0.5 size-4 shrink-0 text-gold-strong" aria-hidden="true" /><span><strong className="font-semibold text-foreground">Nguyên tắc trả lời:</strong> xưng hô nhã nhặn, giải thích rõ đặc tính sản phẩm và hướng dẫn cách dùng phù hợp với làn da của khách.</span></p>
    </>
  );
}
