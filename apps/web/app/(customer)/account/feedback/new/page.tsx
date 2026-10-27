import { ProductReview } from "@/features/customer/product-review";

export const metadata = { title: "Đánh giá sản phẩm | Cocoon" };

export default async function Page({ searchParams }: PageProps<"/account/feedback/new">) {
  const params = await searchParams;
  const orderItemParam = Array.isArray(params.orderItemId) ? "invalid" : params.orderItemId;
  const preview = params.preview === "1";
  const previewItem = typeof params.item === "string" ? params.item : undefined;
  return <ProductReview key={`${orderItemParam}:${preview}:${previewItem}`} orderItemParam={orderItemParam} preview={preview} previewItem={previewItem} />;
}
