import type { Screen } from "./screens";

export type NavItem = Pick<Screen, "code" | "title" | "href"> & {
  exact?: boolean;
  badge?: number;
};

export function isNavActive(pathname: string, item: Pick<NavItem, "href" | "exact">) {
  return pathname === item.href || (!item.exact && item.href !== "/" && pathname.startsWith(`${item.href}/`));
}
