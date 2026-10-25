import { ProductCatalog } from "@/features/customer/product-catalog";

export const metadata = { title: "Tất cả sản phẩm | Cocoon" };

export default async function Page({ searchParams }: PageProps<"/account/products">) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  return <ProductCatalog key={query} initialQuery={query} />;
}
