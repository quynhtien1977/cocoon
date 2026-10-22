import { PublicShell } from "@/components/shell/public-shell";

export default function Layout({ children }: LayoutProps<"/">) {
  return <PublicShell>{children}</PublicShell>;
}
