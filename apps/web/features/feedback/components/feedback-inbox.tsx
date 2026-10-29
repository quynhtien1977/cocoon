"use client";

import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { PageHeader } from "@/components/brand/page-header";
import { RatingStars } from "@/components/brand/rating-stars";
import { StatTile } from "@/components/brand/stat-tile";
import { StatusBadge, statusMap } from "@/components/brand/status-badge";
import { DataTable, type DataColumn, type DataFilter } from "@/components/data/data-table";
import { screen } from "@/lib/screens";
import { categoriesFixture, feedbackFixture } from "../feedback.fixture";
import type { FeedbackListItem, FeedbackStatus } from "../types";

const dateTime = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
const rating = new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const statuses = Object.keys(statusMap.feedback) as FeedbackStatus[];

const columns: DataColumn<FeedbackListItem>[] = [
  { id: "id", header: "Mã", value: (row) => row.id, sortable: true, searchable: false, cell: (row) => <span className="font-mono text-xs">#{row.id}</span> },
  { id: "customer", header: "Khách hàng", value: (row) => row.customerName, sortable: true },
  {
    id: "product", header: "Sản phẩm", value: (row) => `${row.productName} ${row.categoryName}`,
    cell: (row) => <span className="block min-w-44"><span className="block">{row.productName}</span><span className="flex items-center gap-1 text-xs text-muted-foreground">{row.categoryName}{row.verifiedPurchase && <><span aria-hidden="true">·</span><BadgeCheck className="size-3 text-status-sage-fg" aria-hidden="true" />Đã mua</>}</span></span>,
  },
  { id: "rating", header: "Điểm", value: (row) => row.rating, sortable: true, searchable: false, cell: (row) => <RatingStars value={row.rating} className="whitespace-nowrap" /> },
  { id: "content", header: "Nội dung", value: (row) => row.content, cell: (row) => <span className="line-clamp-2 min-w-56 max-w-md text-muted-foreground">{row.content}</span> },
  { id: "status", header: "Trạng thái", value: (row) => statuses.indexOf(row.status), sortable: true, searchable: false, cell: (row) => <StatusBadge kind="feedback" status={row.status} /> },
  { id: "assignee", header: "Phụ trách", value: (row) => row.assigneeName, cell: (row) => row.assigneeName ?? <span className="text-muted-foreground">Chưa giao</span> },
  { id: "createdAt", header: "Ngày gửi", value: (row) => row.createdAt, sortable: true, searchable: false, cell: (row) => <time dateTime={row.createdAt} className="whitespace-nowrap">{dateTime.format(new Date(row.createdAt))}</time> },
  { id: "actions", header: "Thao tác", value: () => null, searchable: false, cell: (row) => <Link href={`/manager/feedback/${row.id}`} aria-label={`Xử lý phản hồi #${row.id}`} className="inline-flex min-h-12 items-center font-semibold whitespace-nowrap text-gold-strong hover:underline">Xử lý</Link> },
];

const filters: DataFilter<FeedbackListItem>[] = [
  { id: "status", label: "Trạng thái", options: statuses.map((value) => ({ value, label: statusMap.feedback[value][0] })), matches: (row, value) => row.status === value },
  {
    id: "rating", label: "Điểm",
    options: [{ value: "low", label: "≤ 2 sao" }, ...[5, 4, 3, 2, 1].map((value) => ({ value: String(value), label: `${value} sao` }))],
    matches: (row, value) => value === "low" ? row.rating <= 2 : row.rating === Number(value),
  },
  { id: "category", label: "Danh mục", options: categoriesFixture.map((value) => ({ value, label: value })), matches: (row, value) => row.categoryName === value },
];

export function FeedbackInbox() {
  const s = screen("M5");
  const feedback = feedbackFixture;
  const count = (...status: FeedbackStatus[]) => feedback.filter((row) => status.includes(row.status)).length;
  const avg = feedback.length ? feedback.reduce((sum, row) => sum + row.rating, 0) / feedback.length : null;
  const low = feedback.filter((row) => row.rating <= 2).length;

  return (
    <>
      <PageHeader eyebrow={s.code} title="Hộp phản hồi" description="Tiếp nhận phản hồi mới, giao cho nhân viên và đóng khi khách đã được trả lời." />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Chờ tiếp nhận" value={count("New")} />
        <StatTile label="Đang xử lý" value={count("Accepted", "Assigned")} />
        <StatTile label="Đã trả lời, chờ đóng" value={count("Replied")} />
        <StatTile label="Điểm trung bình" value={avg === null ? "—" : `${rating.format(avg)}/5`} change={{ value: low, label: "phản hồi ≤ 2 sao", tone: low > 0 ? "negative" : "neutral" }} />
      </div>
      <DataTable data={feedback} columns={columns} getRowId={(row) => row.id} caption="Phản hồi" filters={filters} paramPrefix="feedback."
        emptyTitle="Không có phản hồi phù hợp" emptyDescription="Thử bỏ bớt bộ lọc trạng thái hoặc điểm." />
    </>
  );
}
