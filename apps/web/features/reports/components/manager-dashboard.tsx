"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ArrowRight, ClipboardList, MessageSquareWarning, Star, UserPlus, Users } from "lucide-react";
import { StatTile } from "@/components/brand/stat-tile";
import { ChartCard } from "@/components/data/chart-card";
import { useApiData } from "@/lib/api/use-api-data";
import { loadActivityReports, loadCustomerReports } from "../api";
import { presetFilter, toReportRange, type ReportFilter } from "../date-range";
import { reportSheets } from "../export-excel";
import { AnalyticsPreview, CustomerPreview, linkClass, monthLabel, percent, rating } from "./report-parts";
import { ReportPage } from "./report-page";

/** Period-bound report data that follows a date filter; changing the filter reloads with a fresh loading state. */
export function useActivityReports() {
  const [filter, setFilter] = useState<ReportFilter>(() => presetFilter("all"));
  const load = useCallback((signal: AbortSignal) => loadActivityReports(toReportRange(filter.range), signal), [filter]);
  const activity = useApiData(load, "Chưa tải được số liệu trong kỳ. Kiểm tra kết nối rồi thử lại.");
  // Retry with the period change so the loading state shows and a previous error clears.
  const changeFilter = (next: ReportFilter) => { setFilter(next); activity.retry(); };
  return { filter, changeFilter, activity };
}

export const loadCustomersError = "Chưa tải được báo cáo khách hàng. Kiểm tra kết nối rồi thử lại.";

/** M1: KPIs, feedback charts and short previews that link to the full report pages (M17, M18). */
export function ManagerDashboard() {
  const { filter, changeFilter, activity } = useActivityReports();
  const customers = useApiData(loadCustomerReports, loadCustomersError);
  const overview = activity.data?.overview;
  const ratings = activity.data?.ratings;
  const monthly = (ratings?.byMonth ?? []).map((row) => ({ month: monthLabel(row.month), total: row.feedbackCount, lowRating: Math.round(row.feedbackCount * row.lowRatingRate) }));
  const lowTotal = ratings?.distribution.filter((row) => row.rating <= 4).reduce((sum, row) => sum + row.feedbackCount, 0) ?? 0;
  const distribution = (ratings?.distribution ?? []).map((row) => ({ rating: `${row.rating} sao`, feedbackCount: row.feedbackCount }));
  const chartState = { loading: activity.loading, error: activity.error, onRetry: activity.retry };
  const sheets = activity.data && customers.data ? () => reportSheets(filter, activity.data!, customers.data!) : null;

  return (
    <ReportPage title="Tổng quan quản trị CRM & Khách hàng" description="Dữ liệu khách hàng, phản hồi và khảo sát của Cocoon trong kỳ báo cáo." section="Tổng quan"
      filter={filter} onFilterChange={changeFilter} sheets={sheets}>
      <div className="space-y-6">
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
          <CustomerPreview data={customers.data} state={customers} />
          <AnalyticsPreview data={activity.data} state={activity} />
        </div>
      </div>
    </ReportPage>
  );
}
