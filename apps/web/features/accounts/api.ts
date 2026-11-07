import { apiRequest } from "@/lib/api/client";
import { loadAllPages } from "@/lib/api/pages";
import type { AccountRole } from "@/lib/auth/roles";
import { roleOrdinal, toCreateAccountRequest } from "./schemas";
import type { AccountDraft, AccountListItem } from "./types";

export interface AccountCreated { id: number; email: string; role: AccountRole; temporaryPassword: string; mustChangePassword: boolean }

export const loadAccounts = (signal?: AbortSignal) => loadAllPages<AccountListItem>("/admin/accounts", signal);
export const createAccount = (draft: AccountDraft) => apiRequest<AccountCreated>("/admin/accounts", { method: "POST", json: toCreateAccountRequest(draft) });
export const changeAccountRole = (id: number, role: AccountRole) => apiRequest<void>(`/admin/accounts/${id}/role`, { method: "PATCH", json: { role: roleOrdinal[role] } });
export const changeAccountStatus = (id: number, isActive: boolean) => apiRequest<void>(`/admin/accounts/${id}/status`, { method: "PATCH", json: { isActive } });
export const deleteAccount = (id: number) => apiRequest<void>(`/admin/accounts/${id}`, { method: "DELETE" });
