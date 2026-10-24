"use client";

import { usePathname, useSelectedLayoutSegment } from "next/navigation";
import { LoginDialog } from "./login-dialog";
import { RegisterDialog } from "./register-dialog";

/** One dialog owner prevents stacked modals when switching login/register. */
export function AuthDialogs() {
  const pathname = usePathname();
  const background = useSelectedLayoutSegment();
  const direct = background === "login" || background === "register";
  if (pathname === "/login") return <LoginDialog direct={direct} />;
  if (pathname === "/register") return <RegisterDialog direct={direct} />;
  return null;
}
