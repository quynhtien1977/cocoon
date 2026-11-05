// Matches src/Cocoon.Application/Reports/ReportContracts.cs; the API declares no report schemas in schema.d.ts.
// Percentages are 0–100; rates (lowRatingRate) are 0–1. See db/REPORTS_SQL.md for each definition.

/** Optional [from, to) bounds as ISO 8601; omitted means unbounded (to defaults to now). */
export interface ReportRange { from?: string; to?: string }

export interface ReportOverview {
  totalCustomers: number;
  newCustomers30d: number;
  /** Feedback still in status New, created in the period. */
  newFeedback: number;
  avgRating: number | null;
  openSurveys: number;
  newCustomersThisMonth: number;
  ratingCount: number;
  completedResponses: number;
}

export interface CustomerAgeReport { items: { group: string; customers: number; percentage: number }[]; totalCustomers: number; asOf: string }
export interface CustomerGenderReport { items: { gender: string; customers: number; percentage: number }[]; totalCustomers: number; asOf: string }
/** Denominator is consenting customers; multi-select, so shares can sum past 100%. */
export interface CustomerPreferenceReport { items: { preferenceId: number; preference: string; customers: number; percentage: number }[]; consentingCustomers: number; multiSelect: boolean }

export interface FeedbackRatingReport {
  feedbackCount: number;
  avgRating: number | null;
  distribution: { rating: number; feedbackCount: number; percentage: number }[];
  /** month is "YYYY-MM" (UTC). */
  byMonth: { month: string; feedbackCount: number; avgRating: number; lowRatingRate: number }[];
  byProduct: { productId: number; product: string; feedbackCount: number; avgRating: number }[];
  byCategory: { categoryId: number; category: string; feedbackCount: number; avgRating: number }[];
}

/** Completed orders only; revenue in VND per category × age group. */
export interface CategoryPurchaseReport { items: { categoryId: number; category: string; ageGroup: string; revenue: number; quantity: number; orderCount: number }[]; asOf: string }

export interface CustomerReports { age: CustomerAgeReport; gender: CustomerGenderReport; preferences: CustomerPreferenceReport }
export interface ActivityReports { overview: ReportOverview; ratings: FeedbackRatingReport; purchases: CategoryPurchaseReport }
