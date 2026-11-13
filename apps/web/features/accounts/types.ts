// Row shape for GET admin/accounts (spec 6.2). Replace with lib/api/schema.d.ts types once P3 publishes the DTO.
import type { AccountRole } from "@/lib/auth/roles";

export type AccountStatus = "Active" | "Locked";

export interface AccountListItem {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  role: AccountRole;
  status: AccountStatus;
  lastLoginAt: string | null;
}

/** Form side of CreateAccountRequest; the API issues the password. Phone is required for managers. */
export interface AccountDraft {
  fullName: string;
  email: string;
  phone: string;
  role: AccountRole;
}
