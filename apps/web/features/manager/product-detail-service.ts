import { apiRequest } from "../../lib/api/client";
import { parseManagerProducts, previewProducts, type ManagerProduct } from "./products-service";
import { resolveProductImage, safeProductImage } from "./product-media";

export type ProductPreference = { id: number; name: string };
export type ManagerProductDetail = ManagerProduct & {
  preferenceIds: number[] | null;
  variants: { id: number; name: string; sku: string; price: number; imageUrl: string | null }[];
  ingredients: string; benefits: string; usage: string;
};
export type ProductInsights = { totalFeedback: number; averageRating: number | null; ratingDistribution: { rating: number; count: number }[] };
const validId = (id: number) => Number.isSafeInteger(id) && id > 0 && id <= 2147483647;
const validIds = (ids: unknown): ids is number[] => Array.isArray(ids) && ids.every(validId) && new Set(ids).size === ids.length;
const assertId = (id: number) => { if (!validId(id)) throw new Error("Mã sản phẩm không hợp lệ."); };

export async function loadManagerProduct(value: string, preview = false, signal?: AbortSignal): Promise<ManagerProductDetail> {
  if (!/^[1-9]\d*$/.test(value)) throw new Error("Mã sản phẩm không hợp lệ.");
  const id = Number(value); assertId(id);
  if (preview) {
    const product = previewProducts.find(item => item.id === id);
    if (!product) throw new Error("Không tìm thấy sản phẩm mẫu.");
    const imageUrl = resolveProductImage(product.name, null);
    return { ...product, imageUrl, preferenceIds: null,
      variants: id === 1 ? [{ id: 1, name: "Chai 140ml", sku: "CC-BD-140", price: 192000, imageUrl: null }, { id: 2, name: "Chai 310ml", sku: "CC-BD-310", price: 299000, imageUrl }] : [],
      ingredients: id === 1 ? "Bí đao, rau má và tràm trà." : "Thông tin thành phần sẽ được cập nhật từ hồ sơ sản phẩm.",
      benefits: id === 1 ? "Làm sạch bụi bẩn và dầu thừa, đồng thời giữ cảm giác ẩm mịn sau khi rửa." : "Thông tin công dụng sẽ được cập nhật từ hồ sơ sản phẩm.",
      usage: id === 1 ? "Làm ướt da, tạo bọt nhẹ với nước, mát-xa rồi rửa sạch. Tham khảo hướng dẫn trên bao bì trước khi dùng." : "Tham khảo hướng dẫn trên bao bì sản phẩm." };
  }
  // Existing endpoint currently has no implemented DTO; keep its anticipated shape here.
  const payload = await apiRequest<unknown>(`/products/${id}`, { signal });
  const row = payload as ManagerProductDetail;
  const product = parseManagerProducts([row]).items[0];
  if (product.id !== id || !Array.isArray(row.variants) || !(row.preferenceIds == null || validIds(row.preferenceIds))) throw new Error("Chi tiết sản phẩm chưa hợp lệ.");
  const seen = new Set<number>();
  const variants = row.variants.map(variant => {
    if (!variant || !validId(variant.id) || seen.has(variant.id) || typeof variant.name !== "string" || typeof variant.sku !== "string" || !Number.isFinite(variant.price) || variant.price < 0) throw new Error("Thông tin biến thể chưa hợp lệ.");
    seen.add(variant.id);
    return { id: variant.id, name: variant.name, sku: variant.sku, price: variant.price, imageUrl: safeProductImage(variant.imageUrl) };
  });
  const text = (key: "ingredients" | "benefits" | "usage") => {
    if (row[key] == null) return "";
    if (typeof row[key] !== "string") throw new Error("Nội dung sản phẩm chưa hợp lệ.");
    return row[key];
  };
  return { ...product, preferenceIds: row.preferenceIds ?? null, variants, ingredients: text("ingredients"), benefits: text("benefits"), usage: text("usage") };
}

export async function loadPreferenceCatalog(signal?: AbortSignal): Promise<ProductPreference[]> {
  const rows = await apiRequest<unknown>("/preferences", { signal });
  if (!Array.isArray(rows)) throw new Error("Chưa thể tải danh mục sở thích.");
  const ids = new Set<number>();
  return rows.map(row => {
    if (!row || !validId(row.id) || ids.has(row.id) || typeof row.name !== "string") throw new Error("Danh mục sở thích chưa hợp lệ.");
    ids.add(row.id); return { id: row.id, name: row.name };
  });
}
export async function saveProductPreferences(id: number, preferenceIds: number[], signal?: AbortSignal): Promise<void> {
  assertId(id);
  if (!validIds(preferenceIds)) throw new Error("Sở thích không hợp lệ.");
  await apiRequest<void>(`/products/${id}/preferences`, { method: "PUT", json: { preferenceIds }, signal });
}
export async function loadProductInsights(id: number, signal?: AbortSignal): Promise<ProductInsights> {
  assertId(id);
  const data = await apiRequest<ProductInsights>(`/products/${id}/insights`, { signal });
  if (!data || !Number.isSafeInteger(data.totalFeedback) || data.totalFeedback < 0 || !(data.averageRating === null || typeof data.averageRating === "number" && data.averageRating >= 1 && data.averageRating <= 5) || !Array.isArray(data.ratingDistribution) || data.ratingDistribution.some(row => !Number.isInteger(row.rating) || row.rating < 1 || row.rating > 5 || !Number.isSafeInteger(row.count) || row.count < 0) || new Set(data.ratingDistribution.map(row => row.rating)).size !== data.ratingDistribution.length || data.ratingDistribution.reduce((sum, row) => sum + row.count, 0) !== data.totalFeedback) throw new Error("Dữ liệu phản hồi chưa hợp lệ.");
  return data;
}
