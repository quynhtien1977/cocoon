import Link from "next/link";
import { cn } from "@/lib/utils";

/** Text wordmark only; the cocoonvietnam.com raster logo is not reused (spec 3). */
export function Logo({ href = "/", tagline = "CRM", tone = "cream", className }: { href?: string; tagline?: string; tone?: "cream" | "ink"; className?: string }) {
  return (
    <Link href={href} aria-label={`Cocoon ${tagline} — Trang chủ`} className={cn("inline-flex flex-col items-center leading-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring", tone === "ink" ? "text-sidebar-foreground" : "text-foreground", className)}>
      <span className="font-heading text-3xl tracking-tight">cocoon</span>
      {tagline && <span className={cn("mt-1 font-label text-[10px] tracking-[0.3em] uppercase", tone === "ink" ? "text-gold" : "text-gold-strong")}>{tagline}</span>}
    </Link>
  );
}
