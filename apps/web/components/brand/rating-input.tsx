"use client";

import { useId, useState } from "react";
import { Star } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

export interface RatingInputProps {
  label: string;
  name?: string;
  value?: number | null;
  defaultValue?: number | null;
  onValueChange?: (value: number) => void;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  className?: string;
}

function validRating(value: number | null | undefined) {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5 ? value : null;
}

export function RatingInput({ label, name, value, defaultValue = null, onValueChange, disabled = false, required = false, error, className }: RatingInputProps) {
  const id = useId();
  const [internalValue, setInternalValue] = useState(validRating(defaultValue));
  const [preview, setPreview] = useState<number | null>(null);
  const selected = validRating(value === undefined ? internalValue : value);
  const highlighted = preview ?? selected ?? 0;

  return (
    <div className={cn("grid gap-2", className)}>
      <p id={`${id}-label`} className="text-sm font-semibold">{label}{required && <span aria-hidden="true"> *</span>}</p>
      <RadioGroup name={name ?? id} value={selected} disabled={disabled} required={required}
        aria-labelledby={`${id}-label`} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
        className="flex w-fit flex-wrap gap-1" onPointerLeave={() => setPreview(null)}
        onValueChange={(next: number) => {
          if (disabled || validRating(next) === null) return;
          if (value === undefined) setInternalValue(next);
          setPreview(null);
          onValueChange?.(next);
        }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <RadioGroupItem key={star} value={star} aria-label={`${star} sao`} onPointerEnter={() => { if (!disabled) setPreview(star); }}
            className="size-12 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-gold-strong after:inset-0 focus-visible:ring-2 data-disabled:cursor-not-allowed data-disabled:opacity-50 data-checked:bg-transparent data-checked:text-gold-strong dark:bg-transparent dark:data-checked:bg-transparent">
            <Star aria-hidden="true" className={cn("size-8", star <= highlighted ? "fill-gold-strong" : "fill-transparent")} strokeWidth={1.5} />
          </RadioGroupItem>
        ))}
      </RadioGroup>
      {error && <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
