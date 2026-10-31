"use client";

import { useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ClipboardList, Clock, Coffee, FileDown, Leaf, MessageSquareWarning, Star, UserPlus, Users } from "lucide-react";
import { PageHeader } from "@/components/brand/page-header";
import { RatingStars } from "@/components/brand/rating-stars";
import { StatTile } from "@/components/brand/stat-tile";
import { StatusBadge } from "@/components/brand/status-badge";
import { ChartCard, chartColor } from "@/components/data/chart-card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { screen } from "@/lib/screens";
import { ageGroupFixture, attentionFeedbackFixture, categoryAgeRevenueFixture, categoryRatingFixture, coPurchaseFixture, genderFixture, insightsFixture, monthlyLowRatingFixture, overviewFixture, reportPeriodsFixture, topPreferencesFixture, weeklyFeedbackFixture } from "../reports.fixture";
import type { CategoryAgeRevenue, ReportInsight } from "../types";

const percent = new Intl.NumberFormat("vi-VN", { style: "percent", maximumFractionDigits: 1 });
const rating = new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const millions = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });
const dateTime = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });

const tabTrigger = "min-h-12 flex-none rounded-none px-4 font-label text-sm uppercase tracking-wider";
const card = "min-w-0 rounded-lg border border-border bg-card p-4 sm:p-6";
const linkClass = "inline-flex min-h-12 items-center gap-1 font-label text-sm uppercase tracking-wider text-gold-strong hover:underline";
const insightIcons = { coffee: Coffee, leaf: Leaf, clock: Clock } satisfies Record<ReportInsight["icon"], unknown>;

type Tab = "overview" | "customers" | "analytics";

export function ManagerDashboard() {
  const s = screen("M1");
  const id = useId();
  const [tab, setTab] = useState<Tab>("overview");
  const [period, setPeriod] = useState(reportPeriodsFixture[0]);
  const overview = overviewFixture;
  const weeklyTotal = weeklyFeedbackFixture.reduce((sum, week) => sum + week.total, 0);
  const weeklyLow = weeklyFeedbackFixture.reduce((sum, week) => sum + week.lowRating, 0);

  return (
    <>
      <PageHeader eyebrow={s.code} title="Tổng quan quản trị CRM & Khách hàng" description="Dữ liệu khách hàng, phản hồi và khảo sát của Cocoon trong kỳ báo cáo." actions={
        <>
          <label htmlFor={`${id}-period`} className="sr-only">Kỳ báo cáo</label>
          {/* Static phase: every period shows the same fixture until reports/* takes a period parameter. */}
          <select id={`${id}-period`} value={period} onChange={(event) => setPeriod(event.target.value)}
            className="min-h-12 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring print:hidden">
            {reportPeriodsFixture.map((item) => <option key={item}>{item}</option>)}
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
            <StatTile label="Tổng khách hàng" value={overview.totalCustomers} icon={<Users />} hint={`+${overview.newCustomersThisMonth} trong tháng này`} />
            <StatTile label="Khách mới 30 ngày" value={overview.newCustomers30d} icon={<UserPlus />} change={{ value: 12, suffix: "%", label: "so với 30 ngày trước", tone: "positive" }} />
            <StatTile label="Phản hồi mới" value={overview.newFeedback} icon={<MessageSquareWarning />} change={{ value: 3, label: "so với hôm qua", tone: "negative" }} />
            <StatTile label="Điểm trung bình" value={overview.avgRating === null ? "—" : rating.format(overview.avgRating)} unit={overview.avgRating === null ? undefined : "/5"} icon={<Star />}
              progress={overview.avgRating === null ? undefined : overview.avgRating / 5} hint={`Từ ${overview.ratingCount} lượt đánh giá`} />
            <StatTile label="Khảo sát đang mở" value={overview.openSurveys} icon={<ClipboardList />} hint={`${overview.completedResponses} lượt hoàn tất`} className="col-span-2 lg:col-span-1" />
          </div>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <ChartCard title="Phản hồi theo tuần" description={`Tổng phản hồi và số phản hồi ≤ 2 sao, 8 tuần gần nhất. Tổng ${weeklyTotal} phản hồi, ${percent.format(weeklyLow / Math.max(weeklyTotal, 1))} ≤ 2 sao.`}
              type="bar" data={weeklyFeedbackFixture} categoryKey="week" categoryLabel="Tuần bắt đầu"
              series={[{ key: "total", label: "Tổng phản hồi" }, { key: "lowRating", label: "≤ 2 sao" }]} />
            <AttentionList total={overview.newFeedback} />
          </div>
          <InsightStrip />
          <div className="grid gap-6 lg:grid-cols-2">
            <CustomerPreview onOpen={() => setTab("customers")} />
            <AnalyticsPreview onOpen={() => setTab("analytics")} />
          </div>
        </TabsContent>

        <TabsContent value="customers" className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Khách hàng theo nhóm tuổi" type="bar" data={ageGroupFixture} categoryKey="group" categoryLabel="Nhóm tuổi" series={[{ key: "customers", label: "Khách hàng" }]} />
          <ChartCard title="Cơ cấu giới tính" type="pie" data={genderFixture} categoryKey="gender" categoryLabel="Giới tính" series={[{ key: "customers", label: "Khách hàng" }]} />
          <ChartCard title="Sở thích phổ biến" description="Số khách có sở thích, gồm tự khai báo và suy ra từ khảo sát." type="horizontal-bar" data={topPreferencesFixture} categoryKey="preference" categoryLabel="Sở thích"
            series={[{ key: "customers", label: "Khách hàng" }]} className="lg:col-span-2" />
        </TabsContent>

        <TabsContent value="analytics" className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Điểm trung bình theo danh mục" type="horizontal-bar" data={categoryRatingFixture} categoryKey="category" categoryLabel="Danh mục"
            series={[{ key: "avgRating", label: "Điểm TB" }]} formatValue={(value) => rating.format(value)} />
          <ChartCard title="Tỷ lệ phản hồi ≤ 2 sao theo tháng" type="line" data={monthlyLowRatingFixture} categoryKey="month" categoryLabel="Tháng"
            series={[{ key: "lowRatingRate", label: "Tỷ lệ ≤ 2 sao" }]} formatValue={(value) => percent.format(value)} />
          <RevenueHeatmap data={categoryAgeRevenueFixture} />
          <CoPurchaseTable />
        </TabsContent>
      </Tabs>
    </>
  );
}

function AttentionList({ total }: { total: number }) {
  return (
    <section aria-labelledby="attention-title" className={card}>
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3">
        <div>
          <h2 id="attention-title" className="font-heading text-xl">Phản hồi cần chú ý</h2>
          <p className="mt-1 text-sm text-muted-foreground">Phản hồi mới, điểm thấp hoặc chưa xử lý xong.</p>
        </div>
        <Link href="/manager/feedback" className={linkClass}>Xem tất cả ({total})<ArrowRight className="size-4" aria-hidden="true" /></Link>
      </header>
      <ul className="divide-y divide-border">
        {attentionFeedbackFixture.map((item) => (
          <li key={item.id}>
            <Link href="/manager/feedback" aria-label={`Mở hộp phản hồi: ${item.customerName}, ${item.productName}`} className="-mx-2 block space-y-1 rounded-md px-2 py-3 hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring">
              <span className="flex items-start justify-between gap-2">
                <span className="min-w-0 text-sm"><span className="font-semibold">{item.customerName}</span><span className="text-muted-foreground"> · {item.productName}</span></span>
                <span className="shrink-0"><StatusBadge kind="feedback" status={item.status} /></span>
              </span>
              <RatingStars value={item.rating} />
              <span className="block truncate text-sm italic text-muted-foreground">“{item.excerpt}”</span>
              <span className="flex justify-between gap-2 font-label text-xs uppercase tracking-wider text-muted-foreground">
                <span>Đơn #{item.orderCode}</span>
                <time dateTime={item.createdAt}>{dateTime.format(new Date(item.createdAt))}</time>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function InsightStrip() {
  return (
    <section aria-label="Điểm nhấn trong kỳ" className="grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3">
      {insightsFixture.map((insight) => {
        const Icon = insightIcons[insight.icon];
        return (
          <article key={insight.id} className="flex gap-4 bg-card p-4 sm:p-6">
            <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-gold-strong"><Icon className="size-5" /></span>
            <div className="min-w-0">
              <p className="font-label text-xs uppercase tracking-wider text-muted-foreground">{insight.eyebrow}</p>
              <h3 className="mt-1 font-heading text-lg">{insight.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{insight.body}</p>
            </div>
          </article>
        );
      })}
    </section>
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

function CustomerPreview({ onOpen }: { onOpen: () => void }) {
  const totalAge = ageGroupFixture.reduce((sum, item) => sum + item.customers, 0);
  const totalGender = genderFixture.reduce((sum, item) => sum + item.customers, 0);
  const share = (index: number) => genderFixture.slice(0, index).reduce((sum, item) => sum + item.customers, 0) / Math.max(totalGender, 1) * 100;
  const donut = genderFixture.map((_, index) => `${chartColor(index)} ${share(index)}% ${share(index + 1)}%`).join(", ");
  return (
    <PreviewCard title="Phân bổ khách hàng" action="Xem báo cáo" onOpen={onOpen}>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className={subheading}>Độ tuổi</h3>
          <ul className="mt-3 space-y-3">
            {ageGroupFixture.map((item) => {
              const share = item.customers / Math.max(totalAge, 1);
              return (
                <li key={item.group} className="text-sm">
                  <span className="flex justify-between gap-2"><span>{item.group} tuổi</span><span className="font-semibold tabular-nums">{percent.format(share)}</span></span>
                  <span aria-hidden="true" className="mt-1 block h-1.5 bg-muted"><span className="block h-full bg-gold-strong" style={{ width: `${share * 100}%` }} /></span>
                </li>
              );
            })}
          </ul>
        </div>
        <div>
          <h3 className={subheading}>Giới tính</h3>
          <div className="mt-3 flex items-center gap-4">
            <span aria-hidden="true" className="size-20 shrink-0 rounded-full" style={{ background: `radial-gradient(circle, var(--card) 52%, transparent 53%), conic-gradient(${donut})` }} />
            <ul className="space-y-1 text-sm">
              {genderFixture.map((item, index) => (
                <li key={item.gender} className="flex items-center gap-2">
                  <span aria-hidden="true" className="size-2.5 rounded-sm" style={{ background: chartColor(index) }} />
                  {item.gender}: <span className="font-semibold tabular-nums">{percent.format(item.customers / Math.max(totalGender, 1))}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <h3 className={`${subheading} mt-6`}>Mối quan tâm hàng đầu</h3>
      <ul className="mt-2 flex flex-wrap gap-2">
        {topPreferencesFixture.slice(0, 3).map((item) => (
          <li key={item.preference} className="rounded-sm bg-status-beige-bg px-2 py-1 font-label text-xs uppercase tracking-wider text-status-beige-fg">
            {item.preference}: {percent.format(item.customers / Math.max(totalAge, 1))}
          </li>
        ))}
      </ul>
    </PreviewCard>
  );
}

function AnalyticsPreview({ onOpen }: { onOpen: () => void }) {
  const [topPair] = coPurchaseFixture;
  const [previous, latest] = monthlyLowRatingFixture.slice(-2);
  return (
    <PreviewCard title="Danh mục & cặp mua cùng" action="Xem phân tích" onOpen={onOpen}>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className={subheading}>Điểm theo danh mục</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {categoryRatingFixture.slice(0, 4).map((item) => (
              <li key={item.category} className="flex justify-between gap-2">
                {item.category}
                <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-gold-strong">{rating.format(item.avgRating)}<Star className="size-3.5" aria-hidden="true" /></span>
              </li>
            ))}
          </ul>
        </div>
        {topPair && (
          <div>
            <h3 className={subheading}>Cặp mua kèm cao nhất</h3>
            <div className="mt-3 rounded-md border border-border bg-muted p-3">
              <p className="font-label text-sm uppercase tracking-wider text-gold-strong">Độ tin cậy {percent.format(topPair.confidence)}</p>
              <p className="mt-1 text-sm">{topPair.productA} + {topPair.productB}</p>
              <p className="mt-2 text-xs text-muted-foreground">{topPair.bothCount} khách đã mua cả hai sản phẩm.</p>
            </div>
          </div>
        )}
      </div>
      {previous && latest && (
        <p className="mt-6 flex flex-wrap justify-between gap-2 border-t border-border pt-4 text-sm">
          <span className="text-muted-foreground">Tỷ lệ phản hồi ≤ 2 sao ({latest.month})</span>
          <span className={latest.lowRatingRate <= previous.lowRatingRate ? "font-semibold text-status-sage-fg" : "font-semibold text-status-danger-fg"}>
            {percent.format(latest.lowRatingRate)} (kỳ trước {percent.format(previous.lowRatingRate)})
          </span>
        </p>
      )}
    </PreviewCard>
  );
}

/** Category × age group revenue. A table keeps exact values readable; color only reinforces magnitude. */
function RevenueHeatmap({ data }: { data: readonly CategoryAgeRevenue[] }) {
  const categories = [...new Set(data.map((cell) => cell.category))];
  const ageGroups = [...new Set(data.map((cell) => cell.ageGroup))];
  const max = Math.max(...data.map((cell) => cell.revenue), 1);
  const value = (category: string, ageGroup: string) => data.find((cell) => cell.category === category && cell.ageGroup === ageGroup)?.revenue ?? 0;
  return (
    <section aria-labelledby="heatmap-title" className={`${card} lg:col-span-2`}>
      <h2 id="heatmap-title" className="font-heading text-xl">Doanh số danh mục × nhóm tuổi</h2>
      <p className="mt-1 text-sm text-muted-foreground">Triệu đồng, đơn hoàn thành trong 12 tháng.</p>
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
                  const share = revenue / max;
                  return (
                    <td key={group} className="h-12 rounded-sm p-2 text-center tabular-nums"
                      style={{ background: `color-mix(in oklch, var(--chart-1) ${Math.round(share * 85)}%, var(--card))`, color: share > 0.6 ? "var(--primary)" : undefined, fontWeight: share > 0.6 ? 700 : undefined }}>
                      {millions.format(revenue / 1_000_000)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CoPurchaseTable() {
  return (
    <section aria-labelledby="copurchase-title" className={`${card} lg:col-span-2`}>
      <h2 id="copurchase-title" className="font-heading text-xl">Cặp sản phẩm hay mua cùng</h2>
      <p className="mt-1 text-sm text-muted-foreground">Độ tin cậy = số khách mua cả hai / số khách mua sản phẩm A. Chỉ tính cặp có ít nhất 3 khách.</p>
      <Table className="mt-4">
        <TableCaption className="sr-only">Cặp sản phẩm hay mua cùng</TableCaption>
        <TableHeader>
          <TableRow><TableHead>Sản phẩm A</TableHead><TableHead>Sản phẩm B</TableHead><TableHead className="text-right">Số khách</TableHead><TableHead className="text-right">Độ tin cậy</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {coPurchaseFixture.map((pair) => (
            <TableRow key={`${pair.productA}-${pair.productB}`}>
              <TableCell>{pair.productA}</TableCell>
              <TableCell>{pair.productB}</TableCell>
              <TableCell className="text-right tabular-nums">{pair.bothCount}</TableCell>
              <TableCell className="text-right tabular-nums">{percent.format(pair.confidence)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
