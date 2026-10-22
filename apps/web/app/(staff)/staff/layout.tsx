import { BackofficeShell } from "@/components/shell/backoffice-shell";
import { navFor } from "@/lib/screens";

export default function Layout({ children }: LayoutProps<"/staff">) {
  return <BackofficeShell variant="staff" nav={navFor("staff")}>{children}</BackofficeShell>;
}
