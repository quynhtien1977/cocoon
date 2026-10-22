import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatTileProps {
  label: string;
  value: number | string;
  change?: {
    value: number;
    suffix?: string;
    label?: string;
    /** Sentiment is independent of direction: fewer complaints can be positive. */
    tone?: "positive" | "negative" | "neutral";
  };
  className?: string;
}

export function StatTile({ label, value, change, className }: StatTileProps) {
  const Icon = change && change.value > 0 ? ArrowUp : change && change.value < 0 ? ArrowDown : Minus;
  const tone = change?.tone ?? "neutral";
  return (
    <div className={cn("min-w-0 rounded-lg border border-border bg-card p-6 text-card-foreground", className)}>
      <dl>
        <dt className="font-label text-sm uppercase tracking-wider text-muted-foreground">{label}</dt>
        <dd className="mt-2 break-words text-3xl font-bold tabular-nums">{typeof value === "number" ? new Intl.NumberFormat("vi-VN").format(value) : value}</dd>
      </dl>
      {change && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className={cn("inline-flex items-center gap-1 font-semibold tabular-nums", {
            "text-status-sage-fg": tone === "positive",
            "text-status-danger-fg": tone === "negative",
            "text-muted-foreground": tone === "neutral",
          })}>
            <Icon className="size-4" aria-hidden="true" />
            {change.value > 0 ? "+" : ""}{new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(change.value)}{change.suffix}
          </span>
          {change.label && <span className="text-muted-foreground">{change.label}</span>}
        </p>
      )}
    </div>
  );
}
