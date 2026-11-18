"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { filterLabel, formatDay, isIsoDay, monthGrid, parseIsoDay, presetFilter, reportPresets, toIsoDay, type DayRange, type ReportFilter } from "../date-range";

const weekdays = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const months = Array.from({ length: 12 }, (_, index) => `Tháng ${index + 1}`);
const rangeTint = "bg-[color-mix(in_oklch,var(--chart-1)_22%,transparent)]";
const control = "h-8 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-2 focus-visible:outline-ring";
/** Panel width at sm and up (36rem); used to decide which side of the trigger it opens toward. */
const panelWidth = 576;

interface Month { year: number; month: number }
const shift = ({ year, month }: Month, by: number): Month => { const date = new Date(year, month + by, 1); return { year: date.getFullYear(), month: date.getMonth() }; };
/** Left calendar shows the month before the range end, so the end month sits on the right. */
const leftMonthFor = (range: DayRange | null, today: string): Month => { const end = parseIsoDay(range?.end ?? today); return shift({ year: end.getFullYear(), month: end.getMonth() }, -1); };

export function DateRangePicker({ value, onChange, now }: { value: ReportFilter; onChange: (value: ReportFilter) => void; now?: Date }) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  /** True after the first click of a custom range, until the second click sets the end. */
  const [picking, setPicking] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const today = toIsoDay(now ?? new Date());
  const [left, setLeft] = useState<Month>(() => leftMonthFor(value.range, today));

  const close = (focusTrigger = true) => { setOpen(false); setPicking(false); setHover(null); if (focusTrigger) triggerRef.current?.focus(); };
  const [align, setAlign] = useState<"left" | "right">("right");
  const openPanel = () => {
    // Open toward the side with room: a trigger near the left edge (wrapped header, tablet) aligns left.
    const rect = triggerRef.current?.getBoundingClientRect();
    setAlign(rect && rect.left + panelWidth <= window.innerWidth - 16 ? "left" : "right");
    setDraft(value); setPicking(false); setLeft(leftMonthFor(value.range, today)); setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) close(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onPointer); document.removeEventListener("keydown", onKey); };
  });

  const choosePreset = (presetId: (typeof reportPresets)[number]["id"]) => {
    const next = presetFilter(presetId, now);
    setDraft(next); setPicking(false);
    if (next.range) setLeft(leftMonthFor(next.range, today));
  };
  const chooseDay = (iso: string) => {
    if (!picking || !draft.range) { setDraft({ preset: "custom", range: { start: iso, end: iso } }); setPicking(true); return; }
    const start = draft.range.start;
    setDraft({ preset: "custom", range: iso < start ? { start: iso, end: start } : { start, end: iso } });
    setPicking(false); setHover(null);
  };
  const typeBound = (bound: "start" | "end", iso: string) => {
    if (!isIsoDay(iso) || iso > today) return;
    const current = draft.range ?? { start: iso, end: iso };
    const next = { ...current, [bound]: iso };
    setDraft({ preset: "custom", range: next.start <= next.end ? next : { start: next.end, end: next.start } });
    setPicking(false);
    setLeft(leftMonthFor(next, today));
  };
  const apply = () => { onChange(draft); close(); };

  // While picking, preview the span up to the hovered day.
  const shown = picking && draft.range && hover ? (hover < draft.range.start ? { start: hover, end: draft.range.start } : { start: draft.range.start, end: hover }) : draft.range;
  const years = Array.from({ length: 8 }, (_, index) => parseIsoDay(today).getFullYear() - 6 + index);

  return (
    <div ref={rootRef} className="relative print:hidden">
      <button ref={triggerRef} type="button" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? `${id}-panel` : undefined}
        onClick={() => (open ? close() : openPanel())}
        className="inline-flex min-h-12 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring aria-expanded:border-ring">
        <CalendarDays className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Kỳ báo cáo: </span>{filterLabel(value)}
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>

      {open && (
        <div id={`${id}-panel`} role="dialog" aria-label="Chọn kỳ báo cáo"
          className={cn("fixed inset-x-4 top-20 z-50 flex max-h-[calc(100dvh-6rem)] flex-col overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg",
            "sm:absolute sm:inset-x-auto sm:top-full sm:mt-2 sm:max-h-[min(30rem,calc(100dvh-8rem))] sm:w-xl", align === "left" ? "sm:left-0" : "sm:right-0")}>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto sm:flex-row">
            <ul aria-label="Mốc có sẵn" className="flex shrink-0 gap-1 overflow-x-auto border-b border-border p-1.5 sm:w-32 sm:flex-col sm:overflow-y-auto sm:border-r sm:border-b-0">
              {reportPresets.map((preset) => (
                <li key={preset.id} className="shrink-0">
                  <button type="button" aria-pressed={draft.preset === preset.id} onClick={() => choosePreset(preset.id)}
                    className={cn("min-h-8 w-full rounded-md px-2.5 text-left text-xs whitespace-nowrap hover:bg-muted aria-pressed:font-semibold", draft.preset === preset.id && rangeTint)}>
                    {preset.label}
                  </button>
                </li>
              ))}
            </ul>

            <div className="min-w-0 flex-1 p-3">
              <div className="flex items-center gap-1.5 rounded-md bg-muted p-1.5">
                <label className="min-w-0 flex-1"><span className="sr-only">Từ ngày</span>
                  <input type="date" value={draft.range?.start ?? ""} max={today} onChange={(event) => typeBound("start", event.target.value)} className={cn(control, "w-full font-semibold")} />
                </label>
                <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
                <label className="min-w-0 flex-1"><span className="sr-only">Đến ngày</span>
                  <input type="date" value={draft.range?.end ?? ""} max={today} onChange={(event) => typeBound("end", event.target.value)} className={cn(control, "w-full font-semibold")} />
                </label>
              </div>

              <div className="mt-2 flex items-center justify-between gap-2">
                <Button type="button" variant="outline" size="icon" className="size-8" aria-label="Xem tháng trước" onClick={() => setLeft(shift(left, -1))}><ChevronLeft aria-hidden="true" /></Button>
                <div className="flex gap-1.5">
                  <label><span className="sr-only">Tháng</span>
                    <select value={left.month} onChange={(event) => setLeft({ ...left, month: Number(event.target.value) })} className={control}>
                      {months.map((label, index) => <option key={label} value={index}>{label}</option>)}
                    </select>
                  </label>
                  <label><span className="sr-only">Năm</span>
                    <select value={left.year} onChange={(event) => setLeft({ ...left, year: Number(event.target.value) })} className={control}>
                      {years.map((year) => <option key={year} value={year}>{year}</option>)}
                    </select>
                  </label>
                </div>
                <Button type="button" variant="outline" size="icon" className="size-8" aria-label="Xem tháng sau" onClick={() => setLeft(shift(left, 1))}><ChevronRight aria-hidden="true" /></Button>
              </div>

              <div className="mt-2 grid gap-x-4 gap-y-3 sm:grid-cols-2">
                {[left, shift(left, 1)].map((month) => (
                  <MonthCalendar key={`${month.year}-${month.month}`} {...month} today={today} range={shown} onPick={chooseDay} onHover={picking ? setHover : undefined} />
                ))}
              </div>
            </div>
          </div>

          <footer className="flex items-center justify-between gap-3 border-t border-border px-3 py-2">
            <p aria-live="polite" className="min-w-0 truncate text-xs text-muted-foreground">{picking ? "Chọn ngày kết thúc." : filterLabel(draft)}</p>
            <div className="flex shrink-0 gap-2">
              <Button type="button" variant="outline" className="h-9 px-3" onClick={() => close()}>Hủy</Button>
              <Button type="button" className="h-9 px-3" onClick={apply}>Áp dụng</Button>
            </div>
          </footer>
        </div>
      )}
    </div>
  );
}

function MonthCalendar({ year, month, today, range, onPick, onHover }: Month & {
  today: string; range: DayRange | null; onPick: (iso: string) => void; onHover?: (iso: string | null) => void;
}) {
  const title = `Tháng ${month + 1} - ${year}`;
  return (
    <div className="min-w-0">
      <p className="mb-1 text-xs font-semibold text-muted-foreground">{title}</p>
      <div role="group" aria-label={title} className="grid grid-cols-7 place-items-center text-xs" onMouseLeave={() => onHover?.(null)}>
        {weekdays.map((day) => <span key={day} aria-hidden="true" className="py-1 text-[11px] font-semibold text-muted-foreground">{day}</span>)}
        {monthGrid(year, month).map(({ iso, inMonth }) => {
          if (!inMonth) return <span key={iso} aria-hidden="true" className="flex size-7 items-center justify-center text-muted-foreground/40">{parseIsoDay(iso).getDate()}</span>;
          const edge = !!range && (iso === range.start || iso === range.end);
          const inside = !!range && iso > range.start && iso < range.end;
          return (
            <span key={iso} className={cn("flex w-full justify-center", inside && rangeTint)}>
              <button type="button" disabled={iso > today} aria-label={formatDay(iso)} aria-pressed={edge || inside} aria-current={iso === today ? "date" : undefined}
                onClick={() => onPick(iso)} onMouseEnter={() => onHover?.(iso)} onFocus={() => onHover?.(iso)}
                className={cn("size-7 rounded-md tabular-nums hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none disabled:text-muted-foreground/40",
                  edge && "bg-primary font-semibold text-primary-foreground hover:bg-primary/80",
                  iso === today && !edge && "font-semibold underline underline-offset-4")}>
                {parseIsoDay(iso).getDate()}
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}
