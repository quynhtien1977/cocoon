import { notFound } from "next/navigation";
import { screenMetadata } from "@/components/brand/screen-placeholder";
import { CustomerDetailPage } from "@/features/customers/components/customer-detail";

export const metadata = screenMetadata("M4");

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[1-9]\d{0,9}$/.test(id) || Number(id) > 2147483647) notFound();
  return <CustomerDetailPage key={id} id={Number(id)} />;
}
