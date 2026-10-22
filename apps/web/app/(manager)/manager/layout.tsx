import { BackofficeShell } from "@/components/shell/backoffice-shell";
import { navFor } from "@/lib/screens";

export default function Layout({ children }: LayoutProps<"/manager">) {
  return <BackofficeShell variant="manager" nav={navFor("manager")}>{children}</BackofficeShell>;
}
