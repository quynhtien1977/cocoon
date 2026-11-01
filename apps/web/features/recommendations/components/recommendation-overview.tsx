"use client";

import { useState } from "react";
import Link from "next/link";
import { Bolt, CircleCheck, EyeOff, MousePointerClick, PieChart, Plus, RefreshCw, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/brand/confirm-dialog";
import { PageHeader } from "@/components/brand/page-header";
import { StatTile } from "@/components/brand/stat-tile";
import { StatusBadge, statusMap } from "@/components/brand/status-badge";
import { ChartCard } from "@/components/data/chart-card";
import { DataTable, type DataColumn, type DataFilter } from "@/components/data/data-table";
import type { SegmentOption } from "@/components/data/segment-filter-builder";
import { Button, buttonVariants } from "@/components/ui/button";
import { screen } from "@/lib/screens";
import { cn } from "@/lib/utils";
import { recommendationStatsFixture, topProductsFixture, weeklyInteractionsFixture } from "../recommendations.fixture";
import { segmentSummary } from "../schemas";
import type { PlanStatus, RecommendationPlan } from "../types";

const date = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" });
const dateTime = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
const percent = new Intl.NumberFormat("vi-VN", { style: "percent", maximumFractionDigits: 1 });
const actionLink = "inline-flex min-h-12 items-center rounded-md border border-input px-3 font-label text-sm uppercase tracking-wider whitespace-nowrap hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring";

const period = (plan: RecommendationPlan) => `${date.format(new Date(plan.startAt))} – ${date.format(new Date(plan.endAt))}`;
const planCode = (plan: RecommendationPlan) => `KP-${plan.id}`;

const filters: DataFilter<RecommendationPlan>[] = [
  { id: "status", label: "Trạng thái", options: (Object.keys(statusMap.recommendationPlan) as PlanStatus[]).map((value) => ({ value, label: statusMap.recommendationPlan[value][0] })), matches: (row, value) => row.status === value },
];

interface OverviewProps {
  initialPlans: readonly RecommendationPlan[];
  preferences: readonly SegmentOption[];
  categories: readonly SegmentOption[];
}

export function RecommendationOverview({ initialPlans, preferences, categories }: OverviewProps) {
  const s = screen("M13");
  const stats = recommendationStatsFixture;
  const [plans, setPlans] = useState(initialPlans);
  const [builtAt, setBuiltAt] = useState(stats.lastBuiltAt);
  const [notice, setNotice] = useState<string | null>(null);
  const active = plans.filter((plan) => plan.status === "Active").length;

  // Static phase: changes live in this page's state only, until recommendations/rebuild and recommendation-plans/* are wired up.
  function rebuild() {
    setBuiltAt(new Date().toISOString());
    setNotice("Đã tính lại gợi ý cho mọi khách (dữ liệu mẫu, chưa gửi máy chủ).");
  }
  function end(plan: RecommendationPlan) {
    setPlans((current) => current.map((item) => item.id === plan.id ? { ...item, status: "Ended" } : item));
    setNotice(`Đã kết thúc “${plan.name}” (dữ liệu mẫu, chưa gửi máy chủ).`);
  }
  function remove(plan: RecommendationPlan) {
    setPlans((current) => current.filter((item) => item.id !== plan.id));
    setNotice(`Đã xóa bản nháp “${plan.name}” (dữ liệu mẫu, chưa gửi máy chủ).`);
  }

  const Actions = ({ plan }: { plan: RecommendationPlan }) => (
    <span className="flex flex-wrap items-center justify-end gap-1 min-[1400px]:flex-nowrap">
      <Link href={`/manager/recommendations/plans/${plan.id}`} aria-label={`${plan.status === "Draft" ? "Chỉnh sửa" : "Xem chi tiết"} ${plan.name}`} className={actionLink}>{plan.status === "Draft" ? "Chỉnh sửa" : "Chi tiết"}</Link>
      {plan.status === "Active" && (
        <ConfirmDialog portal="manager" title="Kết thúc kế hoạch?" description={`“${plan.name}” sẽ dừng ngay và không chạy lại được. Số liệu đã có vẫn được giữ.`} confirmLabel="Kết thúc kế hoạch"
          trigger={<Button type="button" variant="ghost" className="min-h-12 px-3 font-label uppercase tracking-wider text-destructive" aria-label={`Kết thúc ${plan.name}`}>Kết thúc</Button>} onConfirm={() => end(plan)} />
      )}
      {plan.status === "Draft" && (
        <ConfirmDialog portal="manager" title="Xóa bản nháp kế hoạch?" description={`“${plan.name}” sẽ bị xóa. Không thể hoàn tác.`} confirmLabel="Xóa bản nháp"
          trigger={<Button type="button" variant="ghost" size="icon-lg" className="size-12 text-destructive" aria-label={`Xóa ${plan.name}`}><Trash2 aria-hidden="true" /></Button>} onConfirm={() => remove(plan)} />
      )}
    </span>
  );

  const columns: DataColumn<RecommendationPlan>[] = [
    { id: "name", header: "Kế hoạch", value: (row) => `${row.name} ${planCode(row)}`, sortable: true, cell: (row) => <span className="block w-64 whitespace-normal"><span className="block font-mono text-xs text-gold-strong">{planCode(row)}</span><span className="block font-semibold">{row.name}</span><span className="block text-xs text-muted-foreground">{row.productIds.length} sản phẩm</span></span> },
    { id: "segment", header: "Phân khúc", value: (row) => segmentSummary(row.segment, preferences, categories), cell: (row) => <span className="block w-44 whitespace-normal text-sm">{segmentSummary(row.segment, preferences, categories)}</span> },
    { id: "period", header: "Thời gian", value: (row) => row.startAt, sortable: true, searchable: false, cell: (row) => <span className="block w-24 whitespace-normal text-sm">{period(row)}</span> },
    { id: "status", header: "Trạng thái", value: (row) => row.status, searchable: false, cell: (row) => <StatusBadge kind="recommendationPlan" status={row.status} className="whitespace-nowrap" /> },
    { id: "recipients", header: "Số khách", value: (row) => row.recipientCount, sortable: true, searchable: false, cell: (row) => <span className="tabular-nums">{row.status === "Draft" ? "—" : row.recipientCount}</span> },
    { id: "clickRate", header: "Tỷ lệ bấm", value: (row) => row.clickRate, sortable: true, searchable: false, cell: (row) => <span className="tabular-nums">{row.clickRate === null ? "—" : percent.format(row.clickRate)}</span> },
    { id: "actions", header: "Thao tác", value: () => null, searchable: false, cell: (row) => <Actions plan={row} /> },
  ];

  return (
    <>
      <PageHeader eyebrow={s.code} title="Tổng quan gợi ý & kế hoạch" description="Theo dõi hiệu quả gợi ý sản phẩm và các kế hoạch gợi ý theo phân khúc." actions={<>
        <Button type="button" variant="outline" className="h-12 px-4" onClick={rebuild}><RefreshCw aria-hidden="true" />Tính lại gợi ý</Button>
        <Link href="/manager/recommendations/plans/new" className={cn(buttonVariants(), "h-12 px-4")}><Plus aria-hidden="true" />Tạo kế hoạch mới</Link>
      </>} />
      <p className="-mt-3 mb-6 text-sm text-muted-foreground">Lần tính gần nhất: <time dateTime={builtAt}>{dateTime.format(new Date(builtAt))}</time></p>
      <div aria-live="polite">{notice && <p className="mb-6 flex items-center gap-2 rounded-md border border-border bg-status-sage-bg p-3 text-sm text-status-sage-fg"><CircleCheck className="size-4 shrink-0" aria-hidden="true" />{notice}</p>}</div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatTile label="Độ phủ gợi ý" value={percent.format(stats.coverage)} icon={<PieChart />} progress={stats.coverage} hint="Khách có ít nhất 1 gợi ý" />
        <StatTile label="Tỷ lệ bấm" value={percent.format(stats.clickRate)} icon={<MousePointerClick />} progress={stats.clickRate} hint="Lượt bấm trên lượt hiển thị" />
        <StatTile label="Tỷ lệ bỏ qua" value={percent.format(stats.dismissRate)} icon={<EyeOff />} progress={stats.dismissRate} hint="Khách chủ động bỏ qua" />
        <StatTile label="Kế hoạch đang chạy" value={active} unit={`/${plans.length}`} icon={<Bolt />} hint="Đang áp dụng cho khách" />
      </div>
      <div className="mb-6 grid items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <ChartCard title="Tương tác gợi ý theo tuần" description="Tổng lượt tương tác 4 tuần gần nhất." type="bar" data={weeklyInteractionsFixture} categoryKey="week" categoryLabel="Tuần" series={[{ key: "interactions", label: "Lượt tương tác" }]} />
        <section aria-labelledby="top-products" className="min-w-0 rounded-lg border border-border bg-card p-4 sm:p-6">
          <h2 id="top-products" className="font-heading text-xl">Top sản phẩm được gợi ý</h2>
          <p className="mt-1 text-sm text-muted-foreground">Theo lượt bấm từ gợi ý.</p>
          <ol className="mt-3 divide-y divide-border">
            {topProductsFixture.map((product, index) => (
              <li key={product.id} className="flex items-center gap-3 py-3">
                <span aria-hidden="true" className="w-4 shrink-0 font-heading text-lg lining-nums text-gold-strong">{index + 1}</span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{product.name}</span><span className="mt-1 inline-block rounded-sm bg-status-beige-bg px-2 py-0.5 font-label text-xs text-status-beige-fg">{product.tag}</span></span>
                <span className="shrink-0 text-sm font-semibold tabular-nums">{product.clicks} lượt</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
      <h2 className="mb-4 font-heading text-xl">Danh sách kế hoạch</h2>
      <DataTable data={plans} columns={columns} getRowId={(row) => row.id} caption="Kế hoạch gợi ý" filters={filters} paramPrefix="plans." cardsUntil="wide" renderCard={(row) => (
        <article className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
          <header className="flex items-start justify-between gap-3">
            <span className="min-w-0"><span className="block font-mono text-xs text-gold-strong">{planCode(row)} · {row.productIds.length} sản phẩm</span><span className="block font-semibold">{row.name}</span></span>
            <StatusBadge kind="recommendationPlan" status={row.status} className="shrink-0 whitespace-nowrap" />
          </header>
          <p className="text-sm">{segmentSummary(row.segment, preferences, categories)}</p>
          <p className="text-sm text-muted-foreground">{period(row)}{row.status !== "Draft" && ` · ${row.recipientCount} khách`}{row.clickRate !== null && ` · Bấm ${percent.format(row.clickRate)}`}</p>
          <div className="mt-auto"><Actions plan={row} /></div>
        </article>
      )} emptyTitle="Không có kế hoạch phù hợp" emptyDescription="Thử từ khóa khác hoặc bỏ bớt bộ lọc." />
    </>
  );
}
