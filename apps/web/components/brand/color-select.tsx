"use client";

import { Select } from "@base-ui/react/select";
import { Check } from "lucide-react";

export type ColorSelectOption = { value: string; label: string; colorClass?: string };

/** Arrow-free select with the same colored label in the trigger and menu. */
export function ColorSelect({ id, label, value, options, onValueChange, disabled, busy, badge = false, title }: {
  id?: string; label: string; value: string; options: ColorSelectOption[];
  onValueChange: (value: string) => void; disabled?: boolean; busy?: boolean; badge?: boolean; title?: string;
}) {
  const selected = options.find(option => option.value === value);
  const pill = (option?: ColorSelectOption) => <span className={`inline-block rounded-full px-3 py-1 text-xs leading-5 ${option?.colorClass ?? "bg-muted text-muted-foreground"}`}>{option?.label ?? "Tất cả"}</span>;
  return <Select.Root value={value} items={options} disabled={disabled} onValueChange={next => { if (next !== null) onValueChange(next); }}>
    <Select.Trigger id={id} aria-label={label} aria-busy={busy} title={title} className={badge ? "inline-flex min-h-11 cursor-pointer items-center rounded-full bg-transparent text-left outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed" : "flex min-h-12 w-full min-w-[130px] cursor-pointer items-center rounded-md border border-input bg-background px-2 text-left outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"}>
      {pill(selected)}
    </Select.Trigger>
    <Select.Portal><Select.Positioner sideOffset={6} align="start" alignItemWithTrigger={false} collisionPadding={12} className="z-[80] outline-none">
      <Select.Popup className="max-h-[min(320px,var(--available-height))] min-w-[180px] max-w-[calc(100vw-24px)] overflow-y-auto rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-lg outline-none transition-[opacity,transform] duration-150 data-starting-style:translate-y-1 data-starting-style:opacity-0 data-ending-style:opacity-0 motion-reduce:transition-none">
        <Select.List>{options.map(option => <Select.Item key={option.value} value={option.value} label={option.label} className="flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-md px-2 py-1.5 outline-none data-highlighted:bg-muted">
          <Select.ItemText>{pill(option)}</Select.ItemText><Select.ItemIndicator><Check size={14} className="text-gold-strong" /></Select.ItemIndicator>
        </Select.Item>)}</Select.List>
      </Select.Popup>
    </Select.Positioner></Select.Portal>
  </Select.Root>;
}
