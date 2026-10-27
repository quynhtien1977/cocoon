import { apiRequest } from "../../lib/api/client";

export type CustomerSurvey = {
  id: number;
  title: string;
  description: string;
  category: string;
  completedAt: string | null;
  closeAt: string | null;
  questionCount: number | null;
  estimatedMinutes: number | null;
  googleFormUrl: string | null;
};

export function googleFormHref(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    if (url.hostname === "forms.gle" && /^\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)) return url.href;
    if (url.hostname === "docs.google.com" && /^\/forms\/(?:u\/\d+\/)?d\/(?:e\/)?[A-Za-z0-9_-]+\/viewform\/?$/.test(url.pathname)) return url.href;
  } catch { /* Missing or invalid form links are not actionable. */ }
  return null;
}

// The existing endpoint is a stub without a response DTO. Keep the proposed
// customer-list contract here; completion must come from the server, not clicks.
export function parseSurveys(payload: unknown): { items: CustomerSurvey[]; totalCount: number } {
  const page = payload as { items?: unknown; totalCount?: unknown } | null;
  const rows = Array.isArray(payload) ? payload : page?.items;
  if (!Array.isArray(rows)) throw new Error("Dữ liệu khảo sát chưa hợp lệ.");
  const ids = new Set<number>();
  const validDate = (value: unknown) => value === null || typeof value === "string" && Number.isFinite(Date.parse(value));
  const optionalCount = (value: unknown) => value == null || typeof value === "number" && Number.isInteger(value) && value > 0;
  const items = rows.map((raw): CustomerSurvey => {
    const item = raw as CustomerSurvey;
    if (!item || !Number.isSafeInteger(item.id) || item.id <= 0 || ids.has(item.id) || typeof item.title !== "string" || !item.title.trim() || !validDate(item.completedAt) || !validDate(item.closeAt) || !optionalCount(item.questionCount) || !optionalCount(item.estimatedMinutes)) throw new Error("Dữ liệu khảo sát chưa đầy đủ.");
    ids.add(item.id);
    return { id: item.id, title: item.title, description: typeof item.description === "string" ? item.description : "", category: typeof item.category === "string" ? item.category : "Lắng nghe khách hàng", completedAt: item.completedAt, closeAt: item.closeAt, questionCount: item.questionCount ?? null, estimatedMinutes: item.estimatedMinutes ?? null, googleFormUrl: googleFormHref(item.googleFormUrl) };
  });
  const totalCount = Array.isArray(payload) ? items.length : page?.totalCount;
  if (!Number.isSafeInteger(totalCount) || (totalCount as number) < items.length) throw new Error("Thông tin phân trang khảo sát chưa hợp lệ.");
  return { items, totalCount: totalCount as number };
}

export async function loadSurveys(signal?: AbortSignal): Promise<CustomerSurvey[]> {
  const items: CustomerSurvey[] = [];
  for (let page = 1; page <= 100; page++) {
    const result = parseSurveys(await apiRequest<unknown>(`/me/surveys?page=${page}&pageSize=20`, { signal }));
    if (result.items.some(item => items.some(previous => previous.id === item.id))) throw new Error("Danh sách khảo sát bị trùng lặp.");
    items.push(...result.items);
    if (items.length >= result.totalCount) return items;
    if (!result.items.length) break;
  }
  throw new Error("Chưa thể tải đầy đủ khảo sát. Vui lòng thử lại.");
}

export const previewSurveys: CustomerSurvey[] = [
  { id: 1, title: "Lắng nghe làn da, thấu hiểu trải nghiệm của bạn", description: "Chia sẻ cảm nhận về chu trình làm sạch bí đao. Những điều nhỏ bạn kể sẽ giúp Cocoon chăm sóc làn da tốt hơn.", category: "Trải nghiệm sản phẩm", completedAt: null, closeAt: null, questionCount: 8, estimatedMinutes: 3, googleFormUrl: null },
  { id: 2, title: "Cùng Cocoon nuôi dưỡng một ý tưởng mới", description: "Bạn mong đợi điều gì ở một sản phẩm dưỡng ẩm? Cùng góp ý về kết cấu, hương thơm và cảm giác trên da.", category: "Nghiên cứu sản phẩm", completedAt: null, closeAt: null, questionCount: 5, estimatedMinutes: 2, googleFormUrl: null },
  { id: 3, title: "Một chút về thói quen chăm sóc da của bạn", description: "Cảm ơn bạn đã chia sẻ những thói quen nhỏ trong hành trình chăm sóc bản thân mỗi ngày.", category: "Thói quen chăm sóc", completedAt: "2026-10-20T09:00:00Z", closeAt: null, questionCount: 6, estimatedMinutes: 3, googleFormUrl: null },
];
