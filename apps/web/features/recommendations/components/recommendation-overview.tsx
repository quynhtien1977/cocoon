"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Bolt, CircleCheck, CircleStop, EyeOff, Pencil, MousePointerClick, PieChart, Plus, RefreshCw, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/brand/confirm-dialog";
import { PageHeader } from "@/components/brand/page-header";
import { StatTile } from "@/components/brand/stat-tile";
import { EmptyState } from "@/components/brand/empty-state";
import { StatusBadge, statusMap } from "@/components/brand/status-badge";
import { DataTable, type DataColumn, type DataFilter } from "@/components/data/data-table";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiData } from "@/lib/api/use-api-data";
import { screen } from "@/lib/screens";
import { cn } from "@/lib/utils";
import { deletePlan, endPlan, loadOverview, loadReport, rebuildRecommendations, type OverviewData } from "../api";
import { segmentSummary } from "../schemas";
import type { PlanStatus, RecommendationPlan } from "../types";

const date = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" });
const dateTime = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
const percent = new Intl.NumberFormat("vi-VN", { style: "percent", maximumFractionDigits: 1 });
// Icon actions with a tooltip, as in the survey and account lists.
const iconAction = "inline-flex size-12 items-center justify-center rounded-md hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring";

const period = (plan: RecommendationPlan) => `${date.format(new Date(plan.startAt))} – ${date.format(new Date(plan.endAt))}`;
const planCode = (plan: RecommendationPlan) => `KP-${plan.id}`;
const planHref = (plan: RecommendationPlan) => `/manager/recommendations/plans/${plan.id}`;
// The name is the keyboard route to the plan; mouse users can click anywhere on the row (DataTable rowHref).
const PlanLink = ({ plan }: { plan: RecommendationPlan }) => <Link href={planHref(plan)} className="font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">{plan.name}</Link>;

const filters: DataFilter<RecommendationPlan>[] = [
  { id: "status", label: "Trạng thái", options: (Object.keys(statusMap.recommendationPlan) as PlanStatus[]).map((value) => ({ value, label: statusMap.recommendationPlan[value][0] })), matches: (row, value) => row.status === value },
];

/** M13 route body: loads plans, the report and segment names, then hands them to RecommendationOverview. */
export function RecommendationOverviewPage() {
  const { data, loading, error, retry } = useApiData(loadOverview, "Chưa tải được tổng quan gợi ý. Kiểm tra kết nối rồi thử lại.");
  if (data) return <RecommendationOverview initial={data} />;
  if (loading) return <div role="status" className="space-y-4"><span className="sr-only">Đang tải tổng quan gợi ý</span><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>;
  return <div role="alert"><EmptyState title="Chưa tải được tổng quan gợi ý" description={error ?? "Hãy thử lại."} action={<Button type="button" className="h-12 px-4" onClick={retry}>Thử lại</Button>} /></div>;
}

export function RecommendationOverview({ initial }: { initial: OverviewData }) {
  const s = screen("M13");
  const { preferences, categories } = initial;
  const [plans, setPlans] = useState(initial.plans);
  const [report, setReport] = useState(initial.report);
  const [rebuilding, setRebuilding] = useState(false);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const active = plans.filter((plan) => plan.status === "Active").length;
  const builtAt = report.lastBuiltAt;

  async function rebuild() {
    setRebuilding(true);
    setNotice(null);
    let result;
    try {
      result = await rebuildRecommendations();
    } catch (reason) {
      setNotice({ text: reason instanceof Error && reason.message ? reason.message : "Chưa tính lại được gợi ý. Hãy thử lại.", ok: false });
      setRebuilding(false);
      return;
    }
    setNotice({ text: `Đã tính lại ${result.recommendationCount} gợi ý cho ${result.customerCount} khách hàng.`, ok: true });
    const { builtAt: lastBuiltAt } = result;
    // The rebuild already succeeded; if the stats refresh fails the older numbers stay, with the new build time.
    setReport(await loadReport().catch(() => report).then((next) => ({ ...next, lastBuiltAt })));
    setRebuilding(false);
  }
  // ConfirmDialog shows a thrown error and stays open, so state changes only after the API succeeds.
  async function end(plan: RecommendationPlan) {
    await endPlan(plan.id);
    setPlans((current) => current.map((item) => item.id === plan.id ? { ...item, status: "Ended" } : item));
    setNotice({ text: `Đã kết thúc “${plan.name}”.`, ok: true });
  }
  async function remove(plan: RecommendationPlan) {
    await deletePlan(plan.id);
    setPlans((current) => current.filter((item) => item.id !== plan.id));
    setNotice({ text: `Đã xóa bản nháp “${plan.name}”.`, ok: true });
  }

  // In the table every action keeps its own slot (edit, end, delete) so the same icon lines up on every row.
  const Actions = ({ plan, card = false }: { plan: RecommendationPlan; card?: boolean }) => {
    const slot = (action: ReactNode) => action || (card ? null : <span aria-hidden="true" />);
    return (
      <span className={card ? "flex flex-wrap items-center gap-1" : "grid grid-cols-[repeat(3,3rem)] items-center justify-end gap-1"}>
        {slot(plan.status === "Draft" && <Link href={planHref(plan)} aria-label={`Chỉnh sửa ${plan.name}`} title="Chỉnh sửa" className={iconAction}><Pencil className="size-5" aria-hidden="true" /></Link>)}
        {slot(plan.status === "Active" && (
          <ConfirmDialog portal="manager" title="Kết thúc kế hoạch?" description={`“${plan.name}” sẽ dừng ngay và không chạy lại được. Số liệu đã có vẫn được giữ.`} confirmLabel="Kết thúc kế hoạch"
            trigger={<Button type="button" variant="ghost" size="icon-lg" className="size-12 text-destructive" aria-label={`Kết thúc ${plan.name}`} title="Kết thúc kế hoạch"><CircleStop aria-hidden="true" /></Button>} onConfirm={() => end(plan)} />
        ))}
        {slot(plan.status === "Draft" && (
          <ConfirmDialog portal="manager" title="Xóa bản nháp kế hoạch?" description={`“${plan.name}” sẽ bị xóa. Không thể hoàn tác.`} confirmLabel="Xóa bản nháp"
            trigger={<Button type="button" variant="ghost" size="icon-lg" className="size-12 text-destructive" aria-label={`Xóa ${plan.name}`} title="Xóa bản nháp"><Trash2 aria-hidden="true" /></Button>} onConfirm={() => remove(plan)} />
        ))}
      </span>
    );
  };

  const columns: DataColumn<RecommendationPlan>[] = [
    { id: "name", header: "Kế hoạch", value: (row) => `${row.name} ${planCode(row)}`, sortable: true, cell: (row) => <span className="block w-64 whitespace-normal"><span className="block font-mono text-xs text-gold-strong">{planCode(row)}</span><span className="block"><PlanLink plan={row} /></span><span className="block text-xs text-muted-foreground">{row.productIds.length} sản phẩm</span></span> },
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
        <Button type="button" variant="outline" className="h-12 px-4" onClick={rebuild} disabled={rebuilding}><RefreshCw aria-hidden="true" />{rebuilding ? "Đang tính lại…" : "Tính lại gợi ý"}</Button>
        <Link href="/manager/recommendations/plans/new" className={cn(buttonVariants(), "h-12 px-4")}><Plus aria-hidden="true" />Tạo kế hoạch mới</Link>
      </>} />
      <p className="-mt-3 mb-6 text-sm text-muted-foreground">Lần tính gần nhất: {builtAt ? <time dateTime={builtAt}>{dateTime.format(new Date(builtAt))}</time> : "chưa có gợi ý nào"}</p>
      <div aria-live="polite">{notice && (notice.ok
        ? <p className="mb-6 flex items-center gap-2 rounded-md border border-border bg-status-sage-bg p-3 text-sm text-status-sage-fg"><CircleCheck className="size-4 shrink-0" aria-hidden="true" />{notice.text}</p>
        : <p role="alert" className="mb-6 rounded-md border border-destructive p-3 text-sm text-destructive">{notice.text}</p>)}</div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatTile label="Độ phủ gợi ý" value={percent.format(report.coverage)} icon={<PieChart />} progress={report.coverage} hint="Khách có ít nhất 1 gợi ý" />
        <StatTile label="Tỷ lệ bấm" value={percent.format(report.clickRate)} icon={<MousePointerClick />} progress={report.clickRate} hint="Gợi ý được bấm trên gợi ý đã tạo" />
        <StatTile label="Tỷ lệ bỏ qua" value={percent.format(report.dismissRate)} icon={<EyeOff />} progress={report.dismissRate} hint="Khách chủ động bỏ qua" />
        <StatTile label="Kế hoạch đang chạy" value={active} unit={`/${plans.length}`} icon={<Bolt />} hint="Đang áp dụng cho khách" />
      </div>
      <section aria-labelledby="top-products" className="mb-6 min-w-0 rounded-lg border border-border bg-card p-4 sm:p-6">
        <h2 id="top-products" className="font-heading text-xl">Top sản phẩm được gợi ý</h2>
        <p className="mt-1 text-sm text-muted-foreground">Theo lượt bấm từ gợi ý, rồi theo số lần được gợi ý.</p>
        {report.topProducts.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Chưa có gợi ý nào. Bấm “Tính lại gợi ý” để tạo gợi ý cho khách.</p> : (
          <ol className="mt-3 divide-y divide-border">
            {report.topProducts.map((product, index) => (
              <li key={product.id} className="flex items-center gap-3 py-3">
                <span aria-hidden="true" className="w-6 shrink-0 font-heading text-lg lining-nums text-gold-strong">{index + 1}</span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{product.name}</span><span className="mt-1 inline-block rounded-sm bg-status-beige-bg px-2 py-0.5 font-label text-xs text-status-beige-fg">{product.recommendationCount} lần gợi ý</span></span>
                <span className="shrink-0 text-sm font-semibold tabular-nums">{product.clicks} lượt bấm</span>
              </li>
            ))}
          </ol>
        )}
      </section>
      <h2 className="mb-4 font-heading text-xl">Danh sách kế hoạch</h2>
      <DataTable data={plans} columns={columns} getRowId={(row) => row.id} caption="Kế hoạch gợi ý" filters={filters} paramPrefix="plans." cardsUntil="wide" rowHref={planHref} renderCard={(row) => (
        <article className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
          <header className="flex items-start justify-between gap-3">
            <span className="min-w-0"><span className="block font-mono text-xs text-gold-strong">{planCode(row)} · {row.productIds.length} sản phẩm</span><span className="block"><PlanLink plan={row} /></span></span>
            <StatusBadge kind="recommendationPlan" status={row.status} className="shrink-0 whitespace-nowrap" />
          </header>
          <p className="text-sm">{segmentSummary(row.segment, preferences, categories)}</p>
          <p className="text-sm text-muted-foreground">{period(row)}{row.status !== "Draft" && ` · ${row.recipientCount} khách`}{row.clickRate !== null && ` · Bấm ${percent.format(row.clickRate)}`}</p>
          <div className="mt-auto"><Actions plan={row} card /></div>
        </article>
      )} emptyTitle={plans.length ? "Không có kế hoạch phù hợp" : "Chưa có kế hoạch gợi ý"} emptyDescription={plans.length ? "Thử từ khóa khác hoặc bỏ bớt bộ lọc." : "Bấm “Tạo kế hoạch mới” để bắt đầu."} />
    </>
  );
}
