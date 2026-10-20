"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Screen } from "@/lib/screens";

const portalRoots = new Set(["/account", "/manager", "/admin"]);

function isActive(pathname: string, href: string) {
  // Portal home must match exactly, otherwise every page in the portal highlights it.
  return pathname === href || (!portalRoots.has(href) && pathname.startsWith(`${href}/`));
}

export function NavLinks({ items, className, linkClassName, activeClassName }: {
  items: Screen[];
  className?: string;
  linkClassName?: string;
  activeClassName?: string;
}) {
  const pathname = usePathname();
  return (
    <ul className={className}>
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.code}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(linkClassName, active && activeClassName)}
            >
              {item.title}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
