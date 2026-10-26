"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { LandingFrame } from "@/features/landing/landing-frame";

export function CustomerShell({ children, pendingSurveyCount }: { children: ReactNode; pendingSurveyCount?: number }) {
  const pathname = usePathname();
  const fullWidth = pathname === "/account" || pathname === "/account/cart" || pathname === "/account/products";
  return <LandingFrame customer pendingSurveyCount={pendingSurveyCount}>
    {fullWidth ? children : <div className="mx-auto min-h-[60vh] w-full max-w-[1080px] px-4 py-8">{children}</div>}
  </LandingFrame>;
}
