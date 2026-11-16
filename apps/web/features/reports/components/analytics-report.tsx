"use client";

import { ChartCard } from "@/components/data/chart-card";
import { activitySheets } from "../export-excel";
import { useActivityReports } from "./manager-dashboard";
import { RevenueHeatmap, monthLabel, percent, rating } from "./report-parts";
import { ReportPage } from "./report-page";

/** M19 (Báo cáo › Phân tích): category ratings, low-rating trend and revenue by age group, for the chosen period. */
export function AnalyticsReport() {
  const { filter, changeFilter, activity } = useActivityReports();
  const ratings = activity.data?.ratings;
  // Same rows as the M1 tab this chart came from.
  const monthly = (ratings?.byMonth ?? []).map((row) => ({ month: monthLabel(row.month), total: row.feedbackCount, lowRating: Math.round(row.feedbackCount * row.lowRatingRate), lowRatingRate: row.lowRatingRate }));
  const chartState = { loading: activity.loading, error: activity.error, onRetry: activity.retry };
  const sheets = activity.data ? () => activitySheets(filter, activity.data!, new Date(), "Báo cáo phân tích — Cocoon") : null;

  return (
    <ReportPage title="Phân tích" description="Điểm đánh giá theo danh mục, xu hướng phản hồi ≤ 4 sao và doanh số theo nhóm tuổi trong kỳ báo cáo." section="Phân tích"
      fileSection="phan-tich" filter={filter} onFilterChange={changeFilter} sheets={sheets}>
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Điểm trung bình theo danh mục" type="horizontal-bar" data={ratings?.byCategory ?? []} categoryKey="category" categoryLabel="Danh mục"
          series={[{ key: "avgRating", label: "Điểm TB" }]} formatValue={(value) => rating.format(value)} maxValue={5} {...chartState} />
        <ChartCard title="Tỷ lệ phản hồi ≤ 4 sao theo tháng" type="line" data={monthly} categoryKey="month" categoryLabel="Tháng"
          series={[{ key: "lowRatingRate", label: "Tỷ lệ ≤ 4 sao" }]} formatValue={(value) => percent.format(value)} {...chartState} />
        <RevenueHeatmap data={activity.data?.purchases} state={activity} />
      </div>
    </ReportPage>
  );
}
