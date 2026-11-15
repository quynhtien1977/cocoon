import type { ReportRange } from "./types";

/** Inclusive calendar days in the viewer's local time, as YYYY-MM-DD. */
export interface DayRange { start: string; end: string }
export type PresetId = "all" | "today" | "yesterday" | "7d" | "30d" | "month" | "last-month" | "quarter" | "last-quarter" | "year" | "last-year";
/** range null means all time (no bounds sent to the API). */
export interface ReportFilter { preset: PresetId | "custom"; range: DayRange | null }

const pad = (value: number) => String(value).padStart(2, "0");
export const toIsoDay = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const parseIsoDay = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
export const addDays = (iso: string, days: number) => { const date = parseIsoDay(iso); date.setDate(date.getDate() + days); return toIsoDay(date); };
export const formatDay = (iso: string) => iso.split("-").reverse().join("/");
export const isIsoDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && toIsoDay(parseIsoDay(value)) === value;

const span = (start: Date, end: Date): DayRange => ({ start: toIsoDay(start), end: toIsoDay(end) });

export const reportPresets: { id: PresetId; label: string }[] = [
  { id: "all", label: "Toàn bộ thời gian" },
  { id: "today", label: "Hôm nay" },
  { id: "yesterday", label: "Hôm qua" },
  { id: "7d", label: "7 ngày qua" },
  { id: "30d", label: "30 ngày qua" },
  { id: "month", label: "Tháng này" },
  { id: "last-month", label: "Tháng trước" },
  { id: "quarter", label: "Quý này" },
  { id: "last-quarter", label: "Quý trước" },
  { id: "year", label: "Năm nay" },
  { id: "last-year", label: "Năm trước" },
];

/** Periods that are still running end today rather than on their last calendar day. */
export function presetRange(id: PresetId, now = new Date()): DayRange | null {
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate(), q = Math.floor(m / 3) * 3;
  const today = new Date(y, m, d);
  switch (id) {
    case "today": return span(today, today);
    case "yesterday": return span(new Date(y, m, d - 1), new Date(y, m, d - 1));
    case "7d": return span(new Date(y, m, d - 6), today);
    case "30d": return span(new Date(y, m, d - 29), today);
    case "month": return span(new Date(y, m, 1), today);
    case "last-month": return span(new Date(y, m - 1, 1), new Date(y, m, 0));
    case "quarter": return span(new Date(y, q, 1), today);
    case "last-quarter": return span(new Date(y, q - 3, 1), new Date(y, q, 0));
    case "year": return span(new Date(y, 0, 1), today);
    case "last-year": return span(new Date(y - 1, 0, 1), new Date(y - 1, 11, 31));
    default: return null;
  }
}

export const presetFilter = (id: PresetId, now = new Date()): ReportFilter => ({ preset: id, range: presetRange(id, now) });

/** [from, to) instants for the API: local midnight of start to local midnight after end. */
export function toReportRange(range: DayRange | null): ReportRange {
  if (!range) return {};
  return { from: parseIsoDay(range.start).toISOString(), to: parseIsoDay(addDays(range.end, 1)).toISOString() };
}

export function filterLabel(filter: ReportFilter): string {
  if (filter.preset !== "custom") return reportPresets.find((preset) => preset.id === filter.preset)!.label;
  if (!filter.range) return reportPresets[0].label;
  const { start, end } = filter.range;
  return start === end ? formatDay(start) : `${formatDay(start)} – ${formatDay(end)}`;
}

/** Six Sunday-first weeks covering the month, as in a wall calendar. */
export function monthGrid(year: number, month: number): { iso: string; inMonth: boolean }[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    return { iso: toIsoDay(date), inMonth: date.getMonth() === month };
  });
}
