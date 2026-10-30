"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BadgeCheck, CircleCheck, Hourglass, MessageSquareWarning, Star } from "lucide-react";
import { PageHeader } from "@/components/brand/page-header";
import { RatingStars } from "@/components/brand/rating-stars";
import { StatTile } from "@/components/brand/stat-tile";
import { StatusBadge, statusMap } from "@/components/brand/status-badge";
import { DataTable, type DataColumn, type DataFilter } from "@/components/data/data-table";
import { updateTableParams } from "@/components/data/table-state";
import { screen } from "@/lib/screens";
import { cn } from "@/lib/utils";
import { categoriesFixture, feedbackFixture, staffFixture } from "../feedback.fixture";
import type { FeedbackListItem, FeedbackStatus } from "../types";

const dateTime = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
const rating = new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const statuses = Object.keys(statusMap.feedback) as FeedbackStatus[];
const PREFIX = "feedback.";
const UNASSIGNED = "none";

const needsAction = (row: FeedbackListItem) => row.status === "New" || row.status === "Accepted";
const actionClass = "inline-flex min-h-12 items-center rounded-md px-3 font-label text-sm uppercase tracking-wider whitespace-nowrap focus-visible:outline-2 focus-visible:outline-ring";
const LowRating = ({ row }: { row: FeedbackListItem }) => row.rating <= 2 ? <span className="w-fit rounded-sm bg-status-lotus-bg px-2 py-0.5 font-label text-xs uppercase tracking-wider text-status-lotus-fg">Cần chú ý</span> : null;

function ProcessLink({ row, label }: { row: FeedbackListItem; label: string }) {
  return <Link href={`/manager/feedback/${row.id}`} aria-label={label} className={cn(actionClass, needsAction(row) ? "bg-primary text-primary-foreground hover:bg-primary/80" : "border border-input hover:bg-muted")}>{needsAction(row) ? "Xử lý ngay" : "Xem chi tiết"}</Link>;
}

const columns: DataColumn<FeedbackListItem>[] = [
  {
    // Value includes both codes so search matches them; sorting still leads with the name.
    id: "customer", header: "Khách hàng", value: (row) => `${row.customerName} ${row.customerCode} ${row.orderCode ?? ""}`, sortable: true,
    cell: (row) => <span className="block min-w-32"><span className="block font-semibold">{row.customerName}</span><span className="block font-mono text-xs text-muted-foreground">#{row.id} · {row.customerCode}</span>{row.orderCode && <span className="block text-xs text-muted-foreground">Đơn #{row.orderCode}</span>}</span>,
  },
  {
    id: "product", header: "Sản phẩm", value: (row) => `${row.productName} ${row.categoryName}`,
    cell: (row) => <span className="block w-40 whitespace-normal"><span className="block">{row.productName}</span><span className="flex items-center gap-1 text-xs text-muted-foreground">{row.categoryName}{row.verifiedPurchase && <><span aria-hidden="true">·</span><BadgeCheck className="size-3 text-status-sage-fg" aria-hidden="true" />Đã mua</>}</span></span>,
  },
  { id: "rating", header: "Điểm", value: (row) => row.rating, sortable: true, searchable: false, cell: (row) => <span className="flex flex-col gap-1 whitespace-nowrap"><RatingStars value={row.rating} /><LowRating row={row} /></span> },
  { id: "content", header: "Nội dung", value: (row) => row.content, cell: (row) => <span className="line-clamp-3 w-48 whitespace-normal text-muted-foreground">{row.content}</span> },
  { id: "status", header: "Trạng thái", value: (row) => statuses.indexOf(row.status), sortable: true, searchable: false, cell: (row) => <StatusBadge kind="feedback" status={row.status} className="whitespace-nowrap" /> },
  { id: "assignee", header: "Phụ trách", value: (row) => row.assigneeName, cell: (row) => row.assigneeName ?? <span className="text-muted-foreground">Chưa giao</span> },
  { id: "createdAt", header: "Ngày gửi", value: (row) => row.createdAt, sortable: true, searchable: false, cell: (row) => <time dateTime={row.createdAt} className="block w-20 whitespace-normal">{dateTime.format(new Date(row.createdAt))}</time> },
  { id: "actions", header: "Thao tác", value: () => null, searchable: false, cell: (row) => <ProcessLink row={row} label={`Xử lý phản hồi #${row.id}`} /> },
];

const filters: DataFilter<FeedbackListItem>[] = [
  { id: "status", label: "Trạng thái", options: statuses.map((value) => ({ value, label: statusMap.feedback[value][0] })), matches: (row, value) => row.status === value },
  {
    id: "rating", label: "Điểm",
    options: [{ value: "low", label: "≤ 2 sao" }, ...[5, 4, 3, 2, 1].map((value) => ({ value: String(value), label: `${value} sao` }))],
    matches: (row, value) => value === "low" ? row.rating <= 2 : row.rating === Number(value),
  },
  { id: "category", label: "Danh mục", options: categoriesFixture.map((value) => ({ value, label: value })), matches: (row, value) => row.categoryName === value },
  {
    id: "assignee", label: "Phụ trách",
    options: [{ value: UNASSIGNED, label: "Chưa giao" }, ...staffFixture.map((item) => ({ value: item.name, label: item.name }))],
    matches: (row, value) => value === UNASSIGNED ? row.assigneeName === null : row.assigneeName === value,
  },
];

/** Shortcut over the status filter: it writes the same URL param, so both stay in sync. */
function StatusTabs({ rows }: { rows: readonly FeedbackListItem[] }) {
  const params = useSearchParams();
  const active = params.get(`${PREFIX}filter.status`) ?? "";
  const select = (status: string) => {
    const search = updateTableParams(window.location.search, PREFIX, { "filter.status": status, page: "1" });
    window.history.pushState(null, "", `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`);
  };
  const tabs = [{ value: "", label: "Tất cả", count: rows.length }, ...statuses.map((value) => ({ value, label: statusMap.feedback[value][0], count: rows.filter((row) => row.status === value).length }))];
  return (
    <nav aria-label="Lọc nhanh theo trạng thái" className="mb-4 flex overflow-x-auto border-b border-border">
      {tabs.map((tab) => (
        <button key={tab.value} type="button" aria-pressed={active === tab.value} onClick={() => select(tab.value)}
          className={cn("flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-3 font-label text-sm uppercase tracking-wider whitespace-nowrap focus-visible:outline-2 focus-visible:outline-ring", active === tab.value ? "border-gold-strong font-bold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
          {tab.label}<span className="rounded-sm bg-muted px-1.5 text-xs tabular-nums">{tab.count}</span>
        </button>
      ))}
    </nav>
  );
}

export function FeedbackInbox() {
  const s = screen("M5");
  const feedback = feedbackFixture;
  const count = (...status: FeedbackStatus[]) => feedback.filter((row) => status.includes(row.status)).length;
  const avg = feedback.length ? feedback.reduce((sum, row) => sum + row.rating, 0) / feedback.length : null;
  const low = feedback.filter((row) => row.rating <= 2).length;

  return (
    <>
      <PageHeader eyebrow={s.code} title="Hộp phản hồi" description="Tiếp nhận phản hồi mới, giao cho nhân viên và đóng khi khách đã được trả lời." />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatTile label="Chờ tiếp nhận" value={count("New")} icon={<MessageSquareWarning />} hint={`${feedback.filter((row) => row.status === "New" && row.rating <= 2).length} phản hồi ≤ 2 sao`} />
        <StatTile label="Đang xử lý" value={count("Accepted", "Assigned")} icon={<Hourglass />} hint="Đã tiếp nhận hoặc đã giao" />
        <StatTile label="Đã trả lời, chờ đóng" value={count("Replied")} icon={<CircleCheck />} hint={`${count("Closed")} phản hồi đã đóng`} />
        <StatTile label="Điểm trung bình" value={avg === null ? "—" : rating.format(avg)} unit={avg === null ? undefined : "/5"} icon={<Star />} progress={avg === null ? undefined : avg / 5} hint={`${low} phản hồi ≤ 2 sao`} />
      </div>
      <Suspense fallback={null}><StatusTabs rows={feedback} /></Suspense>
      <DataTable data={feedback} columns={columns} getRowId={(row) => row.id} caption="Phản hồi" filters={filters} paramPrefix={PREFIX} cardsUntil="wide" renderCard={(row) => (
        <article className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
          <header className="flex items-start justify-between gap-3">
            <span className="min-w-0"><span className="block font-mono text-xs text-muted-foreground">#{row.id} · {row.customerCode}</span><span className="block font-semibold">{row.customerName}</span><span className="block text-sm text-muted-foreground">{row.productName}</span></span>
            <StatusBadge kind="feedback" status={row.status} className="shrink-0 whitespace-nowrap" />
          </header>
          <span className="flex flex-wrap items-center gap-2"><RatingStars value={row.rating} /><LowRating row={row} /></span>
          <p className="line-clamp-2 text-sm text-muted-foreground">{row.content}</p>
          <p className="text-xs text-muted-foreground">Phụ trách: {row.assigneeName ?? "Chưa giao"} · <time dateTime={row.createdAt}>{dateTime.format(new Date(row.createdAt))}</time></p>
          <div className="mt-auto flex justify-end"><ProcessLink row={row} label={`Mở phản hồi #${row.id}`} /></div>
        </article>
      )} emptyTitle="Không có phản hồi phù hợp" emptyDescription="Thử bỏ bớt bộ lọc trạng thái hoặc điểm." />
    </>
  );
}
