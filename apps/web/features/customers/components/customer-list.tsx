"use client";

import Link from "next/link";
import { ChevronRight, Download, Heart, Leaf, ShoppingBag, UserCheck, UserPlus, Users } from "lucide-react";
import { PageHeader } from "@/components/brand/page-header";
import { StatTile } from "@/components/brand/stat-tile";
import { StatusBadge } from "@/components/brand/status-badge";
import { DataTable, type DataColumn, type DataFilter } from "@/components/data/data-table";
import { Button, buttonVariants } from "@/components/ui/button";
import { screen } from "@/lib/screens";
import { cn } from "@/lib/utils";
import { customersToCsv } from "../customers-csv";
import { customersFixture, preferencesFixture } from "../customers.fixture";
import type { CustomerListItem } from "../types";

const date = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" });
const decimal = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat("vi-VN", { style: "percent", maximumFractionDigits: 1 });

const ageGroups = [
  { value: "18-24", label: "18–24", min: 0, max: 24 },
  { value: "25-34", label: "25–34", min: 25, max: 34 },
  { value: "35-44", label: "35–44", min: 35, max: 44 },
  { value: "45+", label: "45+", min: 45, max: Infinity },
];

const chip = "rounded-sm bg-status-beige-bg px-2 py-0.5 font-label text-xs text-status-beige-fg";
const Preferences = ({ row }: { row: CustomerListItem }) => <span className="flex min-w-40 flex-wrap gap-1">{row.preferences.map((preference) => <span key={preference} className={chip}>{preference}</span>)}</span>;

const columns: DataColumn<CustomerListItem>[] = [
  { id: "code", header: "Mã KH", value: (row) => row.code, sortable: true, cell: (row) => <span className="font-mono text-xs">{row.code}</span> },
  {
    // Value includes email so search matches it; sorting still leads with the name.
    id: "name", header: "Họ tên", value: (row) => `${row.fullName} ${row.email}`, sortable: true,
    cell: (row) => (
      <span className="block min-w-40">
        <span className="block font-semibold">{row.fullName}</span>
        <span className="block text-xs text-muted-foreground">{row.email}</span>
        <span className="block text-xs text-muted-foreground">Gia nhập: {date.format(new Date(row.joinedAt))}</span>
      </span>
    ),
  },
  { id: "phone", header: "Điện thoại", value: (row) => row.phone, cell: (row) => row.phone ?? <span className="text-muted-foreground">—</span> },
  { id: "age", header: "Tuổi", value: (row) => row.age, sortable: true, searchable: false, cell: (row) => <span className="tabular-nums">{row.age ?? "—"}{row.gender && <span className="text-muted-foreground"> · {row.gender}</span>}</span> },
  { id: "preferences", header: "Sở thích", value: (row) => row.preferences.join(", "), cell: (row) => <Preferences row={row} /> },
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

/** Mobile row: the whole card opens M4, so its name differs from the table's "Xem hồ sơ …" link. */
function CustomerCard({ row }: { row: CustomerListItem }) {
  return (
    <Link href={`/manager/customers/${row.id}`} aria-label={`Hồ sơ ${row.fullName}, ${row.code}`}
      className={cn("block space-y-3 rounded-lg border border-border bg-card p-4 hover:border-gold focus-visible:outline-2 focus-visible:outline-ring", row.status === "Locked" && "opacity-80")}>
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block font-semibold">{row.fullName}</span>
          <span className="block font-mono text-xs text-muted-foreground">{row.code} · Gia nhập {date.format(new Date(row.joinedAt))}</span>
        </span>
        <StatusBadge kind="account" status={row.status} />
      </span>
      <span className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
        <span className="text-muted-foreground">Email</span><span className="truncate">{row.email}</span>
        <span className="text-muted-foreground">Điện thoại</span><span>{row.phone ?? "—"}</span>
        <span className="text-muted-foreground">Tuổi</span><span>{row.age ?? "—"}{row.gender && ` · ${row.gender}`}</span>
        <span className="text-muted-foreground">Đơn hàng</span><span className="tabular-nums">{row.orderCount} đơn · {row.lastOrderAt ? `gần nhất ${date.format(new Date(row.lastOrderAt))}` : "chưa mua"}</span>
      </span>
      {row.preferences.length > 0 && <Preferences row={row} />}
      <span className="flex items-center justify-end gap-1 font-semibold text-gold-strong">Xem hồ sơ<ChevronRight className="size-4" aria-hidden="true" /></span>
    </Link>
  );
}

function downloadCsv(rows: readonly CustomerListItem[]) {
  const url = URL.createObjectURL(new Blob([customersToCsv(rows)], { type: "text/csv;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: `khach-hang-${new Date().toISOString().slice(0, 10)}.csv` });
  link.click();
  URL.revokeObjectURL(url);
}

export function CustomerList() {
  const s = screen("M2");
  const customers = customersFixture;
  const active = customers.filter((row) => row.status === "Active").length;
  const counts = new Map<string, number>();
  for (const preference of customers.flatMap((row) => row.preferences)) counts.set(preference, (counts.get(preference) ?? 0) + 1);
  const [topPreference, topCount] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? ["—", 0];
  const avgOrders = customers.length ? customers.reduce((sum, row) => sum + row.orderCount, 0) / customers.length : 0;
  const buyers = customers.filter((row) => row.orderCount > 0).length;
  const total = Math.max(customers.length, 1);

  return (
    <>
      <PageHeader eyebrow={s.code} title="Danh sách khách hàng" description={`Hồ sơ ${customers.length} khách hàng: thông tin liên hệ, sở thích chăm sóc da và lịch sử mua hàng.`} actions={<>
        <Button type="button" variant="outline" className="h-12 px-4" onClick={() => downloadCsv(customers)}><Download aria-hidden="true" />Xuất file CSV</Button>
        <Link href="/manager/customers/new" className={cn(buttonVariants(), "h-12 px-4")}><UserPlus aria-hidden="true" />Thêm khách hàng</Link>
      </>} />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatTile label="Tổng khách hàng" value={customers.length} icon={<Users />} hint={`${customers.length - active} tài khoản đã khóa`} />
        <StatTile label="Đang hoạt động" value={active} unit={`/${customers.length}`} icon={<UserCheck />} progress={active / total} hint={`${percent.format(active / total)} tổng số khách`} />
        <StatTile label="Sở thích phổ biến" value={topPreference} icon={<Heart />} progress={topCount / total} hint={`${topCount} khách quan tâm`} />
        <StatTile label="Đơn trung bình mỗi khách" value={decimal.format(avgOrders)} unit="đơn" icon={<ShoppingBag />} progress={buyers / total} hint={`${buyers} khách đã mua ít nhất 1 đơn`} />
      </div>
      <DataTable data={customers} columns={columns} getRowId={(row) => row.id} caption="Khách hàng" filters={filters} renderCard={(row) => <CustomerCard row={row} />} cardsUntil="xl"
        emptyTitle="Không tìm thấy khách hàng" emptyDescription="Thử từ khóa khác hoặc bỏ bớt bộ lọc." />
      <aside aria-labelledby="heritage-title" className="mt-8 flex flex-col gap-6 rounded-lg border border-border bg-card p-4 sm:p-6 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-4">
          <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted text-gold-strong"><Leaf className="size-6" /></span>
          <div>
            <p className="font-label text-xs uppercase tracking-wider text-gold-strong">Chuẩn hóa dữ liệu nguồn gốc 2026</p>
            <h2 id="heritage-title" className="mt-1 font-heading text-xl">Thực vật học và cá nhân hóa chăm sóc da Việt Nam</h2>
            <p className="mt-1 max-w-prose text-sm text-muted-foreground">Hồ sơ khách hàng gắn với nguồn nguyên liệu bản địa: cà phê Đắk Lắk, bí đao, hoa hồng Cao Bằng và vỏ bưởi.</p>
          </div>
        </div>
        <dl className="flex shrink-0 gap-6 md:text-right">
          <div><dt className="sr-only">Thuần chay</dt><dd className="font-heading text-xl">100%</dd><dd className="font-label text-xs uppercase tracking-wider text-muted-foreground">Thuần chay</dd></div>
          <div className="border-l border-border pl-6"><dt className="sr-only">Chứng nhận</dt><dd className="font-heading text-xl">Leaping Bunny</dd><dd className="font-label text-xs uppercase tracking-wider text-muted-foreground">Không thử nghiệm trên động vật</dd></div>
        </dl>
      </aside>
    </>
  );
}
