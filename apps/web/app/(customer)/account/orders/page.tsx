import { OrdersPage } from "@/features/customer/orders-page";

export const metadata = { title: "Đơn hàng của bạn | Cocoon" };

export default async function Page({ searchParams }: PageProps<"/account/orders">) {
  const query = await searchParams;
  const initialFilter = query.tab === "reviewed" ? "reviewed" : "all";
  const initialPreview = query.preview === "1";
  return <OrdersPage key={`${initialFilter}:${initialPreview}`} initialFilter={initialFilter} initialPreview={initialPreview} />;
}
