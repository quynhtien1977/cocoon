import { BackofficeShell } from "@/components/shell/backoffice-shell";

export default function Layout({ children }: LayoutProps<"/admin">) {
  return <BackofficeShell portal="admin">{children}</BackofficeShell>;
}
