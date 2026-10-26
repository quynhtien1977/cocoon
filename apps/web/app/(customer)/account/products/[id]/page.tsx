import { notFound } from "next/navigation";
import { findReferenceProduct } from "@/features/landing/products";
import { ProductDetail } from "@/features/customer/product-detail";

export async function generateMetadata({ params }: PageProps<"/account/products/[id]">) {
  const { id } = await params;
  return { title: `${findReferenceProduct(id)?.name ?? "Sản phẩm"} | Cocoon` };
}

export default async function Page({ params }: PageProps<"/account/products/[id]">) {
  const { id } = await params;
  const product = findReferenceProduct(id);
  if (!product) notFound();
  return <ProductDetail key={id} product={product} />;
}
