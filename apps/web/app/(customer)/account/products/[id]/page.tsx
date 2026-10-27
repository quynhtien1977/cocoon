import { notFound } from "next/navigation";
import { findReferenceProduct } from "@/features/landing/products";
import { ProductDetail } from "@/features/customer/product-detail";
import { ApiProductDetail } from "@/features/customer/api-product-detail";
import { productId } from "@/features/customer/product-service";

export async function generateMetadata({ params }: PageProps<"/account/products/[id]">) {
  const { id } = await params;
  return { title: `${findReferenceProduct(id)?.name ?? "Sản phẩm"} | Cocoon` };
}

export default async function Page({ params }: PageProps<"/account/products/[id]">) {
  const { id } = await params;
  if (productId(id)) return <ApiProductDetail key={id} id={id} />;
  const product = findReferenceProduct(id);
  if (!product) notFound();
  return <ProductDetail key={id} product={product} />;
}
