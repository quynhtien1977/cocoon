// Row shape for GET feedback (spec 6.2). Replace with lib/api/schema.d.ts types once P3 publishes the DTO.

export type FeedbackStatus = "New" | "Accepted" | "Assigned" | "Replied" | "Closed";

export interface FeedbackListItem {
  id: number;
  customerName: string;
  productName: string;
  categoryName: string;
  rating: number;
  content: string;
  status: FeedbackStatus;
  /** Staff the feedback is assigned to; null before Assigned. */
  assigneeName: string | null;
  /** True when written after a purchase (has OrderItemId), shown as "Đã mua". */
  verifiedPurchase: boolean;
  createdAt: string;
}
