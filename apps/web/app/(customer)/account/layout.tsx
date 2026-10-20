import { CustomerShell } from "@/components/shell/customer-shell";

export default function Layout({ children }: LayoutProps<"/account">) {
  return <CustomerShell>{children}</CustomerShell>;
}
