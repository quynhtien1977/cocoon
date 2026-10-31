import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, Leaf, UserRound } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { NavLinks } from "@/components/shell/nav-links";
import { MobileNavigation } from "@/components/shell/mobile-navigation";
import type { NavItem } from "@/lib/navigation";

const labels = {
  manager: "Quản lý",
  staff: "Nhân viên",
};

/** Staff and manager share the operational workspace; admin has its own shell. */
export function BackofficeShell({ variant, nav, children }: { variant: keyof typeof labels; nav: NavItem[]; children: ReactNode }) {
  const home = nav[0]?.href ?? "/";
  return (
    <div data-portal={variant} className="min-h-dvh bg-muted md:flex">
      <a href="#main-content" className="skip-link">Đến nội dung chính</a>
      <aside aria-label={`Không gian ${labels[variant].toLowerCase()}`} className="sticky top-0 hidden h-dvh w-16 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex lg:w-[248px] print:hidden">
        <div className="flex h-24 shrink-0 items-center justify-center border-b border-sidebar-border px-2 lg:justify-start lg:px-6">
          <Logo href={home} tone="ink" className="hidden lg:inline-flex" />
          <Link href={home} aria-label="Cocoon CRM — Trang chủ" title="Cocoon CRM" className="flex size-12 items-center justify-center text-gold lg:hidden"><Leaf className="size-6" aria-hidden="true" /></Link>
        </div>
        <p className="hidden px-6 pt-6 font-label text-xs uppercase tracking-wider text-sidebar-muted lg:block">Không gian {labels[variant].toLowerCase()}</p>
        <nav aria-label={labels[variant]} className="min-h-0 flex-1 overflow-y-auto px-2 py-6 lg:px-4">
          <NavLinks
            items={nav} showIcons
            className="flex flex-col gap-2"
            labelClassName="sr-only lg:not-sr-only"
            linkClassName="flex min-h-12 items-center justify-center gap-3 rounded-md border-l-2 border-transparent px-2 py-3 text-sm text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground lg:justify-start lg:px-3"
            activeClassName="border-sidebar-primary bg-sidebar-accent font-bold text-sidebar-foreground"
          />
        </nav>
        <div className="border-t border-sidebar-border p-2 lg:p-4">
          <Link href="/" title="Trang giới thiệu" className="flex min-h-12 items-center justify-center gap-3 px-2 text-sm text-sidebar-muted hover:text-sidebar-foreground lg:justify-start lg:px-3">
            <ArrowUpRight className="size-5 shrink-0" aria-hidden="true" /><span className="sr-only lg:not-sr-only">Trang giới thiệu</span>
          </Link>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex h-16 items-center justify-between gap-4 border-b border-border bg-background px-4 md:px-6 print:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <MobileNavigation items={nav} title={labels[variant]} home={home} tone="ink" />
            <p className="font-label text-sm uppercase tracking-wider">Cocoon <span className="text-muted-foreground">/ {labels[variant]}</span></p>
          </div>
          <div className="flex items-center gap-3 text-sm"><span className="hidden text-muted-foreground sm:inline">{labels[variant]}</span><span className="flex size-8 items-center justify-center rounded-full bg-secondary"><UserRound className="size-4" aria-hidden="true" /></span></div>
        </header>
        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1280px] p-6 outline-none">{children}</main>
      </div>
    </div>
  );
}
