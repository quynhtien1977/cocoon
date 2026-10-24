"use client";

import type { ReactNode } from "react";
import { useSelectedLayoutSegment } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { BrandFooter } from "@/components/shell/brand-footer";
import { NavLinks } from "@/components/shell/nav-links";
import { MobileNavigation } from "@/components/shell/mobile-navigation";
import { screen } from "@/lib/screens";

const items = [screen("U1"), screen("U2"), screen("U3")].map((item) => ({ ...item, exact: true }));

export function PublicShell({ children }: { children: ReactNode }) {
  const segment = useSelectedLayoutSegment();
  // Intercepted login changes the URL while the underlying page keeps its shell.
  if (segment === null || segment === "login" || segment === "admin") return <>{children}</>;
  return (
    <div data-portal="public" className="flex min-h-dvh flex-col">
      <a href="#main-content" className="skip-link">Đến nội dung chính</a>
      <p className="bg-primary px-4 py-2 text-center font-label text-xs uppercase tracking-wider text-primary-foreground">Cocoon · Mỹ phẩm thuần chay từ Việt Nam</p>
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-[1080px] items-center justify-between gap-4 px-4">
          <Logo tagline="Vietnam" />
          <nav aria-label="Điều hướng chính" className="hidden md:block">
            <NavLinks items={items} className="flex items-center gap-8" linkClassName="inline-flex min-h-12 items-center border-b-2 border-transparent text-sm font-bold hover:text-gold-strong" activeClassName="border-gold-strong text-gold-strong" />
          </nav>
          <MobileNavigation items={items} home="/" title="Cocoon Vietnam" />
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1080px] flex-1 px-4 py-8 outline-none">{children}</main>
      <BrandFooter />
    </div>
  );
}
