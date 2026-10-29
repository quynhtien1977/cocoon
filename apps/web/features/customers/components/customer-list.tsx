"use client";

import Link from "next/link";
import { UserPlus } from "lucide-react";
import { PageHeader } from "@/components/brand/page-header";
import { StatTile } from "@/components/brand/stat-tile";
import { StatusBadge } from "@/components/brand/status-badge";
import { DataTable, type DataColumn, type DataFilter } from "@/components/data/data-table";
import { buttonVariants } from "@/components/ui/button";
import { screen } from "@/lib/screens";
import { cn } from "@/lib/utils";
import { customersFixture, preferencesFixture } from "../customers.fixture";
import type { CustomerListItem } from "../types";

const date = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" });
const decimal = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });

const ageGroups = [
  { value: "18-24", label: "18–24", min: 0, max: 24 },
  { value: "25-34", label: "25–34", min: 25, max: 34 },
  { value: "35-44", label: "35–44", min: 35, max: 44 },
  { value: "45+", label: "45+", min: 45, max: Infinity },
];

const columns: DataColumn<CustomerListItem>[] = [
  { id: "code", header: "Mã KH", value: (row) => row.code, sortable: true, cell: (row) => <span className="font-mono text-xs">{row.code}</span> },
  {
    // Value includes email so search matches it; sorting still leads with the name.
    id: "name", header: "Họ tên", value: (row) => `${row.fullName} ${row.email}`, sortable: true,
    cell: (row) => <span className="block min-w-40"><span className="block font-semibold">{row.fullName}</span><span className="block text-xs text-muted-foreground">{row.email}</span></span>,
  },
  { id: "phone", header: "Điện thoại", value: (row) => row.phone, cell: (row) => row.phone ?? <span className="text-muted-foreground">—</span> },
  { id: "age", header: "Tuổi", value: (row) => row.age, sortable: true, searchable: false, cell: (row) => <span className="tabular-nums">{row.age ?? "—"}{row.gender && <span className="text-muted-foreground"> · {row.gender}</span>}</span> },
  {
    id: "preferences", header: "Sở thích", value: (row) => row.preferences.join(", "),
    cell: (row) => <span className="flex min-w-40 flex-wrap gap-1">{row.preferences.map((preference) => <span key={preference} className="rounded-sm bg-status-beige-bg px-2 py-0.5 font-label text-xs text-status-beige-fg">{preference}</span>)}</span>,
  },
  { id: "orders", header: "Số đơn", value: (row) => row.orderCount, sortable: true, searchable: false, cell: (row) => <span className="tabular-nums">{row.orderCount}</span> },
  { id: "lastOrder", header: "Mua gần nhất", value: (row) => row.lastOrderAt, sortable: true, searchable: false, cell: (row) => row.lastOrderAt ? date.format(new Date(row.lastOrderAt)) : <span className="text-muted-foreground">Chưa mua</span> },
  { id: "status", header: "Trạng thái", value: (row) => row.status, searchable: false, cell: (row) => <StatusBadge kind="account" status={row.status} /> },
  { id: "actions", header: "Thao tác", value: () => null, searchable: false, cell: (row) => <Link href={`/manager/customers/${row.id}`} aria-label={`Xem hồ sơ ${row.fullName}`} className="inline-flex min-h-12 items-center font-semibold whitespace-nowrap text-gold-strong hover:underline">Xem hồ sơ</Link> },
];

const filters: DataFilter<CustomerListItem>[] = [
  { id: "gender", label: "Giới tính", options: ["Nữ", "Nam", "Khác"].map((value) => ({ value, label: value })), matches: (row, value) => row.gender === value },
  { id: "age", label: "Nhóm tuổi", options: ageGroups.map(({ value, label }) => ({ value, label })), matches: (row, value) => { const group = ageGroups.find((item) => item.value === value); return !!group && row.age !== null && row.age >= group.min && row.age <= group.max; } },
  { id: "preference", label: "Sở thích", options: preferencesFixture.map((value) => ({ value, label: value })), matches: (row, value) => row.preferences.includes(value) },
  { id: "status", label: "Trạng thái", options: [{ value: "Active", label: "Hoạt động" }, { value: "Locked", label: "Đã khóa" }], matches: (row, value) => row.status === value },
];

export function CustomerList() {
  const s = screen("M2");
  const customers = customersFixture;
  const active = customers.filter((row) => row.status === "Active").length;
  const counts = new Map<string, number>();
  for (const preference of customers.flatMap((row) => row.preferences)) counts.set(preference, (counts.get(preference) ?? 0) + 1);
  const [topPreference, topCount] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? ["—", 0];
  const avgOrders = customers.length ? customers.reduce((sum, row) => sum + row.orderCount, 0) / customers.length : 0;

  return (
    <>
      <PageHeader eyebrow={s.code} title="Danh sách khách hàng" description={s.description} actions={
        <Link href="/manager/customers/new" className={cn(buttonVariants(), "h-12 px-4")}><UserPlus aria-hidden="true" />Thêm khách hàng</Link>
      } />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Tổng khách hàng" value={customers.length} />
        <StatTile label="Đang hoạt động" value={active} change={{ value: Math.round((active / Math.max(customers.length, 1)) * 100), suffix: "%", label: "tổng số khách", tone: "neutral" }} />
        <StatTile label="Sở thích phổ biến" value={topPreference} change={{ value: topCount, label: "khách", tone: "neutral" }} />
        <StatTile label="Đơn trung bình mỗi khách" value={decimal.format(avgOrders)} />
      </div>
      <DataTable data={customers} columns={columns} getRowId={(row) => row.id} caption="Khách hàng" filters={filters}
        emptyTitle="Không tìm thấy khách hàng" emptyDescription="Thử từ khóa khác hoặc bỏ bớt bộ lọc." />
    </>
  );
}
