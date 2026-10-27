"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, Menu, Search, UserRound } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import styles from "./landing.module.css";
import { CartDrawer } from "@/features/customer/cart-drawer";
import { CustomerNotifications } from "@/features/customer/customer-notifications";

export function LandingFrame({ customer = false, children, onSearch, searchValue, pendingSurveyCount }: {
  customer?: boolean;
  children: ReactNode;
  onSearch?: (query: string) => void;
  searchValue?: string;
  pendingSurveyCount?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setQuery] = useState("");
  const query = searchValue ?? searchQuery;
  const home = customer ? "/account" : "/";
  const anchor = (id: string) => customer && pathname !== home ? `${home}#${id}` : `#${id}`;
  const left = [
    { href: customer ? "/account/products" : "#san-pham", label: "Sản phẩm" },
    { href: anchor("cau-chuyen"), label: "Cocoon" },
    { href: anchor("nguyen-lieu"), label: "Nguyên liệu" },
    ...(customer ? [{ href: "/account/surveys", label: "Khảo sát" }, { href: "/account/orders", label: "Đơn hàng" }] : []),
  ];
  const right = [{ href: anchor("bai-viet"), label: "Bài viết" }, { href: customer ? "/account/cart" : "#ket-noi", label: customer ? "Giỏ hàng" : "Kết nối" }];
  const returnToTop = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || (customer && pathname !== home)) return;
    event.preventDefault();
    document.getElementById("dau-trang")?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  };
  const navLink = (link: { href: string; label: string }) => link.href === "/account/cart" ? <button key={link.href} type="button" aria-haspopup="dialog" onClick={() => { setMenuOpen(false); setCartOpen(true); }}>Giỏ hàng</button> : <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)} aria-current={pathname === link.href ? "page" : undefined}>
    {link.label}{link.href === "/account/surveys" && pendingSurveyCount !== undefined && pendingSurveyCount > 0 && <span className={styles.navBadge}>{Math.floor(pendingSurveyCount)}</span>}
  </Link>;

  return <div id="dau-trang" tabIndex={-1} className={styles.landing} data-portal={customer ? "customer" : "public"}>
    <a href="#main-content" className="skip-link">Đến nội dung chính</a>
    <div className={styles.announcement}>MỸ PHẨM 100% THUẦN CHAY · TỰ HÀO TỪ THỰC VẬT VIỆT NAM</div>
    <header className={`${styles.header} ${customer ? styles.customerHeader : ""}`}>
      <nav aria-label="Điều hướng chính" className={styles.desktopNav}>{left.map(navLink)}</nav>
      <div className={styles.mobileMenu}><Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetTrigger className={styles.iconButton} aria-label="Mở menu"><Menu size={22} /></SheetTrigger>
        <SheetContent side="left" className="overflow-y-auto p-6"><SheetHeader><SheetTitle>Khám phá Cocoon</SheetTitle></SheetHeader>
          <nav aria-label="Điều hướng mobile" className="flex flex-col gap-6 py-6">
            {customer && <Link href={home} onClick={() => setMenuOpen(false)}>Trang chủ</Link>}
            {[...left, ...right].map(navLink)}
            {customer ? <Link href="/account/profile" onClick={() => setMenuOpen(false)}>Hồ sơ của bạn</Link> : <><Link href="/login" scroll={false} onClick={() => setMenuOpen(false)}>Đăng nhập</Link><Link href="/register" scroll={false} onClick={() => setMenuOpen(false)}>Đăng ký</Link></>}
          </nav>
        </SheetContent>
      </Sheet></div>
      <Link href={customer ? home : "#dau-trang"} onClick={returnToTop} className={styles.logo} aria-label={customer ? "Cocoon — Trang chủ khách hàng" : "Cocoon — Về đầu trang"}><Image src="/images/landing/logo.svg" alt="Cocoon Original Vietnam" width={164} height={68} priority /></Link>
      <div className={styles.headerRight}>
        <nav aria-label="Khám phá" className={styles.desktopNav}>{right.map(navLink)}</nav>
        <button type="button" className={styles.iconButton} aria-label={searchOpen ? "Đóng tìm kiếm" : "Tìm sản phẩm"} aria-expanded={searchOpen} onClick={() => setSearchOpen(!searchOpen)}><Search size={20} /></button>
        {customer && <CustomerNotifications />}
        <Link href={customer ? "/account/profile" : "/login"} scroll={customer} className={styles.iconButton} aria-label={customer ? "Hồ sơ khách hàng" : "Đăng nhập tài khoản"}><UserRound size={20} /></Link>
      </div>
    </header>
    {searchOpen && <form className={styles.searchPanel} onSubmit={(event) => {
      event.preventDefault();
      if (customer) { router.push(`/account/products${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`); setSearchOpen(false); }
      else { onSearch?.(query); document.getElementById("san-pham")?.scrollIntoView({ behavior: "smooth" }); }
    }}>
      <label htmlFor="landing-search">Bạn đang tìm sản phẩm nào?</label><div><input autoFocus id="landing-search" type="search" value={query} onChange={(event) => { setQuery(event.target.value); if (!customer) onSearch?.(event.target.value); }} placeholder="Tên sản phẩm, ví dụ: bí đao…" /><button type="submit" aria-label="Xem kết quả tìm kiếm"><ArrowRight /></button></div>
    </form>}
    <main id="main-content" tabIndex={-1}>{children}</main>
    {customer && <CartDrawer open={cartOpen || pathname === "/account/cart"} onContinue={() => setCartOpen(false)} onOpenChange={(open) => { setCartOpen(open); if (!open && pathname === "/account/cart") router.replace("/account", { scroll: false }); }} />}
    <footer className={styles.footer}>
      <div className={styles.footerTop}>
        <div><Link href={customer ? home : "#dau-trang"} onClick={returnToTop} aria-label="Cocoon — Trang chủ"><Image src="/images/landing/logo.svg" alt="Cocoon Original Vietnam" width={184} height={70} /></Link><p>Mỹ phẩm thuần chay<br />cho nét đẹp thuần Việt.</p></div>
        <div><h3>KHÁM PHÁ</h3>{[...left.slice(0, 3), right[0]].map(navLink)}</div>
        <div><h3>ĐỒNG HÀNH CÙNG BẠN</h3>{customer ? <><Link href="/account/profile">Hồ sơ của bạn</Link><Link href="/account/orders">Đơn hàng của bạn</Link></> : <><Link href="/login" scroll={false}>Đăng nhập</Link><Link href="/register" scroll={false}>Tạo tài khoản</Link></>}<Link href="/account/feedback">Chia sẻ trải nghiệm</Link><Link href="/account/surveys">Khảo sát dành cho bạn</Link></div>
        <div><h3>KẾT NỐI</h3><a href="https://www.facebook.com/CocoonVietnamOfficial" target="_blank" rel="noreferrer">Facebook ↗</a><a href="https://www.instagram.com/cocoon.vietnam/" target="_blank" rel="noreferrer">Instagram ↗</a><a href="https://cocoonvietnam.com/" target="_blank" rel="noreferrer">Website thương hiệu ↗</a></div>
      </div>
      <div className={styles.footerBottom}><Link href={customer ? home : "#dau-trang"} onClick={returnToTop}>Cocoon CRM · Chăm sóc và kết nối</Link><span>Hình ảnh thương hiệu: Cocoon Vietnam</span><a href="#dau-trang" onClick={(event) => { event.preventDefault(); document.getElementById("dau-trang")?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }); }}>VỀ ĐẦU TRANG ↑</a></div>
    </footer>
  </div>;
}
