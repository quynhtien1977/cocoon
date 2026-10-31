import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, actions }: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="font-label text-[13px] tracking-wider text-gold-strong uppercase">{eyebrow}</p>
        )}
        <h1 className="mt-1 font-heading text-[28px] leading-tight text-balance">{title}</h1>
        {description && <p className="mt-1 max-w-prose text-muted-foreground text-pretty">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
