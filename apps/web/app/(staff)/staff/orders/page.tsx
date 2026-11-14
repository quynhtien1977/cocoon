import { screenMetadata } from "@/components/brand/screen-placeholder";
import { OrdersList } from "@/features/orders/orders-list";

export const metadata = screenMetadata("S4");

export default function Page() {
  return <OrdersList portal="staff" />;
}
