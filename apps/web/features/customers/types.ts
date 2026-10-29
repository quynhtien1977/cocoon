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
