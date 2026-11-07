import { apiRequest } from "./client";

export interface PagedResult<T> { items: T[]; totalCount: number; page: number; pageSize: number }

// DataTable filters and sorts in the browser, so it needs every row; the API caps a page at 100.
const PAGE_SIZE = 100;

export async function loadAllPages<T>(path: string, signal?: AbortSignal): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 1; ; page++) {
    const result = await apiRequest<PagedResult<T>>(`${path}?page=${page}&pageSize=${PAGE_SIZE}`, { signal });
    rows.push(...result.items);
    if (result.items.length === 0 || rows.length >= result.totalCount) return rows;
  }
}
