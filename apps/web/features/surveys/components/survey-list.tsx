"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleCheck, ClipboardList, FilePen, Info, Plus, Timer, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/brand/confirm-dialog";
import { PageHeader } from "@/components/brand/page-header";
import { StatTile } from "@/components/brand/stat-tile";
import { StatusBadge } from "@/components/brand/status-badge";
import { DataTable, type DataColumn, type DataFilter } from "@/components/data/data-table";
import { Button, buttonVariants } from "@/components/ui/button";
import { screen } from "@/lib/screens";
import { cn } from "@/lib/utils";
import { purposeLabels } from "../schemas";
import { surveysFixture } from "../surveys.fixture";
import type { SurveyListItem, SurveyPurpose, SurveyStatus } from "../types";

const date = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" });
const percent = new Intl.NumberFormat("vi-VN", { style: "percent", maximumFractionDigits: 1 });

const surveyCode = (row: SurveyListItem) => `KS-${String(row.id).padStart(4, "0")}`;
const responseRate = (row: SurveyListItem) => row.recipientCount ? row.responseCount / row.recipientCount : null;
const period = (row: SurveyListItem) => row.openAt || row.closeAt
  ? `${row.openAt ? date.format(new Date(row.openAt)) : "…"} – ${row.closeAt ? date.format(new Date(row.closeAt)) : "…"}`
  : "Chưa lên lịch";

const purposeTone: Record<SurveyPurpose, string> = {
  Satisfaction: "bg-status-sage-bg text-status-sage-fg",
  NewProduct: "bg-status-turmeric-bg text-status-turmeric-fg",
  Other: "bg-status-gray-bg text-status-gray-fg",
};
const PurposeChip = ({ purpose }: { purpose: SurveyPurpose }) => <span className={cn("inline-block rounded-sm px-2 py-0.5 font-label text-xs uppercase tracking-wider whitespace-nowrap", purposeTone[purpose])}>{purposeLabels[purpose]}</span>;

function Progress({ row }: { row: SurveyListItem }) {
  const rate = responseRate(row);
  if (rate === null) return <span className="text-sm text-muted-foreground">Chưa gửi</span>;
  return (
    <span className="flex min-w-36 items-center gap-3">
      <span aria-hidden="true" className="h-1.5 w-full max-w-24 bg-muted"><span className={cn("block h-full", row.status === "Closed" ? "bg-status-sage-fg" : "bg-gold")} style={{ width: `${rate * 100}%` }} /></span>
      <span className="text-sm whitespace-nowrap tabular-nums">{row.responseCount}/{row.recipientCount} <span className="text-muted-foreground">({percent.format(rate)})</span></span>
    </span>
  );
}

const actionLink = "inline-flex min-h-12 items-center rounded-md px-3 font-label text-sm uppercase tracking-wider whitespace-nowrap focus-visible:outline-2 focus-visible:outline-ring";

/** Edit and delete only while Draft (spec: questions lock once a survey opens); results exist once it has been sent. */
function Actions({ row, onDelete }: { row: SurveyListItem; onDelete: (row: SurveyListItem) => void }) {
  return (
    <span className="flex flex-wrap items-center justify-end gap-1 xl:flex-nowrap">
      {row.status === "Draft" && <Link href={`/manager/surveys/${row.id}/edit`} aria-label={`Chỉnh sửa ${row.title}`} className={cn(actionLink, "hover:bg-muted")}>Chỉnh sửa</Link>}
      {row.status !== "Closed" && <Link href={`/manager/surveys/${row.id}/send`} aria-label={`Gửi khảo sát ${row.title}`} className={cn(actionLink, "hover:bg-muted")}>Gửi khảo sát</Link>}
      {row.status !== "Draft" && <Link href={`/manager/surveys/${row.id}/results`} aria-label={`Xem kết quả ${row.title}`} className={cn(actionLink, "bg-primary text-primary-foreground hover:bg-primary/80")}>Xem kết quả</Link>}
      {row.status === "Draft" && (
        <ConfirmDialog portal="manager" title="Xóa bản nháp khảo sát?" description={`“${row.title}” sẽ bị xóa cùng toàn bộ câu hỏi. Không thể hoàn tác.`} confirmLabel="Xóa bản nháp"
          trigger={<Button type="button" variant="ghost" size="icon-lg" className="size-12 text-destructive" aria-label={`Xóa ${row.title}`}><Trash2 aria-hidden="true" /></Button>}
          onConfirm={() => onDelete(row)} />
      )}
    </span>
  );
}

const filters: DataFilter<SurveyListItem>[] = [
  { id: "purpose", label: "Mục đích", options: (Object.keys(purposeLabels) as SurveyPurpose[]).map((value) => ({ value, label: purposeLabels[value] })), matches: (row, value) => row.purpose === value },
  { id: "status", label: "Trạng thái", options: ([["Draft", "Bản nháp"], ["Open", "Đang mở"], ["Closed", "Đã đóng"]] as [SurveyStatus, string][]).map(([value, label]) => ({ value, label })), matches: (row, value) => row.status === value },
];

export function SurveyList() {
  const s = screen("M7");
  const [surveys, setSurveys] = useState(surveysFixture);
  const count = (status: SurveyStatus) => surveys.filter((row) => row.status === status).length;
  const remove = (row: SurveyListItem) => setSurveys((current) => current.filter((item) => item.id !== row.id));

  const columns: DataColumn<SurveyListItem>[] = [
    {
      // Value includes the code so search matches "KS-0081"; sorting still leads with the title.
      id: "title", header: "Khảo sát", value: (row) => `${row.title} ${surveyCode(row)}`, sortable: true,
      cell: (row) => <span className="block min-w-56"><span className="block font-mono text-xs text-gold-strong">{surveyCode(row)}</span><span className="block font-semibold">{row.title}</span><span className="block text-xs text-muted-foreground">{row.questionCount} câu hỏi</span></span>,
    },
    { id: "purpose", header: "Mục đích", value: (row) => purposeLabels[row.purpose], searchable: false, cell: (row) => <PurposeChip purpose={row.purpose} /> },
    { id: "period", header: "Thời gian", value: (row) => row.openAt, sortable: true, searchable: false, cell: (row) => <span className={cn("whitespace-nowrap text-sm", !row.openAt && "text-muted-foreground")}>{period(row)}</span> },
    { id: "status", header: "Trạng thái", value: (row) => row.status, searchable: false, cell: (row) => <StatusBadge kind="survey" status={row.status} className="whitespace-nowrap" /> },
    { id: "progress", header: "Tiến độ phản hồi", value: responseRate, sortable: true, searchable: false, cell: (row) => <Progress row={row} /> },
    { id: "actions", header: "Thao tác", value: () => null, searchable: false, cell: (row) => <Actions row={row} onDelete={remove} /> },
  ];

  return (
    <>
      <PageHeader eyebrow={s.code} title="Quản lý khảo sát khách hàng" description="Theo dõi khảo sát mức độ hài lòng và nghiên cứu sản phẩm mới: trạng thái, thời gian và tiến độ phản hồi." actions={
        <Link href="/manager/surveys/new" className={cn(buttonVariants(), "h-12 px-4")}><Plus aria-hidden="true" />Tạo khảo sát mới</Link>
      } />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatTile label="Tổng khảo sát" value={surveys.length} icon={<ClipboardList />} />
        <StatTile label="Đang mở" value={count("Open")} icon={<Timer />} hint="Khách đang có thể trả lời" />
        <StatTile label="Đã đóng" value={count("Closed")} icon={<CircleCheck />} hint="Đã có kết quả cuối" />
        <StatTile label="Bản nháp" value={count("Draft")} icon={<FilePen />} hint="Còn sửa được câu hỏi" />
      </div>
      <DataTable data={surveys} columns={columns} getRowId={(row) => row.id} caption="Khảo sát" filters={filters} cardsUntil="xl" renderCard={(row) => (
        <article className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
          <header className="flex items-start justify-between gap-3">
            <span className="min-w-0">
              <span className="block font-mono text-xs text-gold-strong">{surveyCode(row)} · {row.questionCount} câu hỏi</span>
              <span className="block font-semibold">{row.title}</span>
            </span>
            <StatusBadge kind="survey" status={row.status} />
          </header>
          <span className="flex flex-wrap items-center gap-2 text-sm"><PurposeChip purpose={row.purpose} /><span className={cn(!row.openAt && "text-muted-foreground")}>{period(row)}</span></span>
          <Progress row={row} />
          <div className="mt-auto"><Actions row={row} onDelete={remove} /></div>
        </article>
      )} emptyTitle="Không tìm thấy khảo sát" emptyDescription="Thử từ khóa khác hoặc bỏ bớt bộ lọc." />
      <p className="mt-6 flex gap-3 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-gold-strong" aria-hidden="true" />
        <span><strong className="font-semibold text-foreground">Quy tắc biên tập:</strong> chỉ khảo sát ở trạng thái Bản nháp mới sửa hoặc xóa được. Khi đã gửi, câu hỏi được khóa để giữ dữ liệu phản hồi nhất quán; muốn đổi câu hỏi hãy tạo khảo sát mới.</span>
      </p>
    </>
  );
}
