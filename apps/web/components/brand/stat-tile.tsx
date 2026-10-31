import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatTileProps {
  label: string;
  value: number | string;
  /** Muted qualifier after the value, e.g. "/5" or "đơn". */
  unit?: string;
  change?: {
    value: number;
    suffix?: string;
    label?: string;
    /** Sentiment is independent of direction: fewer complaints can be positive. */
    tone?: "positive" | "negative" | "neutral";
  };
  /** One line of context under the value; use instead of change when nothing moved. */
  hint?: ReactNode;
  icon?: ReactNode;
  /** 0–1 share drawn as a thin bar, e.g. active / total. Decorative; state the share in hint. */
  progress?: number;
  className?: string;
}

export function StatTile({ label, value, unit, change, hint, icon, progress, className }: StatTileProps) {
  const Icon = change && change.value > 0 ? ArrowUp : change && change.value < 0 ? ArrowDown : Minus;
  const tone = change?.tone ?? "neutral";
  return (
    <div className={cn("min-w-0 rounded-lg border border-border bg-card p-4 text-card-foreground sm:p-6", className)}>
      <dl>
        <dt className="flex items-start justify-between gap-2 font-label text-sm uppercase tracking-wider text-muted-foreground">
          {label}{icon && <span aria-hidden="true" className="shrink-0 text-gold-strong [&_svg]:size-4">{icon}</span>}
        </dt>
        <dd className="mt-2 break-words text-2xl font-bold tabular-nums sm:text-3xl">
          {typeof value === "number" ? new Intl.NumberFormat("vi-VN").format(value) : value}
          {unit && <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>}
        </dd>
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
      {progress !== undefined && (
        <div aria-hidden="true" className="mt-3 h-0.5 bg-muted">
          <div className="h-full bg-gold" style={{ width: `${Math.round(Math.min(Math.max(progress, 0), 1) * 100)}%` }} />
        </div>
      )}
      {hint && <p className="mt-2 text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}
