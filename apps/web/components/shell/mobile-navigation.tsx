"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { NavLinks } from "@/components/shell/nav-links";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function MobileNavigation({ items, title, home, tone = "cream", desktopAt = "md" }: {
  items: NavItem[];
  title: string;
  home: string;
  tone?: "cream" | "ink" | "admin";
  desktopAt?: "md" | "lg";
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(`(min-width: ${desktopAt === "lg" ? 1024 : 768}px)`);
    const closeOnDesktop = () => { if (media.matches) setOpen(false); };
    media.addEventListener("change", closeOnDesktop);
    return () => media.removeEventListener("change", closeOnDesktop);
  }, [desktopAt]);

  const ink = tone === "ink";
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon" className={cn("size-12", desktopAt === "lg" ? "lg:hidden" : "md:hidden")} />} aria-label={`Mở điều hướng ${title}`}>
        <Menu className="size-5" aria-hidden="true" />
      </SheetTrigger>
      <SheetContent side="left" data-portal={tone === "admin" ? "admin" : undefined} className={cn("max-w-80", tone === "cream" && "[--radius:0rem]", ink && "border-sidebar-border bg-sidebar text-sidebar-foreground")}>
        <SheetHeader className="gap-4 border-b border-current/10 p-6">
          <SheetTitle className={cn("font-label text-sm uppercase tracking-wider", ink && "text-sidebar-foreground")}>{title}</SheetTitle>
          <SheetDescription className="sr-only">Chọn một mục để chuyển trang.</SheetDescription>
          <div onClick={() => setOpen(false)}><Logo href={home} tone={ink ? "ink" : "cream"} /></div>
        </SheetHeader>
        <nav aria-label={title} className="min-h-0 flex-1 overflow-y-auto p-4">
          <NavLinks items={items} showIcons onNavigate={() => setOpen(false)} className="flex flex-col gap-2"
            linkClassName={cn("flex min-h-12 items-center gap-3 border-l-2 border-transparent px-3 py-3 text-sm", ink ? "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground" : "hover:bg-muted")}
            activeClassName={ink ? "border-sidebar-primary bg-sidebar-accent text-sidebar-foreground" : "border-primary bg-secondary font-bold"} />
        </nav>
        <Link href="/" onClick={() => setOpen(false)} className="m-4 border-t border-current/10 p-4 text-sm underline underline-offset-4">Trang giới thiệu Cocoon</Link>
      </SheetContent>
    </Sheet>
  );
}
