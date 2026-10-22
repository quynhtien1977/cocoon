import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export function BrandFooter() {
  return (
    <footer className="border-t border-border bg-muted">
      <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-6 px-4 py-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col items-start gap-3">
          <Logo />
          <p className="text-sm text-muted-foreground">Lắng nghe bạn. Chăm sóc từ những điều nhỏ nhất.</p>
        </div>
        <nav aria-label="Liên kết cuối trang" className="flex flex-wrap gap-6 text-sm">
          <Link href="/" className="underline-offset-4 hover:underline">Giới thiệu</Link>
          <a href="https://cocoonvietnam.com/" target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">Website Cocoon <span className="sr-only">(mở tab mới)</span>↗</a>
        </nav>
      </div>
    </footer>
  );
}
