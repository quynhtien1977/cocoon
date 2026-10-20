import { BackofficeShell } from "@/components/shell/backoffice-shell";

export default function Layout({ children }: LayoutProps<"/manager">) {
  return <BackofficeShell portal="manager">{children}</BackofficeShell>;
}
