import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { NavLinks } from "@/components/shell/nav-links";
import { navFor, type Portal } from "@/lib/screens";

const labels: Record<Exclude<Portal, "public" | "customer">, string> = {
  admin: "Admin console",
  manager: "Quản lý",
  staff: "Nhân viên",
};

/** Ink sidebar shell for Admin, Manager and Staff (spec 4.4). Admin gets its own nav to stay separate (đề II.2). */
export function BackofficeShell({ portal, children }: { portal: keyof typeof labels; children: ReactNode }) {
  const items = navFor(portal);
  const home = items[0]?.href ?? "/";
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:h-screen md:w-62 md:shrink-0">
        <div className="flex items-center justify-between gap-4 px-5 py-4 md:block md:py-6">
          <Logo href={home} tagline={labels[portal]} />
        </div>
        <nav aria-label={labels[portal]} className="overflow-x-auto px-3 pb-3 md:pb-0">
          <NavLinks
            items={items}
            className="flex gap-1 md:flex-col"
            linkClassName="block whitespace-nowrap rounded-md border-l-2 border-transparent px-3 py-2 text-sm text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
            activeClassName="border-sidebar-primary bg-sidebar-accent text-sidebar-foreground"
          />
        </nav>
      </aside>
      <main className="w-full max-w-[1280px] flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
