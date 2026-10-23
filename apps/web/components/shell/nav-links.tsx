"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, House, LayoutDashboard, MessageSquare, Package, ScrollText, Sparkles, UserRound, UserRoundPlus, UsersRound, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { isNavActive, type NavItem } from "@/lib/navigation";

const icons: Record<string, LucideIcon> = {
  U1: House, U2: UserRound, U3: UserRoundPlus,
  C0: House, C1: UserRound, C2: Package, C3: MessageSquare, C6: ClipboardList, C8: Sparkles,
  S1: MessageSquare, M1: LayoutDashboard, M2: UsersRound, M5: MessageSquare,
  M7: ClipboardList, M11: Package, M13: Sparkles, A1: UsersRound, A2: UserRoundPlus, A3: ScrollText,
};

export function NavLinks({ items, className, linkClassName, activeClassName, showIcons = false, labelClassName, onNavigate }: {
  items: NavItem[];
  className?: string;
  linkClassName?: string;
  activeClassName?: string;
  showIcons?: boolean;
  labelClassName?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <ul className={className}>
      {items.map((item) => {
        const active = isNavActive(pathname, item);
        const Icon = icons[item.code] ?? House;
        return (
          <li key={item.code}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              title={item.title}
              onClick={onNavigate}
              className={cn("focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring", linkClassName, active && activeClassName)}
            >
              {showIcons && <Icon className="size-5 shrink-0" aria-hidden="true" strokeWidth={1.5} />}
              <span className={labelClassName}>{item.title}</span>
              {item.badge !== undefined && (
                <Badge variant="secondary" className="min-w-5 rounded-full px-1 font-label" aria-label={`${item.badge} khảo sát chờ làm`}>
                  {item.badge}
                </Badge>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
