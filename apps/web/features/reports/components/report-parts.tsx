"use client";

import { useId, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Star } from "lucide-react";
import { chartColor } from "@/components/data/chart-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ActivityReports, CategoryPurchaseReport, CustomerReports } from "../types";

// Shared by the M1 overview and the report pages (M19 analytics, M20 customer report).
export const percent = new Intl.NumberFormat("vi-VN", { style: "percent", maximumFractionDigits: 1 });
export const rating = new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const millions = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });
/** API percentages are 0–100. */
export const share = (value: number) => percent.format(value / 100);
export const day = (isoDate: string) => isoDate.split("-").reverse().join("/");
export const monthLabel = (month: string) => month.split("-").reverse().join("/");
const ageLabel = (group: string) => /\d/.test(group) ? `${group} tuổi` : group;
/** Order of age_bucket 0–5 in db/REPORTS_SQL.md. */
const ageOrder = ["<18", "18–24", "25–34", "35–44", "≥45", "Chưa cung cấp"];
export const card = "min-w-0 rounded-lg border border-border bg-card p-4 sm:p-6";
export const linkClass = "inline-flex min-h-12 items-center gap-1 font-label text-sm uppercase tracking-wider text-gold-strong hover:underline";
export interface LoadState { loading: boolean; error: string | null; retry: () => void }

/** Loading or error body for a section whose data has not arrived. */
export function Pending({ state, label }: { state: LoadState; label: string }) {
  if (state.loading) return <div role="status"><span className="sr-only">Đang tải {label}</span><Skeleton className="h-40 w-full" /></div>;
  return (
    <div role="alert" className="rounded-lg border border-destructive p-6">
      <p>{state.error}</p>
      <Button type="button" variant="outline" className="mt-3" onClick={state.retry}>Thử lại</Button>
    </div>
  );
}

function PreviewCard({ title, action, href, children }: { title: string; action: string; href: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={card}>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-x-3 border-b border-border pb-2">
        <h2 id={id} className="font-heading text-xl">{title}</h2>
        <Link href={href} className={linkClass}>{action}<ArrowRight className="size-4" aria-hidden="true" /></Link>
      </header>
      {children}
    </section>
  );
}

const subheading = "font-label text-xs uppercase tracking-wider text-muted-foreground";

export function CustomerPreview({ data, state }: { data: CustomerReports | null; state: LoadState }) {
  if (!data) return <PreviewCard title="Phân bổ khách hàng" action="Xem báo cáo" href="/manager/reports/customers"><Pending state={state} label="phân bổ khách hàng" /></PreviewCard>;
  const genders = data.gender.items;
  const offset = (index: number) => genders.slice(0, index).reduce((sum, item) => sum + item.percentage, 0);
  const donut = genders.map((_, index) => `${chartColor(index)} ${offset(index)}% ${offset(index + 1)}%`).join(", ");
  return (
    <PreviewCard title="Phân bổ khách hàng" action="Xem báo cáo" href="/manager/reports/customers">
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
      {data.preferences.items.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Chưa có khách nào chọn nhu cầu.</p> : (
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

export function AnalyticsPreview({ data, state }: { data: ActivityReports | null; state: LoadState }) {
  if (!data) return <PreviewCard title="Danh mục & doanh số" action="Xem phân tích" href="/manager/reports/analytics"><Pending state={state} label="phân tích danh mục" /></PreviewCard>;
  const revenue = new Map<string, number>();
  for (const cell of data.purchases.items) revenue.set(cell.category, (revenue.get(cell.category) ?? 0) + cell.revenue);
  const topRevenue = [...revenue].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const [previous, latest] = data.ratings.byMonth.slice(-2);
  return (
    <PreviewCard title="Danh mục & doanh số" action="Xem phân tích" href="/manager/reports/analytics">
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
export function RevenueHeatmap({ data, state }: { data: CategoryPurchaseReport | undefined; state: LoadState }) {
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
            <table className="w-full min-w-120 border-separate border-spacing-1 text-sm">
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
