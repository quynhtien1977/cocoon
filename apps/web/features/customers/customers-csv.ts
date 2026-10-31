import type { CustomerListItem } from "./types";

const statusLabels: Record<CustomerListItem["status"], string> = { Active: "Hoạt động", Locked: "Đã khóa" };
const day = (value: string | null) => value ? value.slice(0, 10) : "";
// Quote every cell; a leading =, +, - or @ is prefixed so spreadsheets never evaluate it as a formula.
const cell = (value: string | number | null) => `"${String(value ?? "").replace(/^[=+\-@]/, "'$&").replace(/"/g, '""')}"`;

/** CSV with a UTF-8 BOM so Excel keeps Vietnamese diacritics. */
export function customersToCsv(rows: readonly CustomerListItem[]): string {
  const header = ["Mã KH", "Họ tên", "Email", "Điện thoại", "Tuổi", "Giới tính", "Sở thích", "Số đơn", "Mua gần nhất", "Ngày gia nhập", "Trạng thái"];
  const lines = rows.map((row) => [row.code, row.fullName, row.email, row.phone, row.age, row.gender, row.preferences.join("; "), row.orderCount, day(row.lastOrderAt), day(row.joinedAt), statusLabels[row.status]].map(cell).join(","));
  return `﻿${[header.map(cell).join(","), ...lines].join("\r\n")}`;
}
