"use client";

import { useId, type ReactNode } from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Same fields as the API's SegmentFilter (spec 6.3); an empty list or null means "no limit". */
export interface SegmentFilterValue {
  ageMin: number | null;
  ageMax: number | null;
  genders: string[];
  preferenceIds: number[];
  purchasedCategoryIds: number[];
  lastPurchaseWithinDays: number | null;
  excludeLowRatedCategoryIds: number[];
}

export interface SegmentOption { id: number; name: string }

export const emptySegmentFilter = (): SegmentFilterValue => ({ ageMin: null, ageMax: null, genders: [], preferenceIds: [], purchasedCategoryIds: [], lastPurchaseWithinDays: null, excludeLowRatedCategoryIds: [] });

export const segmentAgeError = ({ ageMin, ageMax }: SegmentFilterValue) => ageMin !== null && ageMax !== null && ageMin > ageMax ? "Tuổi từ phải nhỏ hơn hoặc bằng tuổi đến." : null;

const genders = ["Nữ", "Nam", "Khác"];
const recency = [30, 60, 90, 180];
const fieldClass = "min-h-12 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring aria-invalid:border-destructive";
const legendClass = "font-label text-sm uppercase tracking-wider text-muted-foreground";

const toggled = <T,>(list: readonly T[], item: T) => list.includes(item) ? list.filter((value) => value !== item) : [...list, item];
const toAge = (text: string) => text === "" ? null : Number(text);

function Chip({ selected, onToggle, children }: { selected: boolean; onToggle: () => void; children: ReactNode }) {
  return <button type="button" aria-pressed={selected} onClick={onToggle} className={cn("min-h-12 rounded-md border px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring", selected ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-muted")}>{children}</button>;
}

function ChipGroup({ legend, hint, className, children }: { legend: string; hint?: string; className?: string; children: ReactNode }) {
  return (
    <fieldset className={cn("min-w-0 space-y-2", className)}>
      <legend className={legendClass}>{legend}</legend>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

export interface SegmentFilterBuilderProps {
  value: SegmentFilterValue;
  onChange: (next: SegmentFilterValue) => void;
  preferences: readonly SegmentOption[];
  categories: readonly SegmentOption[];
  /** Customers matching the current filter, from POST segments/preview. */
  matchCount: number;
}

/** Shared by M9 and M14: the caller owns the value and the customer count. */
export function SegmentFilterBuilder({ value, onChange, preferences, categories, matchCount }: SegmentFilterBuilderProps) {
  const id = useId();
  const update = (patch: Partial<SegmentFilterValue>) => onChange({ ...value, ...patch });
  const ageError = segmentAgeError(value);

  return (
    <section aria-labelledby={`${id}-title`} className="rounded-lg border border-border bg-card p-4 sm:p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <h2 id={`${id}-title`} className="flex items-center gap-2 font-heading text-xl"><SlidersHorizontal className="size-5 text-gold-strong" aria-hidden="true" />Bộ lọc phân khúc</h2>
        <Button type="button" variant="ghost" className="min-h-12 px-3 font-label uppercase tracking-wider text-muted-foreground" onClick={() => onChange(emptySegmentFilter())}><RotateCcw aria-hidden="true" />Đặt lại tiêu chí</Button>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <fieldset className="min-w-0 space-y-2">
          <legend className={legendClass}>Độ tuổi</legend>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor={`${id}-ageMin`} className="text-xs text-muted-foreground">Từ</label>
              <input id={`${id}-ageMin`} type="number" inputMode="numeric" min={0} max={120} value={value.ageMin ?? ""} onChange={(event) => update({ ageMin: toAge(event.target.value) })} aria-invalid={!!ageError} aria-describedby={ageError ? `${id}-age-error` : undefined} className={fieldClass} />
            </div>
            <div className="space-y-1">
              <label htmlFor={`${id}-ageMax`} className="text-xs text-muted-foreground">Đến</label>
              <input id={`${id}-ageMax`} type="number" inputMode="numeric" min={0} max={120} value={value.ageMax ?? ""} onChange={(event) => update({ ageMax: toAge(event.target.value) })} aria-invalid={!!ageError} aria-describedby={ageError ? `${id}-age-error` : undefined} className={fieldClass} />
            </div>
          </div>
          {ageError && <p id={`${id}-age-error`} className="text-sm text-destructive">{ageError}</p>}
        </fieldset>

        <ChipGroup legend="Giới tính" hint="Không chọn nghĩa là mọi giới tính.">
          {genders.map((gender) => <Chip key={gender} selected={value.genders.includes(gender)} onToggle={() => update({ genders: toggled(value.genders, gender) })}>{gender}</Chip>)}
        </ChipGroup>

        <ChipGroup legend="Sở thích" hint="Khách có ít nhất một sở thích được chọn." className="md:col-span-2">
          {preferences.map((item) => <Chip key={item.id} selected={value.preferenceIds.includes(item.id)} onToggle={() => update({ preferenceIds: toggled(value.preferenceIds, item.id) })}>{item.name}</Chip>)}
        </ChipGroup>

        <ChipGroup legend="Danh mục từng mua">
          {categories.map((item) => <Chip key={item.id} selected={value.purchasedCategoryIds.includes(item.id)} onToggle={() => update({ purchasedCategoryIds: toggled(value.purchasedCategoryIds, item.id) })}>{item.name}</Chip>)}
        </ChipGroup>

        <div className="min-w-0 space-y-2">
          <label htmlFor={`${id}-recency`} className={legendClass}>Mua gần đây</label>
          <select id={`${id}-recency`} value={value.lastPurchaseWithinDays ?? ""} onChange={(event) => update({ lastPurchaseWithinDays: event.target.value ? Number(event.target.value) : null })} className={fieldClass}>
            <option value="">Không giới hạn</option>
            {recency.map((days) => <option key={days} value={days}>Trong vòng {days} ngày</option>)}
          </select>
        </div>

        <ChipGroup legend="Loại trừ khách đã đánh giá thấp" hint="Bỏ khách từng chấm ≤ 2 sao cho danh mục được chọn." className="md:col-span-2">
          {categories.map((item) => <Chip key={item.id} selected={value.excludeLowRatedCategoryIds.includes(item.id)} onToggle={() => update({ excludeLowRatedCategoryIds: toggled(value.excludeLowRatedCategoryIds, item.id) })}>{item.name}</Chip>)}
        </ChipGroup>
      </div>

      <p aria-live="polite" className="mt-6 rounded-md bg-status-sage-bg p-4 text-status-sage-fg">Tìm thấy <strong className="font-heading text-2xl font-semibold tabular-nums">{matchCount}</strong> khách hàng phù hợp.</p>
    </section>
  );
}
