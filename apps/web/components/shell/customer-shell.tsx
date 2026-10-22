import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { BrandFooter } from "@/components/shell/brand-footer";
import { MobileNavigation } from "@/components/shell/mobile-navigation";
import { NavLinks } from "@/components/shell/nav-links";
import { navFor } from "@/lib/screens";

const navLink = "inline-flex min-h-12 items-center gap-2 whitespace-nowrap border-b-2 border-transparent text-sm font-bold hover:text-gold-strong";
const navActive = "border-gold-strong text-gold-strong";

/** Cocoon-style top navigation: ink announcement bar, centered wordmark, square corners. */
export function CustomerShell({ children, pendingSurveyCount }: { children: ReactNode; pendingSurveyCount?: number }) {
  // Omit the badge until a real count is supplied; the shell never invents customer data.
  const items = navFor("customer").map((item) => ({
    ...item,
    badge: item.code === "C6" && pendingSurveyCount !== undefined ? Math.max(0, Math.floor(pendingSurveyCount)) : undefined,
  }));
  return (
    <div data-portal="customer" className="flex min-h-dvh flex-col">
      <a href="#main-content" className="skip-link">Đến nội dung chính</a>
      <p className="bg-primary px-4 py-2 text-center text-xs text-primary-foreground">
        Cocoon CRM · Đánh giá sản phẩm và làm khảo sát để nhận gợi ý hợp với bạn
      </p>
      <header className="sticky top-0 z-30 border-b border-border bg-background">
        <div className="mx-auto grid h-16 max-w-[1080px] grid-cols-[1fr_auto_1fr] items-center gap-4 px-4">
          <div className="lg:hidden"><MobileNavigation items={items} title="Tài khoản của bạn" home="/account" desktopAt="lg" /></div>
          <nav aria-label="Mua sắm của bạn" className="hidden lg:block">
            <NavLinks items={items.slice(0, 3)} className="flex items-center gap-6" linkClassName={navLink} activeClassName={navActive} />
          </nav>
          <Logo href="/account" className="justify-self-center" />
          <div className="flex items-center justify-self-end gap-6">
            <nav aria-label="Hoạt động" className="hidden lg:block">
              <NavLinks items={items.slice(3, 5)} className="flex items-center gap-6" linkClassName={navLink} activeClassName={navActive} />
            </nav>
            <nav aria-label="Hồ sơ cá nhân">
              <NavLinks items={items.slice(5)} showIcons labelClassName="sr-only"
                linkClassName="flex size-12 items-center justify-center rounded-full border border-border bg-secondary/50 hover:bg-secondary"
                activeClassName="border-gold-strong bg-secondary text-gold-strong" />
            </nav>
          </div>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1080px] flex-1 px-4 py-8 text-base outline-none">{children}</main>
      <BrandFooter />
    </div>
  );
}
