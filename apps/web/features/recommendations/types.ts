// Form and list shapes for M13/M14. The OpenAPI schema declares no response types for these, so they follow PlanView and RecommendationReport in src/.
import type { SegmentFilterValue } from "@/components/data/segment-filter-builder";

export type PlanStatus = "Draft" | "Active" | "Ended";

/** GET products row; only Active products can be added to a plan. */
export interface PlanProduct { id: number; name: string; categoryName: string; status: string; preferences: string[] }

export interface RecommendationPlan {
  id: number;
  name: string;
  goal: string | null;
  status: PlanStatus;
  startAt: string;
  endAt: string;
  segment: SegmentFilterValue;
  /** In display order, highest priority first. */
  productIds: number[];
  recipientCount: number;
  /** Null until the plan has run. */
  clickRate: number | null;
}

export interface PlanDraft {
  name: string;
  goal: string;
  /** yyyy-mm-dd from <input type="date">. */
  startAt: string;
  endAt: string;
  segment: SegmentFilterValue;
  productIds: number[];
}

export interface TopProduct { id: number; name: string; recommendationCount: number; clicks: number; dismissals: number; clickRate: number; dismissRate: number }

/** GET reports/recommendations (db/REPORTS_SQL.md); rates are 0–1 over recommendations generated, not impressions. */
export interface RecommendationReport {
  coverage: number;
  clickRate: number;
  dismissRate: number;
  activePlans: number;
  lastBuiltAt: string | null;
  topProducts: TopProduct[];
}

export interface PlanRunResult { audienceCount: number; recommendationCount: number }
export interface RebuildResult { customerCount: number; recommendationCount: number; builtAt: string }
export interface SegmentPreview { count: number; sample: { id: number; code: string; fullName: string; email: string; age: number | null; gender: string | null }[] }
