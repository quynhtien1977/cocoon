import Link from "next/link";
import { cn } from "@/lib/utils";

/** Text wordmark only; the cocoonvietnam.com raster logo is not reused (spec 3). */
export function Logo({ href = "/", tagline, className }: { href?: string; tagline?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex flex-col leading-none font-label text-gold", className)}>
      <span className="text-2xl tracking-[0.2em] uppercase">cocoon</span>
      {tagline && <span className="mt-1 text-[11px] tracking-[0.3em] uppercase opacity-80">{tagline}</span>}
    </Link>
  );
}
