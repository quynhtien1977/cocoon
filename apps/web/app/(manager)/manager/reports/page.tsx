import { redirect } from "next/navigation";

/** "Báo cáo" is a menu group; its first page is Phân tích. */
export default function Page() {
  redirect("/manager/reports/analytics");
}
