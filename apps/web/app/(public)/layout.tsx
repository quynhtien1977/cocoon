import { PublicShell } from "@/components/shell/public-shell";
import type { ReactNode } from "react";
import { AuthDialogs } from "@/features/auth/auth-dialogs";

export default function Layout({ children, modal }: { children: ReactNode; modal: ReactNode }) {
  return <><PublicShell>{children}</PublicShell>{modal}<AuthDialogs /></>;
}
