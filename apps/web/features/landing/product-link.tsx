"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api/client";
import { getAccountRole } from "@/features/auth/login-service";

function toAccountProductHref(href: string): string {
  const slug = href.split("/").filter(Boolean).at(-1);
  return slug ? `/account/products/${slug}` : "/account/products";
}

/** Product destinations are only opened after the current session is verified. */
export function ProductLink({ href, className, children }: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const checking = useRef(false);
  const [pending, setPending] = useState(false);
  const productHref = toAccountProductHref(href);

  if (pathname.startsWith("/account")) {
    return <Link href={productHref} className={className}>{children}</Link>;
  }

  const loginHref = `/login?next=${encodeURIComponent(productHref)}`;

  return <Link href={loginHref} scroll={false} prefetch={false} className={className}
    aria-busy={pending} aria-disabled={pending || undefined}
    onClick={async (event) => {
      event.preventDefault();
      if (checking.current) return;
      checking.current = true;
      setPending(true);
      try {
        // Do not let the API client's automatic 401 redirect replace the landing page.
        const profile = await apiRequest<unknown>("/me", { refresh: false, signal: AbortSignal.timeout(8000) });
        if (getAccountRole(profile)) {
          window.location.assign(href);
          return;
        }
      } catch {
        // An unverified or expired session must sign in before viewing a product.
      } finally {
        checking.current = false;
        setPending(false);
      }
      router.push(loginHref, { scroll: false });
    }}>
    {children}
  </Link>;
}
