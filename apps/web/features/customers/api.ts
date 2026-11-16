import { apiRequest } from "@/lib/api/client";
import { loadAllPages } from "@/lib/api/pages";
import type { CreateCustomerBody } from "./schemas";
import type { CustomerDetail, CustomerFeedback, CustomerListItem, CustomerOrder, CustomerSurvey, Preference } from "./types";

/**
 * POST /customers (decision 15/11/2026): no temporary password any more; the customer gets an email code to set their own.
 * invitationSent=false means the account exists but the email failed: offer resendInvitation.
 */
export interface CustomerCreated { id: number; email: string; mustChangePassword: boolean; invitationSent: boolean }

/** New email code for a customer who has not set a password: 409 ALREADY_ACTIVATED, 429 TOO_MANY_REQUESTS, 503 EMAIL_*. */
export const resendInvitation = (id: number) => apiRequest<{ sent: boolean }>(`/customers/${id}/invitation`, { method: "POST" });

export const loadCustomers = (signal?: AbortSignal) => loadAllPages<CustomerListItem>("/customers", signal);
export const loadPreferences = (signal?: AbortSignal) => apiRequest<Preference[]>("/preferences", { signal });

interface RecommendationRow { id: number; productName: string; score: number; status: "Active" | "Clicked" | "Dismissed" | "Expired"; reasons: { label: string }[] }

/** M4 profile plus its tabs. */
export async function loadCustomerDetail(id: number, signal?: AbortSignal): Promise<CustomerDetail> {
  const [profile, orders, feedback, surveys, recommendations] = await Promise.all([
    apiRequest<Omit<CustomerDetail, "orders" | "feedback" | "surveys" | "recommendations">>(`/customers/${id}`, { signal }),
    loadAllPages<CustomerOrder>(`/customers/${id}/orders`, signal),
    loadAllPages<CustomerFeedback>(`/customers/${id}/feedback`, signal),
    loadAllPages<CustomerSurvey>(`/customers/${id}/surveys`, signal),
    apiRequest<RecommendationRow[]>(`/customers/${id}/recommendations`, { signal }),
  ]);
  return {
    ...profile, orders, feedback, surveys,
    recommendations: recommendations.map((row) => ({
      id: row.id, productName: row.productName, score: row.score, reason: row.reasons.map((reason) => reason.label).join(" · "),
      state: row.status === "Clicked" || row.status === "Dismissed" ? row.status : "None",
    })),
  };
}

export const createCustomer = (body: CreateCustomerBody) => apiRequest<CustomerCreated>("/customers", { method: "POST", json: body });
export const lockCustomer = (id: number) => apiRequest<void>(`/customers/${id}/lock`, { method: "POST" });
export const unlockCustomer = (id: number) => apiRequest<void>(`/customers/${id}/unlock`, { method: "POST" });
export const deleteCustomer = (id: number) => apiRequest<void>(`/customers/${id}`, { method: "DELETE" });
