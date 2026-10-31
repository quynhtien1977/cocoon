// Static data for A1 until GET admin/accounts is wired up. Delete when api.ts lands.
import type { AccountListItem } from "./types";

export const accountsFixture: AccountListItem[] = [
  { id: 1, fullName: "Nguyễn Văn An", email: "an.nguyen@cocoon.demo", phone: "0900 000 101", role: "Admin", status: "Active", lastLoginAt: "2026-10-29T10:45:00+07:00" },
  { id: 2, fullName: "Trần Thị Hương", email: "huong.tran@cocoon.demo", phone: "0900 000 102", role: "Manager", status: "Active", lastLoginAt: "2026-10-29T09:12:00+07:00" },
  { id: 3, fullName: "Lê Hoàng Minh", email: "minh.le@cocoon.demo", phone: "0900 000 103", role: "Staff", status: "Active", lastLoginAt: "2026-10-28T16:30:00+07:00" },
  { id: 4, fullName: "Phạm Quỳnh Anh", email: "quynhanh.pham@example.com", phone: "0900 000 104", role: "Customer", status: "Active", lastLoginAt: "2026-10-25T21:10:00+07:00" },
  { id: 5, fullName: "Võ Tuấn Kiệt", email: "kiet.vo@cocoon.demo", phone: "0900 000 105", role: "Staff", status: "Locked", lastLoginAt: "2026-10-18T14:02:00+07:00" },
  { id: 6, fullName: "Đỗ Ngọc Mai", email: "ngocmai.do@example.com", phone: "0900 000 106", role: "Customer", status: "Locked", lastLoginAt: "2026-10-02T08:45:00+07:00" },
  { id: 7, fullName: "Bùi Khánh Linh", email: "linh.bui@cocoon.demo", phone: "0900 000 107", role: "Staff", status: "Active", lastLoginAt: "2026-10-29T08:20:00+07:00" },
  { id: 8, fullName: "Hồ Gia Bảo", email: "bao.ho@cocoon.demo", phone: null, role: "Manager", status: "Active", lastLoginAt: "2026-10-27T17:05:00+07:00" },
  { id: 9, fullName: "Mai Anh Thư", email: "thu.mai@example.com", phone: "0900 000 109", role: "Customer", status: "Active", lastLoginAt: "2026-10-20T19:40:00+07:00" },
  { id: 10, fullName: "Đinh Gia Hân", email: "han.dinh@example.com", phone: null, role: "Customer", status: "Active", lastLoginAt: null },
  { id: 11, fullName: "Lâm Quang Vinh", email: "vinh.lam@cocoon.demo", phone: "0900 000 111", role: "Staff", status: "Active", lastLoginAt: "2026-10-26T11:15:00+07:00" },
  { id: 12, fullName: "Cao Bảo Ngọc", email: "ngoc.cao@example.com", phone: "0900 000 112", role: "Customer", status: "Active", lastLoginAt: "2026-10-22T07:55:00+07:00" },
];
