import { PublicShell } from "@/components/shell/customer-shell";

export default function Layout({ children }: LayoutProps<"/">) {
  return <PublicShell>{children}</PublicShell>;
}
