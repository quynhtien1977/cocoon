import { cn } from "@/lib/utils";

export interface ReasonChipProps {
  children: string;
  className?: string;
}

/** ProductCard enforces the two-chip limit at the reason slot boundary. */
export function ReasonChip({ children, className }: ReasonChipProps) {
  return (
    <span className={cn("inline-flex max-w-full items-center rounded-sm bg-status-beige-bg px-2 py-1 font-label text-sm leading-snug break-words text-status-beige-fg", className)}>
      {children}
    </span>
  );
}
