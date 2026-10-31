// Row shape for GET customers (spec 6.2). Replace with lib/api/schema.d.ts types once P3 publishes the DTO.

export type CustomerStatus = "Active" | "Locked";

export interface CustomerListItem {
  id: number;
  code: string;
  fullName: string;
  email: string;
  phone: string | null;
  age: number | null;
  gender: string | null;
  preferences: string[];
  orderCount: number;
  lastOrderAt: string | null;
  joinedAt: string;
  status: CustomerStatus;
}

/** Form side of CreateCustomerRequest plus the preferences chosen on M3. */
export interface CustomerDraft {
  fullName: string;
  email: string;
  phone: string;
  /** yyyy-mm-dd from <input type="date">; empty means unknown. */
  dateOfBirth: string;
  gender: string;
  address: string;
  preferences: string[];
}

export type OrderStatus = "Completed" | "Cancelled" | "Returned";
export type RecommendationState = "Clicked" | "Dismissed" | "None";

export interface CustomerOrder { id: number; code: string; placedAt: string; itemCount: number; total: number; status: OrderStatus }
export interface CustomerFeedback { id: number; productName: string; rating: number; content: string; createdAt: string; status: "New" | "Accepted" | "Assigned" | "Replied" | "Closed" }
export interface CustomerSurvey { id: number; title: string; sentAt: string; status: "NotDone" | "Done" }
export interface CustomerRecommendation { id: number; productName: string; reason: string; score: number; state: RecommendationState }

/** GET customers/{id} and its tab endpoints (spec 6.2). */
export interface CustomerDetail extends CustomerListItem {
  address: string | null;
  dateOfBirth: string | null;
  totalSpent: number;
  orders: CustomerOrder[];
  feedback: CustomerFeedback[];
  surveys: CustomerSurvey[];
  recommendations: CustomerRecommendation[];
}
