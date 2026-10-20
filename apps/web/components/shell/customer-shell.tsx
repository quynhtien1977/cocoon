import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { NavLinks } from "@/components/shell/nav-links";
import { navFor } from "@/lib/screens";

const navLink = "block whitespace-nowrap py-2 text-sm font-bold hover:text-gold-strong";
const navActive = "text-gold-strong underline underline-offset-8";

/** Cocoon-style top navigation: ink announcement bar, centered wordmark, square corners. */
export function CustomerShell({ children }: { children: ReactNode }) {
  const items = navFor("customer");
  return (
    <div data-portal="customer" className="flex min-h-screen flex-col">
      <p className="bg-primary px-4 py-2 text-center text-xs text-primary-foreground">
        Cocoon CRM · Đánh giá sản phẩm và làm khảo sát để nhận gợi ý hợp với bạn
      </p>
      <header className="border-b border-border bg-background">
        <div className="mx-auto grid max-w-[1080px] items-center gap-2 px-4 py-3 md:h-16 md:grid-cols-[1fr_auto_1fr] md:py-0">
          <nav aria-label="Tài khoản" className="order-2 overflow-x-auto md:order-1">
            <NavLinks items={items.slice(0, 3)} className="flex gap-6" linkClassName={navLink} activeClassName={navActive} />
          </nav>
          <Logo href="/account" className="order-1 justify-self-center md:order-2" />
          <nav aria-label="Hoạt động" className="order-3 overflow-x-auto md:justify-self-end">
            <NavLinks items={items.slice(3)} className="flex gap-6" linkClassName={navLink} activeClassName={navActive} />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1080px] flex-1 px-4 py-8 text-base">{children}</main>
    </div>
  );
}

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div data-portal="customer" className="flex min-h-screen flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-[1080px] items-center justify-between px-4">
          <Logo />
          <nav aria-label="Tài khoản" className="flex gap-6 text-sm font-bold">
            <Link href="/login" className="hover:text-gold-strong">Đăng nhập</Link>
            <Link href="/register" className="hover:text-gold-strong">Đăng ký</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1080px] flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
