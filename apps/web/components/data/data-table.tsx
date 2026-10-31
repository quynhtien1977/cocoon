"use client";

import { Suspense, useEffect, useId, useRef, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/brand/empty-state";
import { ColorSelect, type ColorSelectOption } from "@/components/brand/color-select";
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
  options: ColorSelectOption[];
  colored?: boolean;
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
  /** Card for one row below cardsUntil; the table is kept from there up. Both stay in the DOM, CSS hides one per breakpoint. */
  renderCard?: (row: T) => ReactNode;
  /** Width where the table replaces the cards; wider for tables that need more than a tablet's width beside the sidebar. */
  cardsUntil?: "md" | "lg" | "xl" | "wide";
}

// Literal class names so Tailwind can see them.
const cardBreakpoints = {
  md: { cards: "md:hidden", table: "hidden md:block" },
  lg: { cards: "lg:hidden", table: "hidden lg:block" },
  xl: { cards: "xl:hidden", table: "hidden xl:block" },
  wide: { cards: "min-[1400px]:hidden", table: "hidden min-[1400px]:block" },
};

function LoadingTable() {
  return <div role="status" className="space-y-3 p-6"><span className="sr-only">Đang tải bảng dữ liệu</span>{[0, 1, 2, 3].map((row) => <Skeleton key={row} className="h-12 w-full" />)}</div>;
}

const inputClass = "min-h-12 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50";
const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLocaleLowerCase("vi");
const collator = new Intl.Collator("vi", { numeric: true, sensitivity: "base" });

// Keep the browser in charge of text/caret while an IME composes a character.
// Router updates can be deferred, so they must not control each keystroke.
function SearchField({ id, query, onQuery }: { id: string; query: string; onQuery: (value: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const composing = useRef(false);
  const lastSent = useRef<string | null>(null);
  useEffect(() => {
    if (composing.current) return;
    if (lastSent.current !== null && query !== lastSent.current) return;
    lastSent.current = null;
    if (input.current && input.current.value !== query) input.current.value = query;
  }, [query]);
  useEffect(() => {
    const reset = () => { lastSent.current = null; composing.current = false; };
    window.addEventListener("popstate", reset);
    return () => window.removeEventListener("popstate", reset);
  }, []);
  function commit(value: string) { lastSent.current = value === query ? null : value; onQuery(value); }
  return <input ref={input} id={id} type="search" className={inputClass} defaultValue={query}
    onCompositionStart={() => { composing.current = true; }}
    onCompositionEnd={event => { composing.current = false; commit(event.currentTarget.value); }}
    onChange={event => { if (!composing.current) commit(event.currentTarget.value); }}
    placeholder="Nhập từ khóa…" />;
}

function TableContent<T>({ data, columns, getRowId, caption, filters = [], paramPrefix = "", loading = false, error, onRetry, emptyTitle = "Không có dữ liệu", emptyDescription = "Thử thay đổi từ khóa hoặc bộ lọc.", renderCard, cardsUntil = "md" }: DataTableProps<T>) {
  const breakpoint = cardBreakpoints[cardsUntil];
  const searchParams = useSearchParams();
  const id = useId();
  const state = readTableState(new URLSearchParams(searchParams.toString()), paramPrefix, columns.filter((column) => column.sortable).map((column) => column.id), filters);
  const query = normalize(state.query.trim());
  const matching = data.filter((row) => (!query || columns.some((column) => column.searchable !== false && normalize(String(column.value(row) ?? "")).includes(query))) && filters.every((filter) => !state.filters[filter.id] || filter.matches(row, state.filters[filter.id])));
  const sortable = columns.filter((column) => column.sortable);
  const sortColumn = sortable.find((column) => column.id === state.sort);
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
        <label htmlFor={`${id}-search`} className="grid min-w-0 basis-full gap-2 text-sm font-semibold sm:basis-64 sm:flex-1">Tìm kiếm
          <SearchField id={`${id}-search`} query={state.query} onQuery={value => update({ q: value, page: "1" }, true)} />
        </label>
        {filters.map((filter) => <label key={filter.id} className="grid min-w-36 flex-1 gap-2 text-sm font-semibold sm:flex-none" htmlFor={`${id}-${filter.id}`}>{filter.label}
          {filter.colored ? <ColorSelect id={`${id}-${filter.id}`} label={filter.label} value={state.filters[filter.id]} options={[{ value: "", label: "Tất cả" }, ...filter.options]} onValueChange={value => update({ [`filter.${filter.id}`]: value, page: "1" })} /> : <select id={`${id}-${filter.id}`} className={inputClass} value={state.filters[filter.id]} onChange={(event) => update({ [`filter.${filter.id}`]: event.target.value, page: "1" })}>
            <option value="">Tất cả</option>{filter.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>}
        </label>)}
        {renderCard && sortable.length > 0 && <label htmlFor={`${id}-sort`} className={`grid min-w-36 flex-1 grid-cols-[minmax(0,1fr)] gap-2 text-sm font-semibold sm:flex-none ${breakpoint.cards}`}>Sắp xếp
          <select id={`${id}-sort`} className={`${inputClass} w-full`} value={state.sort ? `${state.sort}:${state.direction}` : ""} onChange={(event) => { const [sort = "", dir = ""] = event.target.value.split(":"); update({ sort, dir, page: "1" }); }}>
            <option value="">Mặc định</option>
            {sortable.flatMap((column) => [<option key={`${column.id}:asc`} value={`${column.id}:asc`}>{column.header} ↑</option>, <option key={`${column.id}:desc`} value={`${column.id}:desc`}>{column.header} ↓</option>])}
          </select>
        </label>}
        <Button variant="outline" className="min-h-12 flex-1 px-4 sm:flex-none" disabled={!state.query && !Object.values(state.filters).some(Boolean)} onClick={() => update({ q: "", page: "1", ...Object.fromEntries(filters.map((filter) => [`filter.${filter.id}`, ""])) })}>Đặt lại bộ lọc</Button>
      </div>
      {loading ? <LoadingTable /> : error ? <div role="alert" className="rounded-lg border border-destructive p-6"><p>{error}</p>{onRetry && <Button type="button" variant="outline" className="mt-3" onClick={onRetry}>Thử lại</Button>}</div> : <>
        {renderCard && (rows.length ? <ul className={`grid gap-3 sm:grid-cols-2 ${breakpoint.cards}`}>{rows.map((row) => <li key={getRowId(row)} className="grid">{renderCard(row)}</li>)}</ul>
          : <div className={breakpoint.cards}><EmptyState title={emptyTitle} description={emptyDescription} /></div>)}
        <div className={renderCard ? breakpoint.table : undefined}><Table>
          <TableCaption className="sr-only">{caption}</TableCaption>
          <TableHeader><TableRow>{columns.map((column) => <TableHead key={column.id} scope="col" aria-sort={column.sortable ? state.sort === column.id ? state.direction === "asc" ? "ascending" : "descending" : "none" : undefined}>
            {column.sortable ? <button type="button" className="flex min-h-12 items-center gap-2 text-left focus-visible:outline-2 focus-visible:outline-ring" onClick={() => update({ sort: column.id, dir: state.sort === column.id && state.direction === "asc" ? "desc" : "asc", page: "1" })}>
              {column.header}{state.sort !== column.id ? <ArrowUpDown className="size-4" aria-hidden="true" /> : state.direction === "asc" ? <ArrowUp className="size-4" aria-hidden="true" /> : <ArrowDown className="size-4" aria-hidden="true" />}
            </button> : column.header}
          </TableHead>)}</TableRow></TableHeader>
          <TableBody>{rows.length ? rows.map((row) => <TableRow key={getRowId(row)} className="h-11">{columns.map((column) => <TableCell key={column.id}>{column.cell ? column.cell(row) : column.value(row) ?? "—"}</TableCell>)}</TableRow>) : <TableRow><TableCell colSpan={Math.max(1, columns.length)}><EmptyState title={emptyTitle} description={emptyDescription} /></TableCell></TableRow>}</TableBody>
        </Table></div>
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
