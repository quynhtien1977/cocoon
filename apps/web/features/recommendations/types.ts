// Form and list shapes for M13/M14. The API declares no response types yet, so these follow spec 6.2 and PlanUpsertRequest.
import type { SegmentFilterValue } from "@/components/data/segment-filter-builder";

export type PlanStatus = "Draft" | "Active" | "Ended";

export interface PlanProduct { id: number; name: string; categoryName: string; preferences: string[] }

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

export interface RecommendationStats { coverage: number; clickRate: number; dismissRate: number; lastBuiltAt: string }
export interface WeeklyInteraction { week: string; interactions: number }
export interface TopProduct { id: number; name: string; tag: string; clicks: number }
