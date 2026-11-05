import { apiRequest } from "@/lib/api/client";
import { loadAllPages } from "@/lib/api/pages";
import type { CreateCustomerBody } from "./schemas";
import type { CustomerDetail, CustomerFeedback, CustomerListItem, CustomerOrder, CustomerSurvey, Preference } from "./types";

export interface CustomerCreated { id: number; email: string; temporaryPassword: string }

export const loadCustomers = (signal?: AbortSignal) => loadAllPages<CustomerListItem>("/customers", signal);
export const loadPreferences = (signal?: AbortSignal) => apiRequest<Preference[]>("/preferences", { signal });

/** M4 profile plus its tabs. Recommendations stay empty until GET customers/{id}/recommendations is implemented. */
export async function loadCustomerDetail(id: number, signal?: AbortSignal): Promise<CustomerDetail> {
  const [profile, orders, feedback, surveys] = await Promise.all([
    apiRequest<Omit<CustomerDetail, "orders" | "feedback" | "surveys" | "recommendations">>(`/customers/${id}`, { signal }),
    loadAllPages<CustomerOrder>(`/customers/${id}/orders`, signal),
    loadAllPages<CustomerFeedback>(`/customers/${id}/feedback`, signal),
    loadAllPages<CustomerSurvey>(`/customers/${id}/surveys`, signal),
  ]);
  return { ...profile, orders, feedback, surveys, recommendations: [] };
}

export const createCustomer = (body: CreateCustomerBody) => apiRequest<CustomerCreated>("/customers", { method: "POST", json: body });
export const lockCustomer = (id: number) => apiRequest<void>(`/customers/${id}/lock`, { method: "POST" });
export const unlockCustomer = (id: number) => apiRequest<void>(`/customers/${id}/unlock`, { method: "POST" });
export const deleteCustomer = (id: number) => apiRequest<void>(`/customers/${id}`, { method: "DELETE" });
