import { apiRequest } from "../../lib/api/client";
import { resolveProductImage } from "./product-media";

export type ManagerProduct = {
  id: number; name: string; sku: string; categoryId: number; categoryName: string;
  status: "Active" | "Inactive" | "Upcoming"; preferences: string[];
  averageRating: number | null; feedbackCount: number | null; description: string; imageUrl?: string | null;
};

// GET /products is currently a stub without response DTOs. Isolate the proposed
// enriched list contract here; missing feedback data must not become invented zeroes.
export function parseManagerProducts(payload: unknown): { items: ManagerProduct[]; totalCount: number } {
  const page = payload as { items?: unknown; totalCount?: unknown } | null;
  const rows = Array.isArray(payload) ? payload : page?.items;
  if (!Array.isArray(rows)) throw new Error("Danh sách sản phẩm chưa hợp lệ.");
  const ids = new Set<number>();
  const items = rows.map((raw): ManagerProduct => {
    const row = raw as ManagerProduct;
    const status = typeof row?.status === "number" ? (["Active", "Inactive", "Upcoming"] as const)[row.status] : row?.status;
    if (!row || !Number.isSafeInteger(row.id) || row.id <= 0 || ids.has(row.id) || typeof row.name !== "string" || !row.name.trim() || !Number.isSafeInteger(row.categoryId) || row.categoryId <= 0 || typeof row.categoryName !== "string" || !row.categoryName.trim() || !["Active", "Inactive", "Upcoming"].includes(status) || !Array.isArray(row.preferences) || !row.preferences.every(tag => typeof tag === "string" && tag.trim()) || !(row.averageRating == null || typeof row.averageRating === "number" && Number.isFinite(row.averageRating) && row.averageRating >= 1 && row.averageRating <= 5) || !(row.feedbackCount == null || Number.isSafeInteger(row.feedbackCount) && row.feedbackCount >= 0)) throw new Error("Thông tin sản phẩm chưa đầy đủ hoặc bị trùng lặp.");
    ids.add(row.id);
    const variants = (raw as { variants?: { imageUrl?: unknown }[] }).variants;
    const image = row.imageUrl ?? (Array.isArray(variants) ? variants.find(variant => variant?.imageUrl)?.imageUrl : null);
    return { id: row.id, name: row.name, sku: typeof row.sku === "string" ? row.sku : "", categoryId: row.categoryId, categoryName: row.categoryName, status, preferences: [...new Set(row.preferences)], averageRating: row.averageRating ?? null, feedbackCount: row.feedbackCount ?? null, description: typeof row.description === "string" ? row.description : "", imageUrl: resolveProductImage(row.name, image) };
  });
  const totalCount = Array.isArray(payload) ? items.length : page?.totalCount;
  if (!Number.isSafeInteger(totalCount) || (totalCount as number) < items.length) throw new Error("Phân trang sản phẩm chưa hợp lệ.");
  return { items, totalCount: totalCount as number };
}

export async function loadManagerProducts(signal?: AbortSignal): Promise<ManagerProduct[]> {
  const items: ManagerProduct[] = [];
  for (let page = 1; page <= 100; page++) {
    const result = parseManagerProducts(await apiRequest<unknown>(`/products?page=${page}&pageSize=50`, { signal }));
    if (result.items.some(item => items.some(previous => previous.id === item.id))) throw new Error("Danh sách sản phẩm bị trùng lặp.");
    items.push(...result.items);
    if (items.length >= result.totalCount) return items;
    if (!result.items.length) break;
  }
  throw new Error("Chưa thể tải đầy đủ danh sách sản phẩm.");
}

export const productStatusLabels = { Active: "Đang bán", Inactive: "Ngừng bán", Upcoming: "Sắp ra mắt" };

export async function changeProductStatus(id: number, status: ManagerProduct["status"], signal?: AbortSignal): Promise<void> {
  if (!Number.isSafeInteger(id) || id <= 0 || id > 2147483647 || !Object.hasOwn(productStatusLabels, status)) throw new Error("Mã sản phẩm hoặc trạng thái không hợp lệ.");
  await apiRequest<void>(`/products/${id}/status`, { method: "PATCH", json: { status }, signal });
}

export function productsCsv(items: readonly ManagerProduct[]): string {
  const escape = (value: unknown) => {
    let text = String(value ?? "");
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return "\uFEFF" + [
    ["Mã", "Sản phẩm", "SKU", "Danh mục", "Trạng thái", "Sở thích", "Đánh giá", "Phản hồi"],
    ...items.map(item => [item.id, item.name, item.sku, item.categoryName, productStatusLabels[item.status], item.preferences.join("; "), item.averageRating, item.feedbackCount]),
  ].map(row => row.map(escape).join(",")).join("\r\n");
}

export const previewProducts: ManagerProduct[] = [
  { id: 1, name: "Gel rửa mặt bí đao", sku: "CC-BD-01", categoryId: 1, categoryName: "Chăm sóc da mặt", status: "Active", preferences: ["Da dầu", "Da mụn", "Thuần chay"], averageRating: 4.8, feedbackCount: 65, description: "Làm sạch dịu nhẹ với bí đao, dành cho chu trình chăm sóc da mỗi ngày." },
  { id: 2, name: "Nước sen Hậu Giang", sku: "CC-SEN-02", categoryId: 1, categoryName: "Chăm sóc da mặt", status: "Active", preferences: ["Da nhạy cảm", "Cấp ẩm"], averageRating: 4.6, feedbackCount: 28, description: "Chăm sóc làn da nhạy cảm với cảm hứng từ sen Hậu Giang." },
  { id: 3, name: "Cà phê Đắk Lắk làm sạch da chết mặt", sku: "CC-CF-03", categoryId: 1, categoryName: "Chăm sóc da mặt", status: "Active", preferences: ["Làm sạch", "Thành phần Việt"], averageRating: 4.9, feedbackCount: 82, description: "Chăm sóc bề mặt da với hạt cà phê Đắk Lắk." },
  { id: 4, name: "Nước dưỡng tóc tinh dầu bưởi", sku: "CC-TB-04", categoryId: 2, categoryName: "Chăm sóc tóc", status: "Active", preferences: ["Chăm sóc tóc", "Thiên nhiên"], averageRating: 4.5, feedbackCount: 44, description: "Chăm sóc mái tóc với tinh dầu bưởi Việt Nam." },
  { id: 5, name: "Thạch hoa hồng dưỡng ẩm", sku: "CC-HH-05", categoryId: 1, categoryName: "Chăm sóc da mặt", status: "Upcoming", preferences: ["Da khô", "Dưỡng ẩm"], averageRating: null, feedbackCount: 0, description: "Sản phẩm minh họa đang trong giai đoạn chuẩn bị ra mắt." },
  { id: 6, name: "Bơ dưỡng thể cà phê Đắk Lắk", sku: "CC-CF-06", categoryId: 3, categoryName: "Chăm sóc cơ thể", status: "Active", preferences: [], averageRating: 4.6, feedbackCount: 18, description: "Dưỡng da cơ thể với cảm hứng từ cà phê Đắk Lắk." },
  { id: 7, name: "Son dưỡng dầu dừa Bến Tre", sku: "CC-DD-07", categoryId: 4, categoryName: "Chăm sóc môi", status: "Inactive", preferences: ["Chăm sóc môi"], averageRating: 4.3, feedbackCount: 23, description: "Dưỡng môi với dầu dừa Bến Tre." },
];
