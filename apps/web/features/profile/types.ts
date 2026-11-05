import type { AccountRole } from "@/lib/auth/roles";

/** GET me for internal accounts (MeResponse in AuthController.cs); customer-only fields are left out. */
export interface StaffProfile {
  id: number;
  email: string;
  role: AccountRole;
  fullName: string;
  phone: string | null;
  mustChangePassword: boolean;
}

export interface ProfileDraft { fullName: string; phone: string }
export interface PasswordDraft { currentPassword: string; newPassword: string; confirmPassword: string }
