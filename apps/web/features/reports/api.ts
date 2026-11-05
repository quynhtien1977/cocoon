import { apiRequest } from "@/lib/api/client";
import type { ActivityReports, CategoryPurchaseReport, CustomerAgeReport, CustomerGenderReport, CustomerPreferenceReport, CustomerReports, FeedbackRatingReport, ReportOverview, ReportRange } from "./types";

export const reportPeriods = [
  { value: "all", label: "Toàn bộ thời gian" },
  { value: "30d", label: "30 ngày gần nhất" },
  { value: "month", label: "Tháng này" },
  { value: "last-month", label: "Tháng trước" },
  { value: "year", label: "Năm nay" },
] as const;
export type ReportPeriod = (typeof reportPeriods)[number]["value"];

/** Calendar bounds in the viewer's local time, sent as UTC instants. */
export function periodRange(period: ReportPeriod, now = new Date()): ReportRange {
  const year = now.getFullYear(), month = now.getMonth();
  switch (period) {
    case "30d": return { from: new Date(now.getTime() - 30 * 86_400_000).toISOString() };
    case "month": return { from: new Date(year, month, 1).toISOString() };
    case "last-month": return { from: new Date(year, month - 1, 1).toISOString(), to: new Date(year, month, 1).toISOString() };
    case "year": return { from: new Date(year, 0, 1).toISOString() };
    default: return {};
  }
}

const withRange = (path: string, range: ReportRange) => {
  const query = new URLSearchParams(Object.entries(range).filter((entry): entry is [string, string] => entry[1] !== undefined)).toString();
  return query ? `${path}?${query}` : path;
};

/** Current customer snapshot; these endpoints take no period. */
export async function loadCustomerReports(signal?: AbortSignal): Promise<CustomerReports> {
  const [age, gender, preferences] = await Promise.all([
    apiRequest<CustomerAgeReport>("/reports/customers/age", { signal }),
    apiRequest<CustomerGenderReport>("/reports/customers/gender", { signal }),
    apiRequest<CustomerPreferenceReport>("/reports/customers/preferences", { signal }),
  ]);
  return { age, gender, preferences };
}

export async function loadActivityReports(range: ReportRange, signal?: AbortSignal): Promise<ActivityReports> {
  const [overview, ratings, purchases] = await Promise.all([
    apiRequest<ReportOverview>(withRange("/reports/overview", range), { signal }),
    apiRequest<FeedbackRatingReport>(withRange("/reports/feedback/ratings", range), { signal }),
    apiRequest<CategoryPurchaseReport>(withRange("/reports/purchases/categories", range), { signal }),
  ]);
  return { overview, ratings, purchases };
}
