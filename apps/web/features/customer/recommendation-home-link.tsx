"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../lib/api/client";
import { getAccountRole } from "../../lib/auth/roles";
import { CUSTOMER_RECOMMENDATIONS_HREF } from "../../lib/customer-links";

export function RecommendationHomeLink({ customer = false, className, children }: { customer?: boolean; className?: string; children: ReactNode }) {
  const router = useRouter();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  return <Link href={customer ? "#goi-y-cho-ban" : CUSTOMER_RECOMMENDATIONS_HREF} className={className} aria-busy={pending} onClick={async event => {
    if (customer || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (busy.current) return;
    busy.current = true; setPending(true);
    try {
      const account = await apiRequest<unknown>("/me", { refresh: false, redirectOnUnauthorized: false, signal: AbortSignal.timeout(8000) });
      if (getAccountRole(account) === "Customer") { router.push(CUSTOMER_RECOMMENDATIONS_HREF); return; }
    } catch { /* The existing shared login handles an absent or expired customer session. */ }
    finally { busy.current = false; setPending(false); }
    router.push(`/login?next=${encodeURIComponent(CUSTOMER_RECOMMENDATIONS_HREF)}`, { scroll: false });
  }}>{children}</Link>;
}
