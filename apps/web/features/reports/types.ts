// Response shapes for reports/* (spec 6.2). Replace with lib/api/schema.d.ts types once P3 publishes the DTOs.

export interface ReportOverview {
  totalCustomers: number;
  newCustomers30d: number;
  newFeedback: number;
  avgRating: number | null;
  openSurveys: number;
  newCustomersThisMonth: number;
  ratingCount: number;
  completedResponses: number;
}

export interface WeeklyFeedback { week: string; total: number; lowRating: number }
export interface AgeGroupCount { group: string; customers: number }
export interface GenderCount { gender: string; customers: number }
export interface PreferenceCount { preference: string; customers: number }
export interface CategoryRating { category: string; avgRating: number; feedbackCount: number }
export interface MonthlyLowRating { month: string; lowRatingRate: number }

/** reports/purchases/categories: revenue in VND per category × age group. */
export interface CategoryAgeRevenue { category: string; ageGroup: string; revenue: number }

export interface CoPurchasePair { productA: string; productB: string; bothCount: number; confidence: number }

export interface AttentionFeedback {
  id: number;
  customerName: string;
  productName: string;
  rating: number;
  excerpt: string;
  status: "New" | "Accepted" | "Assigned";
  orderCode: string;
  createdAt: string;
}

/** Editorial highlight under the overview; static copy until reports expose insights. */
export interface ReportInsight { id: string; icon: "coffee" | "leaf" | "clock"; eyebrow: string; title: string; body: string }
