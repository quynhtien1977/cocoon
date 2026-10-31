// Matches FeedbackListItem and FeedbackDetail in FeedbackController.cs; the API declares no response types, so schema.d.ts has none.

export type FeedbackStatus = "New" | "Accepted" | "Assigned" | "Replied" | "Closed";

export interface FeedbackListItem {
  id: number;
  customerName: string;
  customerCode: string;
  /** Null when written without a purchase. */
  orderCode: string | null;
  productName: string;
  categoryName: string;
  rating: number;
  content: string;
  status: FeedbackStatus;
  /** Staff the feedback is assigned to; null before Assigned. */
  assigneeId: number | null;
  assigneeName: string | null;
  /** True when written after a purchase (has OrderItemId), shown as "Đã mua". */
  verifiedPurchase: boolean;
  createdAt: string;
}

export interface StaffOption { id: number; name: string }

export interface FeedbackReply { id: number; staffName: string; content: string; createdAt: string }

/** GET feedback/{id} for M6 and S2. */
export interface FeedbackDetail extends FeedbackListItem {
  /** Empty once the customer is deleted. */
  customerEmail: string;
  customerPhone: string | null;
  customerOrderCount: number;
  customerPreferences: string[];
  /** Empty and 0 when the feedback has no order line. */
  sku: string;
  price: number;
  orderCompletedAt: string | null;
  /** When each step was reached; missing steps are still ahead. */
  statusTimes: Partial<Record<FeedbackStatus, string>>;
  replies: FeedbackReply[];
}
