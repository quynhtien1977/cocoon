import { apiRequest } from "../../lib/api/client";

export type CustomerRecommendation = {
  id: number;
  score: number;
  product: { id: number; name: string; minPrice: number | null; imageUrl: string | null; avgRating: number | null };
  reasons: { code: string; label: string }[];
};
const validId = (id: unknown): id is number => typeof id === "number" && Number.isInteger(id) && id > 0 && id <= 2147483647;
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
function imageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (/^\/(?!\/|\\)/.test(value) || /^data:image\/(?:png|jpeg|webp|svg\+xml);base64,[A-Za-z\d+/=]+$/i.test(value)) return value;
  try { const url = new URL(value); if (["http:", "https:"].includes(url.protocol) && !url.username && !url.password) return url.href; } catch { /* Unusable images use the card fallback. */ }
  return null;
}

/** Matches RecommendationItem / RecommendedProduct from the existing customer API. */
export function parseRecommendations(payload: unknown): CustomerRecommendation[] {
  if (!Array.isArray(payload)) throw new Error("Danh sách gợi ý chưa hợp lệ.");
  const ids = new Set<number>(), products = new Set<number>();
  return payload.map(raw => {
    const row = record(raw), product = record(row.product);
    if (!validId(row.id) || ids.has(row.id) || typeof row.score !== "number" || !Number.isFinite(row.score) || !validId(product.id) || products.has(product.id) || typeof product.name !== "string" || !product.name.trim() || !(product.minPrice === null || typeof product.minPrice === "number" && Number.isFinite(product.minPrice) && product.minPrice >= 0) || !(product.avgRating === null || typeof product.avgRating === "number" && Number.isFinite(product.avgRating) && product.avgRating >= 1 && product.avgRating <= 5) || !Array.isArray(row.reasons)) throw new Error("Thông tin sản phẩm gợi ý chưa đầy đủ.");
    ids.add(row.id); products.add(product.id);
    const reasons = row.reasons.map(raw => {
      const reason = record(raw);
      if (typeof reason.code !== "string" || typeof reason.label !== "string" || !reason.label.trim()) throw new Error("Lý do gợi ý chưa hợp lệ.");
      return { code: reason.code, label: reason.label };
    });
    return { id: row.id, score: row.score, product: { id: product.id, name: product.name, minPrice: product.minPrice, imageUrl: imageUrl(product.imageUrl), avgRating: product.avgRating }, reasons };
  });
}
export async function loadRecommendations(signal?: AbortSignal): Promise<CustomerRecommendation[]> {
  return parseRecommendations(await apiRequest<unknown>("/me/recommendations", { signal }));
}
export async function recordRecommendationClick(id: number): Promise<void> {
  if (!validId(id)) throw new Error("Mã gợi ý không hợp lệ.");
  await apiRequest<void>(`/me/recommendations/${id}/click`, { method: "POST", signal: AbortSignal.timeout(5000), redirectOnUnauthorized: false });
}
