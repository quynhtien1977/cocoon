import { apiRequest } from "@/lib/api/client";
import type { ActivityReports, CategoryPurchaseReport, CustomerAgeReport, CustomerGenderReport, CustomerPreferenceReport, CustomerReports, FeedbackRatingReport, ReportOverview, ReportRange } from "./types";

// Period presets and custom ranges live in ./date-range.ts.
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
