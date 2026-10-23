import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { MobileNavigation } from "@/components/shell/mobile-navigation";
import { NavLinks } from "@/components/shell/nav-links";
import { navFor } from "@/lib/screens";

const items = navFor("admin");

/** Separate console structure and theme; never inherits the operational sidebar. */
export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div data-portal="admin" className="flex min-h-dvh flex-col bg-background text-foreground">
      <a href="#main-content" className="skip-link">Đến nội dung chính</a>
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-4 bg-primary px-4 text-primary-foreground md:px-6">
        <div className="flex items-center gap-3">
          <MobileNavigation items={items} title="Admin console" home="/admin" tone="admin" />
          <Link href="/admin" className="flex items-center gap-3" aria-label="Cocoon Admin console — Tài khoản">
            <ShieldCheck className="size-6" aria-hidden="true" />
            <span className="flex flex-col"><span className="text-sm font-bold tracking-wider">COCOON</span><span className="font-label text-xs tracking-widest">ADMIN CONSOLE</span></span>
          </Link>
        </div>
        <span className="hidden border border-white/25 px-3 py-1 text-xs sm:inline">Quản trị viên</span>
      </header>
      <div className="flex flex-1">
        <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-16 shrink-0 flex-col border-r border-border bg-card md:flex lg:w-[248px]">
          <p className="hidden px-6 pt-8 font-label text-xs uppercase tracking-wider text-muted-foreground lg:block">Quản trị hệ thống</p>
          <nav aria-label="Quản trị hệ thống" className="min-h-0 flex-1 overflow-y-auto px-2 py-6 lg:px-4">
            <NavLinks items={items} showIcons className="flex flex-col gap-2" labelClassName="sr-only lg:not-sr-only"
              linkClassName="flex min-h-12 items-center justify-center gap-3 rounded-md border-l-2 border-transparent px-2 py-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground lg:justify-start lg:px-3"
              activeClassName="border-primary bg-secondary font-bold text-primary" />
          </nav>
          <Link href="/" title="Trang giới thiệu" className="flex min-h-16 items-center justify-center gap-3 border-t border-border p-4 text-sm text-muted-foreground hover:text-foreground lg:justify-start lg:px-6">
            <ArrowUpRight className="size-5 shrink-0" aria-hidden="true" /><span className="sr-only lg:not-sr-only">Trang giới thiệu</span>
          </Link>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="border-b border-border bg-card px-6 py-4 text-sm text-muted-foreground">Cocoon CRM <span aria-hidden="true" className="px-2">/</span> Quản trị hệ thống</div>
          <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1280px] flex-1 p-6 outline-none">{children}</main>
          <footer className="px-6 py-4 text-xs text-muted-foreground">Cocoon CRM · Không gian quản trị</footer>
        </div>
      </div>
    </div>
  );
}
