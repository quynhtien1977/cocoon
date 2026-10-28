import { ManagerProductDetailPage } from "@/features/manager/product-detail-page";

export const metadata = { title: "Chi tiết sản phẩm | Cocoon CRM" };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ preview?: string }> }) {
  const { id } = await params;
  const preview = (await searchParams).preview === "1";
  return <ManagerProductDetailPage key={`${id}:${preview}`} id={id} preview={preview} />;
}
