"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/brand/page-header";
import { RatingStars } from "@/components/brand/rating-stars";
import { StatTile } from "@/components/brand/stat-tile";
import { StatusBadge } from "@/components/brand/status-badge";
import { ChartCard } from "@/components/data/chart-card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { screen } from "@/lib/screens";
import { ageGroupFixture, attentionFeedbackFixture, categoryAgeRevenueFixture, categoryRatingFixture, coPurchaseFixture, genderFixture, monthlyLowRatingFixture, overviewFixture, topPreferencesFixture, weeklyFeedbackFixture } from "../reports.fixture";
import type { CategoryAgeRevenue } from "../types";

const percent = new Intl.NumberFormat("vi-VN", { style: "percent", maximumFractionDigits: 1 });
const rating = new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const millions = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });
const dateTime = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });

const tabTrigger = "min-h-12 flex-none rounded-none px-4 font-label text-sm uppercase tracking-wider";

export function ManagerDashboard() {
  const s = screen("M1");
  const overview = overviewFixture;
  return (
    <>
      <PageHeader eyebrow={s.code} title={s.title} description={s.description} />
      <Tabs defaultValue="overview" className="gap-6">
        <TabsList variant="line" className="h-auto w-full justify-start overflow-x-auto border-b border-border">
          <TabsTrigger value="overview" className={tabTrigger}>Tổng quan</TabsTrigger>
          <TabsTrigger value="customers" className={tabTrigger}>Báo cáo khách hàng</TabsTrigger>
          <TabsTrigger value="analytics" className={tabTrigger}>Phân tích</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatTile label="Tổng khách hàng" value={overview.totalCustomers} />
            <StatTile label="Khách mới 30 ngày" value={overview.newCustomers30d} change={{ value: 12, suffix: "%", label: "so với 30 ngày trước", tone: "positive" }} />
            <StatTile label="Phản hồi mới" value={overview.newFeedback} change={{ value: 3, label: "so với hôm qua", tone: "negative" }} />
            <StatTile label="Điểm trung bình" value={overview.avgRating === null ? "—" : `${rating.format(overview.avgRating)}/5`} />
            <StatTile label="Khảo sát đang mở" value={overview.openSurveys} />
          </div>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <ChartCard title="Phản hồi theo tuần" description="Tổng phản hồi và số phản hồi ≤ 2 sao, 8 tuần gần nhất." type="bar" data={weeklyFeedbackFixture} categoryKey="week" categoryLabel="Tuần bắt đầu"
              series={[{ key: "total", label: "Tổng phản hồi" }, { key: "lowRating", label: "≤ 2 sao" }]} />
            <AttentionList />
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

function AttentionList() {
  return (
    <section aria-labelledby="attention-title" className="min-w-0 rounded-lg border border-border bg-card p-6">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="attention-title" className="font-heading text-xl">Phản hồi cần chú ý</h2>
        <Link href="/manager/feedback" className="inline-flex min-h-12 items-center gap-1 font-label text-sm uppercase tracking-wider text-gold-strong hover:underline">
          Xem hộp phản hồi<ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </header>
      <ul className="divide-y divide-border">
        {attentionFeedbackFixture.map((item) => (
          <li key={item.id}>
            <Link href={`/manager/feedback/${item.id}`} className="block space-y-1 py-3 hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring">
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm"><span className="font-semibold">{item.customerName}</span><span className="text-muted-foreground"> · {item.productName}</span></span>
                <StatusBadge kind="feedback" status={item.status} />
              </span>
              <RatingStars value={item.rating} />
              <span className="block truncate text-sm italic text-muted-foreground">“{item.excerpt}”</span>
              <span className="block text-xs text-muted-foreground"><time dateTime={item.createdAt}>{dateTime.format(new Date(item.createdAt))}</time></span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Category × age group revenue. A table keeps exact values readable; color only reinforces magnitude. */
function RevenueHeatmap({ data }: { data: readonly CategoryAgeRevenue[] }) {
  const categories = [...new Set(data.map((cell) => cell.category))];
  const ageGroups = [...new Set(data.map((cell) => cell.ageGroup))];
  const max = Math.max(...data.map((cell) => cell.revenue), 1);
  const value = (category: string, ageGroup: string) => data.find((cell) => cell.category === category && cell.ageGroup === ageGroup)?.revenue ?? 0;
  return (
    <section aria-labelledby="heatmap-title" className="min-w-0 rounded-lg border border-border bg-card p-6 lg:col-span-2">
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
    <section aria-labelledby="copurchase-title" className="min-w-0 rounded-lg border border-border bg-card p-6 lg:col-span-2">
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
