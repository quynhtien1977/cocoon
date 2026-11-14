"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Lock, LockOpen, Plus, Trash2, UserCog } from "lucide-react";
import { ConfirmDialog } from "@/components/brand/confirm-dialog";
import { PageHeader } from "@/components/brand/page-header";
import { StatusBadge } from "@/components/brand/status-badge";
import { DataTable, type DataColumn, type DataFilter } from "@/components/data/data-table";
import { Button, buttonVariants } from "@/components/ui/button";
import type { AccountRole } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
import { useApiData } from "@/lib/api/use-api-data";
import { changeAccountRole, changeAccountStatus, deleteAccount, loadAccounts } from "../api";
import { assignableRoles, roleLabels } from "../schemas";
import type { AccountListItem } from "../types";

const dateTime = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
const lastLogin = (row: AccountListItem) => row.lastLoginAt ? dateTime.format(new Date(row.lastLoginAt)) : "Chưa đăng nhập";
const iconButton = "size-12";

interface ActionHandlers {
  onRole: (row: AccountListItem, role: AccountRole) => Promise<void>;
  onToggleLock: (row: AccountListItem) => Promise<void>;
  onDelete: (row: AccountListItem) => Promise<void>;
}

/** Every change goes through ConfirmDialog naming the account and the consequence (spec 8.5). */
function AccountActions({ row, onRole, onToggleLock, onDelete }: { row: AccountListItem } & ActionHandlers) {
  const id = useId();
  const [role, setRole] = useState(row.role);
  const locked = row.status === "Locked";
  return (
    <span className="flex items-center justify-end gap-1">
      <ConfirmDialog portal="admin" title="Đổi vai trò tài khoản" description={`Chọn vai trò mới cho ${row.fullName}. Quyền truy cập thay đổi theo vai trò mới.`} confirmLabel="Lưu vai trò"
        trigger={<Button type="button" variant="ghost" size="icon-lg" className={iconButton} aria-label={`Đổi vai trò ${row.fullName}`} title="Đổi vai trò"><UserCog aria-hidden="true" /></Button>}
        onOpenChange={(open) => { if (open) setRole(row.role); }}
        onConfirm={() => onRole(row, role)}>
        <label htmlFor={`${id}-role`} className="grid gap-2 text-sm font-semibold">Vai trò
          <select id={`${id}-role`} value={role} onChange={(event) => setRole(event.target.value as AccountRole)} className="min-h-12 rounded-md border border-input bg-background px-3 text-sm font-normal focus-visible:outline-2 focus-visible:outline-ring">
            {assignableRoles.map((item) => <option key={item} value={item}>{roleLabels[item]}</option>)}
          </select>
        </label>
      </ConfirmDialog>
      <ConfirmDialog portal="admin" title={locked ? "Mở khóa tài khoản?" : "Khóa tài khoản?"} confirmLabel={locked ? "Mở khóa" : "Khóa tài khoản"}
        description={locked ? `${row.fullName} sẽ đăng nhập lại được.` : `${row.fullName} sẽ không đăng nhập được cho đến khi được mở khóa.`}
        trigger={<Button type="button" variant="ghost" size="icon-lg" className={iconButton} aria-label={`${locked ? "Mở khóa" : "Khóa"} ${row.fullName}`} title={locked ? "Mở khóa" : "Khóa"}>{locked ? <LockOpen aria-hidden="true" /> : <Lock aria-hidden="true" />}</Button>}
        onConfirm={() => onToggleLock(row)} />
      <ConfirmDialog portal="admin" title="Xóa tài khoản?" description={`Tài khoản ${row.fullName} (${row.email}) sẽ bị xóa khỏi hệ thống và không đăng nhập được nữa.`} confirmLabel="Xóa tài khoản"
        trigger={<Button type="button" variant="ghost" size="icon-lg" className={cn(iconButton, "text-destructive")} aria-label={`Xóa ${row.fullName}`} title="Xóa"><Trash2 aria-hidden="true" /></Button>}
        onConfirm={() => onDelete(row)} />
    </span>
  );
}

const filters: DataFilter<AccountListItem>[] = [
  { id: "role", label: "Vai trò", options: (Object.keys(roleLabels) as AccountRole[]).map((value) => ({ value, label: roleLabels[value] })), matches: (row, value) => row.role === value },
  { id: "status", label: "Trạng thái", options: [{ value: "Active", label: "Hoạt động" }, { value: "Locked", label: "Đã khóa" }], matches: (row, value) => row.status === value },
];

export function AccountList() {
  const { data, loading, error, retry } = useApiData(loadAccounts, "Chưa tải được danh sách tài khoản. Kiểm tra kết nối rồi thử lại.");
  // Rows after confirmed changes; null until the first change, reset when the list reloads.
  const [edited, setEdited] = useState<AccountListItem[] | null>(null);
  const accounts = edited ?? data ?? [];
  const edit = (change: (rows: AccountListItem[]) => AccountListItem[]) => setEdited((current) => change(current ?? data ?? []));
  const patch = (row: AccountListItem, change: Partial<AccountListItem>) => edit((rows) => rows.map((item) => item.id === row.id ? { ...item, ...change } : item));
  // API first: if it throws, ConfirmDialog shows the message and the row stays as it was.
  const handlers: ActionHandlers = {
    onRole: async (row, role) => { if (role !== row.role) await changeAccountRole(row.id, role); patch(row, { role }); },
    onToggleLock: async (row) => { const unlock = row.status === "Locked"; await changeAccountStatus(row.id, unlock); patch(row, { status: unlock ? "Active" : "Locked" }); },
    onDelete: async (row) => { await deleteAccount(row.id); edit((rows) => rows.filter((item) => item.id !== row.id)); },
  };

  const columns: DataColumn<AccountListItem>[] = [
    {
      // Value includes email so search matches it; sorting still leads with the name.
      id: "name", header: "Họ tên & Email", value: (row) => `${row.fullName} ${row.email}`, sortable: true,
      cell: (row) => <span className="block min-w-48"><span className="block font-semibold">{row.fullName}</span><span className="block text-xs text-muted-foreground">{row.email}</span></span>,
    },
    { id: "phone", header: "Số điện thoại", value: (row) => row.phone, cell: (row) => row.phone ?? <span className="text-muted-foreground">—</span> },
    { id: "role", header: "Vai trò", value: (row) => roleLabels[row.role], searchable: false, cell: (row) => <StatusBadge kind="role" status={row.role} /> },
    { id: "status", header: "Trạng thái", value: (row) => row.status, searchable: false, cell: (row) => <StatusBadge kind="account" status={row.status} /> },
    { id: "lastLogin", header: "Lần đăng nhập cuối", value: (row) => row.lastLoginAt, sortable: true, searchable: false, cell: (row) => <span className={cn("whitespace-nowrap", !row.lastLoginAt && "text-muted-foreground")}>{lastLogin(row)}</span> },
    { id: "actions", header: "Thao tác", value: () => null, searchable: false, cell: (row) => <AccountActions row={row} {...handlers} /> },
  ];

  return (
    <>
      <PageHeader title="Quản trị tài khoản" description="Quản lý tài khoản và phân quyền người dùng trong toàn hệ thống Cocoon CRM." actions={
        <Link href="/admin/accounts/new" className={cn(buttonVariants(), "h-12 px-4")}><Plus aria-hidden="true" />Tạo tài khoản mới</Link>
      } />
      <DataTable data={accounts} columns={columns} getRowId={(row) => row.id} caption="Tài khoản" filters={filters} loading={loading} error={error} onRetry={() => { setEdited(null); retry(); }} cardsUntil="xl" renderCard={(row) => (
        <article className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
          <header className="flex items-start justify-between gap-3">
            <span className="min-w-0"><span className="block font-semibold">{row.fullName}</span><span className="block truncate text-xs text-muted-foreground">{row.email}</span></span>
            <StatusBadge kind="account" status={row.status} className="shrink-0 whitespace-nowrap" />
          </header>
          <span className="flex flex-wrap items-center gap-2"><StatusBadge kind="role" status={row.role} /><span className="text-sm text-muted-foreground">{row.phone ?? "Chưa có số điện thoại"}</span></span>
          <span className="text-sm text-muted-foreground">Đăng nhập cuối: {lastLogin(row)}</span>
          <div className="mt-auto border-t border-border pt-1"><AccountActions row={row} {...handlers} /></div>
        </article>
      )} emptyTitle="Không tìm thấy tài khoản" emptyDescription="Thử từ khóa khác hoặc bỏ bớt bộ lọc." />
    </>
  );
}
