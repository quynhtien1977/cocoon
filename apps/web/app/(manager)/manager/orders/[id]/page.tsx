import { screenMetadata } from "@/components/brand/screen-placeholder";
import { OrderDetailView } from "@/features/orders/order-detail-view";

export const metadata = screenMetadata("M17");

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderDetailView id={Number(id)} portal="manager" />;
}

