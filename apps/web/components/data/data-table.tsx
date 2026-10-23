"use client";

import { Suspense, useEffect, useId, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/brand/empty-state";
import { readTableState, updateTableParams } from "./table-state";

export interface DataColumn<T> {
  id: string;
  header: string;
  value: (row: T) => string | number | null | undefined;
  cell?: (row: T) => ReactNode;
  sortable?: boolean;
  searchable?: boolean;
}

export interface DataFilter<T> {
  id: string;
  label: string;
  options: { value: string; label: string }[];
  matches: (row: T, value: string) => boolean;
}

export interface DataTableProps<T> {
  data: readonly T[];
  columns: DataColumn<T>[];
  getRowId: (row: T) => string | number;
  caption: string;
  filters?: DataFilter<T>[];
  /** Unique prefix when multiple tables share a page, e.g. "customers.". */
  paramPrefix?: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
}

function LoadingTable() {
  return <div role="status" className="space-y-3 p-6"><span className="sr-only">Đang tải bảng dữ liệu</span>{[0, 1, 2, 3].map((row) => <Skeleton key={row} className="h-12 w-full" />)}</div>;
}

const inputClass = "min-h-12 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50";
const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLocaleLowerCase("vi");
const collator = new Intl.Collator("vi", { numeric: true, sensitivity: "base" });

function TableContent<T>({ data, columns, getRowId, caption, filters = [], paramPrefix = "", loading = false, error, onRetry, emptyTitle = "Không có dữ liệu", emptyDescription = "Thử thay đổi từ khóa hoặc bộ lọc." }: DataTableProps<T>) {
  const searchParams = useSearchParams();
  const id = useId();
  const state = readTableState(new URLSearchParams(searchParams.toString()), paramPrefix, columns.filter((column) => column.sortable).map((column) => column.id), filters);
  const query = normalize(state.query.trim());
  const matching = data.filter((row) => (!query || columns.some((column) => column.searchable !== false && normalize(String(column.value(row) ?? "")).includes(query))) && filters.every((filter) => !state.filters[filter.id] || filter.matches(row, state.filters[filter.id])));
  const sortColumn = columns.find((column) => column.id === state.sort);
  if (sortColumn) matching.sort((a, b) => {
    const left = sortColumn.value(a), right = sortColumn.value(b);
    if (left == null) return right == null ? 0 : 1;
    if (right == null) return -1;
    const order = typeof left === "number" && typeof right === "number" ? left - right : collator.compare(String(left), String(right));
    return state.direction === "desc" ? -order : order;
  });
  const pages = Math.max(1, Math.ceil(matching.length / state.pageSize));
  const page = Math.min(state.page, pages);
  const rows = matching.slice((page - 1) * state.pageSize, page * state.pageSize);

  // Next integrates native history with useSearchParams; Back/Forward restores the table.
  function update(changes: Record<string, string>, replace = false) {
    const search = updateTableParams(window.location.search, paramPrefix, changes);
    const url = `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`;
    if (replace) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
  }

  useEffect(() => {
    if (!loading && !error && state.page > pages) {
      const search = updateTableParams(window.location.search, paramPrefix, { page: String(pages) });
      window.history.replaceState(null, "", `${window.location.pathname}?${search}${window.location.hash}`);
    }
  }, [state.page, pages, loading, error, paramPrefix]);

  return (
    <section aria-label={caption} className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label htmlFor={`${id}-search`} className="grid min-w-0 flex-1 gap-2 text-sm font-semibold">Tìm kiếm
          <input id={`${id}-search`} type="search" className={inputClass} value={state.query} onChange={(event) => update({ q: event.target.value, page: "1" }, true)} placeholder="Nhập từ khóa…" />
        </label>
        {filters.map((filter) => <label key={filter.id} className="grid gap-2 text-sm font-semibold" htmlFor={`${id}-${filter.id}`}>{filter.label}
          <select id={`${id}-${filter.id}`} className={inputClass} value={state.filters[filter.id]} onChange={(event) => update({ [`filter.${filter.id}`]: event.target.value, page: "1" })}>
            <option value="">Tất cả</option>{filter.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>)}
        <Button variant="outline" className="min-h-12 px-4" disabled={!state.query && !Object.values(state.filters).some(Boolean)} onClick={() => update({ q: "", page: "1", ...Object.fromEntries(filters.map((filter) => [`filter.${filter.id}`, ""])) })}>Đặt lại bộ lọc</Button>
      </div>
      {loading ? <LoadingTable /> : error ? <div role="alert" className="rounded-lg border border-destructive p-6"><p>{error}</p>{onRetry && <Button type="button" variant="outline" className="mt-3" onClick={onRetry}>Thử lại</Button>}</div> : <>
        <Table>
          <TableCaption className="sr-only">{caption}</TableCaption>
          <TableHeader><TableRow>{columns.map((column) => <TableHead key={column.id} scope="col" aria-sort={column.sortable ? state.sort === column.id ? state.direction === "asc" ? "ascending" : "descending" : "none" : undefined}>
            {column.sortable ? <button type="button" className="flex min-h-12 items-center gap-2 text-left focus-visible:outline-2 focus-visible:outline-ring" onClick={() => update({ sort: column.id, dir: state.sort === column.id && state.direction === "asc" ? "desc" : "asc", page: "1" })}>
              {column.header}{state.sort !== column.id ? <ArrowUpDown className="size-4" aria-hidden="true" /> : state.direction === "asc" ? <ArrowUp className="size-4" aria-hidden="true" /> : <ArrowDown className="size-4" aria-hidden="true" />}
            </button> : column.header}
          </TableHead>)}</TableRow></TableHeader>
          <TableBody>{rows.length ? rows.map((row) => <TableRow key={getRowId(row)} className="h-11">{columns.map((column) => <TableCell key={column.id}>{column.cell ? column.cell(row) : column.value(row) ?? "—"}</TableCell>)}</TableRow>) : <TableRow><TableCell colSpan={Math.max(1, columns.length)}><EmptyState title={emptyTitle} description={emptyDescription} /></TableCell></TableRow>}</TableBody>
        </Table>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p role="status" className="text-sm text-muted-foreground">{matching.length} kết quả · Trang {page}/{pages}</p>
          <label className="flex items-center gap-2 text-sm">Số dòng mỗi trang<select className={inputClass} value={state.pageSize} onChange={(event) => update({ size: event.target.value, page: "1" })}>{[10, 20, 50].map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
          <nav aria-label={`Phân trang ${caption}`} className="flex gap-2"><Button variant="outline" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>Trang trước</Button><Button variant="outline" disabled={page >= pages} onClick={() => update({ page: String(page + 1) })}>Trang sau</Button></nav>
        </div>
      </>}
    </section>
  );
}

export function DataTable<T>(props: DataTableProps<T>) {
  return <Suspense fallback={<LoadingTable />}><TableContent {...props} /></Suspense>;
}
