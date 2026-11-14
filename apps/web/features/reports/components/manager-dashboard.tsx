"use client";

import { useCallback, useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ClipboardList, FileDown, MessageSquareWarning, Star, UserPlus, Users } from "lucide-react";
import { PageHeader } from "@/components/brand/page-header";
import { StatTile } from "@/components/brand/stat-tile";
import { ChartCard, chartColor } from "@/components/data/chart-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiData } from "@/lib/api/use-api-data";
import { loadActivityReports, loadCustomerReports, periodRange, reportPeriods, type ReportPeriod } from "../api";
import type { ActivityReports, CategoryPurchaseReport, CustomerReports } from "../types";

const percent = new Intl.NumberFormat("vi-VN", { style: "percent", maximumFractionDigits: 1 });
const rating = new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const millions = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });
/** API percentages are 0–100. */
const share = (value: number) => percent.format(value / 100);
const day = (isoDate: string) => isoDate.split("-").reverse().join("/");
const monthLabel = (month: string) => month.split("-").reverse().join("/");
const ageLabel = (group: string) => /\d/.test(group) ? `${group} tuổi` : group;
/** Order of age_bucket 0–5 in db/REPORTS_SQL.md. */
const ageOrder = ["<18", "18–24", "25–34", "35–44", "≥45", "Chưa cung cấp"];

const tabTrigger = "min-h-12 flex-none rounded-none px-4 font-label text-sm uppercase tracking-wider";
const card = "min-w-0 rounded-lg border border-border bg-card p-4 sm:p-6";
const linkClass = "inline-flex min-h-12 items-center gap-1 font-label text-sm uppercase tracking-wider text-gold-strong hover:underline";

type Tab = "overview" | "customers" | "analytics";
interface LoadState { loading: boolean; error: string | null; retry: () => void }

export function ManagerDashboard() {
  const id = useId();
  const [tab, setTab] = useState<Tab>("overview");
  const [period, setPeriod] = useState<ReportPeriod>("all");
  const customers = useApiData(loadCustomerReports, "Chưa tải được báo cáo khách hàng. Kiểm tra kết nối rồi thử lại.");
  const loadActivity = useCallback((signal: AbortSignal) => loadActivityReports(periodRange(period), signal), [period]);
  const activity = useApiData(loadActivity, "Chưa tải được số liệu trong kỳ. Kiểm tra kết nối rồi thử lại.");
  const overview = activity.data?.overview;
  const ratings = activity.data?.ratings;
  const monthly = (ratings?.byMonth ?? []).map((row) => ({ month: monthLabel(row.month), total: row.feedbackCount, lowRating: Math.round(row.feedbackCount * row.lowRatingRate), lowRatingRate: row.lowRatingRate }));
  const lowTotal = ratings?.distribution.filter((row) => row.rating <= 4).reduce((sum, row) => sum + row.feedbackCount, 0) ?? 0;
  const distribution = (ratings?.distribution ?? []).map((row) => ({ rating: `${row.rating} sao`, feedbackCount: row.feedbackCount }));
  const chartState = { loading: activity.loading, error: activity.error, onRetry: activity.retry };
  const people = customers.data ?? undefined;
  const customerChartState = { loading: customers.loading, error: customers.error, onRetry: customers.retry };

  return (
    <>
      <PageHeader title="Tổng quan quản trị CRM & Khách hàng" description="Dữ liệu khách hàng, phản hồi và khảo sát của Cocoon trong kỳ báo cáo." actions={
        <>
          <label htmlFor={`${id}-period`} className="sr-only">Kỳ báo cáo</label>
          {/* Retry with the period change so the loading state shows and a previous error clears. */}
          <select id={`${id}-period`} value={period} onChange={(event) => { setPeriod(event.target.value as ReportPeriod); activity.retry(); }}
            className="min-h-12 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring print:hidden">
            {reportPeriods.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <Button type="button" className="h-12 px-4 print:hidden" onClick={() => window.print()}><FileDown aria-hidden="true" />Xuất báo cáo PDF</Button>
        </>
      } />
      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)} className="gap-6">
        <TabsList variant="line" className="h-auto w-full justify-start overflow-x-auto border-b border-border print:hidden">
          <TabsTrigger value="overview" className={tabTrigger}>Tổng quan</TabsTrigger>
          <TabsTrigger value="customers" className={tabTrigger}>Báo cáo khách hàng</TabsTrigger>
          <TabsTrigger value="analytics" className={tabTrigger}>Phân tích</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
            <StatTile label="Tổng khách hàng" value={overview?.totalCustomers ?? "—"} icon={<Users />} hint={overview && `+${overview.newCustomersThisMonth} trong tháng này`} />
            <StatTile label="Khách mới 30 ngày" value={overview?.newCustomers30d ?? "—"} icon={<UserPlus />} hint="Tài khoản tạo trong 30 ngày qua" />
            <StatTile label="Phản hồi mới" value={overview?.newFeedback ?? "—"} icon={<MessageSquareWarning />} hint="Chờ tiếp nhận, gửi trong kỳ" />
            <StatTile label="Điểm trung bình" value={overview?.avgRating == null ? "—" : rating.format(overview.avgRating)} unit={overview?.avgRating == null ? undefined : "/5"} icon={<Star />}
              progress={overview?.avgRating == null ? undefined : overview.avgRating / 5} hint={overview && `Từ ${overview.ratingCount} lượt đánh giá`} />
            <StatTile label="Khảo sát đang mở" value={overview?.openSurveys ?? "—"} icon={<ClipboardList />} hint={overview && `${overview.completedResponses} lượt hoàn tất trong kỳ`} className="col-span-2 lg:col-span-1" />
          </div>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <ChartCard title="Phản hồi theo tháng" description={ratings && `Tổng phản hồi và số phản hồi ≤ 4 sao trong kỳ. Tổng ${ratings.feedbackCount} phản hồi, ${percent.format(lowTotal / Math.max(ratings.feedbackCount, 1))} ≤ 4 sao.`}
              type="bar" data={monthly} categoryKey="month" categoryLabel="Tháng"
              series={[{ key: "total", label: "Tổng phản hồi" }, { key: "lowRating", label: "≤ 4 sao" }]} height={400} {...chartState} />
            <ChartCard title="Phân bố điểm đánh giá" description="Số phản hồi theo số sao trong kỳ." type="bar" data={ratings?.feedbackCount ? distribution : []} categoryKey="rating" categoryLabel="Điểm"
              series={[{ key: "feedbackCount", label: "Phản hồi" }]} {...chartState}
              action={<Link href="/manager/feedback" className={linkClass}>Hộp phản hồi{overview && ` (${overview.newFeedback} mới)`}<ArrowRight className="size-4" aria-hidden="true" /></Link>} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <CustomerPreview data={customers.data} state={customers} onOpen={() => setTab("customers")} />
            <AnalyticsPreview data={activity.data} state={activity} onOpen={() => setTab("analytics")} />
          </div>
        </TabsContent>

        <TabsContent value="customers" className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Tỷ lệ khách hàng theo nhóm tuổi" description={people && `${people.age.totalCustomers} khách hàng đang hoạt động, tính đến ${day(people.age.asOf)}.`}
            type="bar" data={people?.age.items ?? []} categoryKey="group" categoryLabel="Nhóm tuổi" series={[{ key: "percentage", label: "Tỷ lệ khách hàng" }]} formatValue={share} {...customerChartState} />
          <ChartCard title="Cơ cấu giới tính" description={people && `${people.gender.totalCustomers} khách hàng đang hoạt động.`}
            type="pie" data={people?.gender.items ?? []} categoryKey="gender" categoryLabel="Giới tính" series={[{ key: "customers", label: "Khách hàng" }]} {...customerChartState} />
          <ChartCard title="Sở thích phổ biến" description={people && `Tỷ lệ trên ${people.preferences.consentingCustomers} khách đồng ý chia sẻ dữ liệu. Mỗi khách chọn được nhiều sở thích nên tổng có thể vượt 100%.`}
            type="horizontal-bar" data={people?.preferences.items ?? []} categoryKey="preference" categoryLabel="Sở thích"
            series={[{ key: "percentage", label: "Tỷ lệ khách hàng" }]} formatValue={share} className="lg:col-span-2" {...customerChartState} />
        </TabsContent>

        <TabsContent value="analytics" className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Điểm trung bình theo danh mục" type="horizontal-bar" data={ratings?.byCategory ?? []} categoryKey="category" categoryLabel="Danh mục"
            series={[{ key: "avgRating", label: "Điểm TB" }]} formatValue={(value) => rating.format(value)} maxValue={5} {...chartState} />
          <ChartCard title="Tỷ lệ phản hồi ≤ 4 sao theo tháng" type="line" data={monthly} categoryKey="month" categoryLabel="Tháng"
            series={[{ key: "lowRatingRate", label: "Tỷ lệ ≤ 4 sao" }]} formatValue={(value) => percent.format(value)} {...chartState} />
          <RevenueHeatmap data={activity.data?.purchases} state={activity} />
        </TabsContent>
      </Tabs>
    </>
  );
}

/** Loading or error body for a section whose data has not arrived. */
function Pending({ state, label }: { state: LoadState; label: string }) {
  if (state.loading) return <div role="status"><span className="sr-only">Đang tải {label}</span><Skeleton className="h-40 w-full" /></div>;
  return (
    <div role="alert" className="rounded-lg border border-destructive p-6">
      <p>{state.error}</p>
      <Button type="button" variant="outline" className="mt-3" onClick={state.retry}>Thử lại</Button>
    </div>
  );
}

function PreviewCard({ title, action, onOpen, children }: { title: string; action: string; onOpen: () => void; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={card}>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-x-3 border-b border-border pb-2">
        <h2 id={id} className="font-heading text-xl">{title}</h2>
        <Button type="button" variant="ghost" className="min-h-12 px-2 font-label uppercase tracking-wider text-gold-strong" onClick={onOpen}>{action}<ArrowRight aria-hidden="true" /></Button>
      </header>
      {children}
    </section>
  );
}

const subheading = "font-label text-xs uppercase tracking-wider text-muted-foreground";

function CustomerPreview({ data, state, onOpen }: { data: CustomerReports | null; state: LoadState; onOpen: () => void }) {
  if (!data) return <PreviewCard title="Phân bổ khách hàng" action="Xem báo cáo" onOpen={onOpen}><Pending state={state} label="phân bổ khách hàng" /></PreviewCard>;
  const genders = data.gender.items;
  const offset = (index: number) => genders.slice(0, index).reduce((sum, item) => sum + item.percentage, 0);
  const donut = genders.map((_, index) => `${chartColor(index)} ${offset(index)}% ${offset(index + 1)}%`).join(", ");
  return (
    <PreviewCard title="Phân bổ khách hàng" action="Xem báo cáo" onOpen={onOpen}>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className={subheading}>Độ tuổi</h3>
          <ul className="mt-3 space-y-3">
            {data.age.items.map((item) => (
              <li key={item.group} className="text-sm">
                <span className="flex justify-between gap-2"><span>{ageLabel(item.group)}</span><span className="font-semibold tabular-nums">{share(item.percentage)}</span></span>
                <span aria-hidden="true" className="mt-1 block h-1.5 bg-muted"><span className="block h-full bg-gold-strong" style={{ width: `${item.percentage}%` }} /></span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className={subheading}>Giới tính</h3>
          <div className="mt-3 flex items-center gap-4">
            <span aria-hidden="true" className="size-20 shrink-0 rounded-full" style={{ background: `radial-gradient(circle, var(--card) 52%, transparent 53%), conic-gradient(${donut || "var(--muted) 0% 100%"})` }} />
            <ul className="space-y-1 text-sm">
              {genders.map((item, index) => (
                <li key={item.gender} className="flex items-center gap-2">
                  <span aria-hidden="true" className="size-2.5 rounded-sm" style={{ background: chartColor(index) }} />
                  {item.gender}: <span className="font-semibold tabular-nums">{share(item.percentage)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <h3 className={`${subheading} mt-6`}>Mối quan tâm hàng đầu</h3>
      {data.preferences.items.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Chưa có khách nào chọn sở thích.</p> : (
        <ul className="mt-2 flex flex-wrap gap-2">
          {data.preferences.items.slice(0, 3).map((item) => (
            <li key={item.preferenceId} className="rounded-sm bg-status-beige-bg px-2 py-1 font-label text-xs uppercase tracking-wider text-status-beige-fg">
              {item.preference}: {share(item.percentage)}
            </li>
          ))}
        </ul>
      )}
    </PreviewCard>
  );
}

function AnalyticsPreview({ data, state, onOpen }: { data: ActivityReports | null; state: LoadState; onOpen: () => void }) {
  if (!data) return <PreviewCard title="Danh mục & doanh số" action="Xem phân tích" onOpen={onOpen}><Pending state={state} label="phân tích danh mục" /></PreviewCard>;
  const revenue = new Map<string, number>();
  for (const cell of data.purchases.items) revenue.set(cell.category, (revenue.get(cell.category) ?? 0) + cell.revenue);
  const topRevenue = [...revenue].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const [previous, latest] = data.ratings.byMonth.slice(-2);
  return (
    <PreviewCard title="Danh mục & doanh số" action="Xem phân tích" onOpen={onOpen}>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className={subheading}>Điểm theo danh mục</h3>
          {data.ratings.byCategory.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Chưa có đánh giá trong kỳ.</p> : (
            <ul className="mt-3 space-y-2 text-sm">
              {data.ratings.byCategory.slice(0, 4).map((item) => (
                <li key={item.categoryId} className="flex justify-between gap-2">
                  {item.category}
                  <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-gold-strong">{rating.format(item.avgRating)}<Star className="size-3.5" aria-hidden="true" /></span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className={subheading}>Doanh số theo danh mục</h3>
          {topRevenue.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Chưa có đơn hoàn thành trong kỳ.</p> : (
            <ul className="mt-3 space-y-2 text-sm">
              {topRevenue.map(([category, total]) => (
                <li key={category} className="flex justify-between gap-2">{category}<span className="font-semibold tabular-nums">{millions.format(total / 1_000_000)} triệu</span></li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {latest && (
        <p className="mt-6 flex flex-wrap justify-between gap-2 border-t border-border pt-4 text-sm">
          <span className="text-muted-foreground">Tỷ lệ phản hồi ≤ 4 sao ({monthLabel(latest.month)})</span>
          <span className={!previous || latest.lowRatingRate <= previous.lowRatingRate ? "font-semibold text-status-sage-fg" : "font-semibold text-status-danger-fg"}>
            {percent.format(latest.lowRatingRate)}{previous && ` (tháng trước ${percent.format(previous.lowRatingRate)})`}
          </span>
        </p>
      )}
    </PreviewCard>
  );
}

/** Category × age group revenue. A table keeps exact values readable; color only reinforces magnitude. */
function RevenueHeatmap({ data, state }: { data: CategoryPurchaseReport | undefined; state: LoadState }) {
  const cells = data?.items ?? [];
  const categories = [...new Set(cells.map((cell) => cell.category))];
  const ageGroups = [...new Set(cells.map((cell) => cell.ageGroup))].sort((a, b) => ageOrder.indexOf(a) - ageOrder.indexOf(b));
  const max = Math.max(...cells.map((cell) => cell.revenue), 1);
  const value = (category: string, ageGroup: string) => cells.find((cell) => cell.category === category && cell.ageGroup === ageGroup)?.revenue ?? 0;
  return (
    <section aria-labelledby="heatmap-title" className={`${card} lg:col-span-2`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 id="heatmap-title" className="font-heading text-xl">Doanh số danh mục × nhóm tuổi</h2>
        <span className="rounded-sm bg-muted px-2 py-1 text-xs font-semibold whitespace-nowrap text-muted-foreground">Đơn vị: triệu đồng</span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Đơn hoàn thành trong kỳ dựa theo độ tuổi.</p>
      {!data ? <div className="mt-4"><Pending state={state} label="doanh số" /></div>
        : cells.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">Chưa có đơn hoàn thành trong kỳ.</p> : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[480px] border-separate border-spacing-1 text-sm">
              <caption className="sr-only">Doanh số theo danh mục và nhóm tuổi, đơn vị triệu đồng</caption>
              <thead>
                <tr>
                  <th scope="col" className="p-2 text-left font-label text-xs uppercase tracking-wider text-muted-foreground">Danh mục</th>
                  {ageGroups.map((group) => <th key={group} scope="col" className="p-2 text-center font-label text-xs uppercase tracking-wider text-muted-foreground">{group}</th>)}
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category}>
                    <th scope="row" className="p-2 text-left font-normal">{category}</th>
                    {ageGroups.map((group) => {
                      const revenue = value(category, group);
                      const ratio = revenue / max;
                      return (
                        <td key={group} className="h-12 rounded-sm p-2 text-center tabular-nums"
                          style={{ background: `color-mix(in oklch, var(--chart-1) ${Math.round(ratio * 85)}%, var(--card))`, color: ratio > 0.6 ? "var(--primary)" : undefined, fontWeight: ratio > 0.6 ? 700 : undefined }}>
                          {millions.format(revenue / 1_000_000)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </section>
  );
}
