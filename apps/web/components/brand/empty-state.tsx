import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
  return (
    <section className={cn("flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center", className)}>
      {icon && <div aria-hidden="true" className="mb-1 text-muted-foreground [&_svg]:size-8">{icon}</div>}
      <h2 className="font-heading text-xl text-card-foreground">{title}</h2>
      <p className="max-w-prose text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div>}
    </section>
  );
}
