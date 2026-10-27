import { apiRequest } from "../../lib/api/client";

export type ApiProduct = {
  id: number; name: string; description: string; ingredients: string; benefits: string; usage: string; categoryName: string;
  variants: { name: string; price: number; imageUrl: string | null }[];
};

export function productId(value: string): number | null {
  return /^[1-9]\d*$/.test(value) && Number(value) <= 2147483647 ? Number(value) : null;
}

// The endpoint exists but its response DTO is still unimplemented. Keep the
// anticipated detail/variant shape in this adapter; never map marketing slugs to guessed IDs.
export async function loadProduct(value: string, signal?: AbortSignal): Promise<ApiProduct> {
  const id = productId(value);
  if (!id) throw new Error("Mã sản phẩm không hợp lệ.");
  const data = await apiRequest<unknown>(`/products/${id}`, { signal });
  if (!data || typeof data !== "object") throw new Error("Thông tin sản phẩm chưa đầy đủ.");
  const row = data as Record<string, unknown>;
  if (row.id !== id || typeof row.name !== "string" || !row.name.trim()) throw new Error("Thông tin sản phẩm chưa đầy đủ.");
  const text = (key: string) => {
    if (row[key] == null) return "";
    if (typeof row[key] !== "string") throw new Error("Thông tin sản phẩm chưa hợp lệ.");
    return row[key] as string;
  };
  if (row.variants !== undefined && !Array.isArray(row.variants)) throw new Error("Thông tin biến thể chưa hợp lệ.");
  const variants = ((row.variants ?? []) as unknown[]).map(value => {
    const variant = value as Record<string, unknown> | null;
    if (!variant || typeof variant.name !== "string" || typeof variant.price !== "number" || !Number.isFinite(variant.price) || variant.price < 0 || !(variant.imageUrl == null || typeof variant.imageUrl === "string")) throw new Error("Thông tin biến thể chưa hợp lệ.");
    const imageUrl = typeof variant.imageUrl === "string" && /^(https?:\/\/|\/(?!\/)|data:image\/(?:png|jpeg|webp|svg\+xml);base64,)/i.test(variant.imageUrl) ? variant.imageUrl : null;
    return { name: variant.name, price: variant.price, imageUrl };
  });
  return { id, name: row.name, description: text("description"), ingredients: text("ingredients"), benefits: text("benefits"), usage: text("usage"), categoryName: text("categoryName"), variants };
}
