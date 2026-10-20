import { BackofficeShell } from "@/components/shell/backoffice-shell";

export default function Layout({ children }: LayoutProps<"/staff">) {
  return <BackofficeShell portal="staff">{children}</BackofficeShell>;
}
