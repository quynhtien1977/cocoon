"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartColumn, ChartNoAxesCombined, ChevronDown, ClipboardList, House, LayoutDashboard, MessageSquare, Package, ScrollText, Sheet, Lightbulb, UserRound, UserRoundPlus, UsersRound, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { isNavActive, type NavItem } from "@/lib/navigation";

const icons: Record<string, LucideIcon> = {
  U1: House, U2: UserRound, U3: UserRoundPlus,
  C0: House, C1: UserRound, C2: Package, C3: MessageSquare, C6: ClipboardList, C8: Lightbulb,
  S1: MessageSquare, M1: LayoutDashboard, M2: UsersRound, M5: MessageSquare,
  M7: ClipboardList, M11: Package, M13: Lightbulb, M16: ChartColumn, M17: ChartNoAxesCombined, M18: Sheet,
  A1: UsersRound, A2: UserRoundPlus, A3: ScrollText,
};

export function NavLinks({ items, className, linkClassName, activeClassName, groupActiveClassName, childListClassName, childLinkClassName, showIcons = false, labelClassName, childIconClassName, toggleClassName = "grid", onNavigate }: {
  items: NavItem[];
  className?: string;
  linkClassName?: string;
  activeClassName?: string;
  /** A group whose sub-page is open: highlighted, but the sub-page carries the "current" style. */
  groupActiveClassName?: string;
  childListClassName?: string;
  childLinkClassName?: string;
  showIcons?: boolean;
  labelClassName?: string;
  /** Sub-page icons, e.g. only for the icon-only sidebar. */
  childIconClassName?: string;
  /** Visibility of the open/close chevron of a group, e.g. hidden on the icon-only sidebar. */
  toggleClassName?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  // Chevron choice per group; until the user toggles, a group is open while one of its pages is.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  return (
    <ul className={className}>
      {items.map((item) => {
        const active = isNavActive(pathname, item);
        const Icon = icons[item.code] ?? House;
        const children = item.children ?? [];
        const open = children.length > 0 && (expanded[item.code] ?? active);
        const listId = `nav-${item.code}`;
        return (
          <li key={item.code} className={children.length ? "relative" : undefined}>
            {/* A group link opens its first sub-page (and the group); the chevron only opens or closes the list. */}
            <Link
              href={children[0]?.href ?? item.href}
              aria-current={active && !children.length ? "page" : undefined}
              title={item.title}
              onClick={() => { if (children.length) setExpanded((value) => ({ ...value, [item.code]: true })); onNavigate?.(); }}
              className={cn("focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring", linkClassName, children.length > 0 && "lg:pr-11", active && (children.length ? groupActiveClassName ?? activeClassName : activeClassName))}
            >
              {showIcons && <Icon className="size-5 shrink-0" aria-hidden="true" strokeWidth={1.5} />}
              <span className={labelClassName}>{item.title}</span>
              {item.badge !== undefined && (
                <Badge variant="secondary" className="min-w-5 rounded-full px-1 font-label" aria-label={`${item.badge} khảo sát chờ làm`}>
                  {item.badge}
                </Badge>
              )}
            </Link>
            {children.length > 0 && (
              <button type="button" aria-expanded={open} aria-controls={listId} aria-label={`${open ? "Thu gọn" : "Mở"} mục ${item.title}`}
                onClick={() => setExpanded((value) => ({ ...value, [item.code]: !open }))}
                className={cn("absolute top-1 right-1 size-9 place-items-center rounded-md text-current/70 hover:bg-current/10 hover:text-current focus-visible:outline-2 focus-visible:outline-ring", toggleClassName)}>
                <ChevronDown className={cn("size-4 transition-transform motion-reduce:transition-none", !open && "-rotate-90")} aria-hidden="true" />
              </button>
            )}
            {open && (
              <ul id={listId} aria-label={item.title} className={childListClassName}>
                {children.map((child) => {
                  const ChildIcon = icons[child.code] ?? House;
                  const current = isNavActive(pathname, child);
                  return (
                    <li key={child.code}>
                      <Link href={child.href} aria-current={current ? "page" : undefined} title={child.title} onClick={onNavigate}
                        className={cn("focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring", childLinkClassName ?? linkClassName, current && activeClassName)}>
                        {showIcons && <ChildIcon className={cn("size-5 shrink-0", childIconClassName)} aria-hidden="true" strokeWidth={1.5} />}
                        <span className={labelClassName}>{child.title}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
