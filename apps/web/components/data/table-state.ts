export interface TableState {
  query: string;
  sort: string;
  direction: "asc" | "desc";
  page: number;
  pageSize: number;
  filters: Record<string, string>;
}

export function readTableState(params: URLSearchParams, prefix: string, sortable: string[], filters: { id: string; options: { value: string }[] }[]): TableState {
  const get = (key: string) => params.get(`${prefix}${key}`);
  const rawPage = Number(get("page") ?? 1);
  const rawSize = Number(get("size") ?? 10);
  return {
    query: get("q") ?? "",
    sort: sortable.includes(get("sort") ?? "") ? get("sort")! : "",
    direction: get("dir") === "desc" ? "desc" : "asc",
    page: Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1,
    pageSize: [10, 20, 50].includes(rawSize) ? rawSize : 10,
    filters: Object.fromEntries(filters.map((filter) => {
      const value = get(`filter.${filter.id}`) ?? "";
      return [filter.id, filter.options.some((option) => option.value === value) ? value : ""];
    })),
  };
}

export function updateTableParams(search: string, prefix: string, changes: Record<string, string>): string {
  const params = new URLSearchParams(search);
  for (const [key, value] of Object.entries(changes)) {
    if (value) params.set(`${prefix}${key}`, value);
    else params.delete(`${prefix}${key}`);
  }
  return params.toString();
}
