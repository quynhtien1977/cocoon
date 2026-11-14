import { ApiError, apiRequest } from "../../lib/api/client";

export type ReviewableItem = { orderItemId: number; name: string; variant: string; imageUrl: string | null; orderCode: string };
export type ReviewValues = { rating: number | null; content: string };

export function parseOrderItemId(value: string | undefined): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id <= 2147483647 ? id : null;
}

/** Same rule as POST me/feedback: trimmed content of 20–1000 characters. */
export function validateReview({ rating, content }: ReviewValues) {
  const length = content.trim().length;
  return {
    rating: rating !== null && Number.isInteger(rating) && rating >= 1 && rating <= 5 ? "" : "Vui lòng chọn từ 1 đến 5 sao.",
    content: !length ? "Hãy chia sẻ nhận xét của bạn về sản phẩm." : length < 20 ? "Nhận xét cần ít nhất 20 ký tự." : length > 1000 ? "Nhận xét không được vượt quá 1.000 ký tự." : "",
  };
}

// Response DTO is not implemented in the backend yet. Fail closed if its future
// enriched payload does not match this isolated frontend adapter.
export function parseReviewableItems(response: unknown): ReviewableItem[] {
  const rows = Array.isArray(response) ? response : response && typeof response === "object" && "items" in response ? response.items : undefined;
  if (!Array.isArray(rows)) throw new Error("Chưa đọc được danh sách sản phẩm có thể đánh giá.");
  const ids = new Set<number>();
  return rows.map((row) => {
    const item = row as ReviewableItem;
    if (!item || !parseOrderItemId(String(item.orderItemId)) || ids.has(item.orderItemId) || typeof item.orderItemId !== "number" || typeof item.name !== "string" || !item.name.trim() || typeof item.variant !== "string" || typeof item.orderCode !== "string" || !(item.imageUrl === null || typeof item.imageUrl === "string")) throw new Error("Thông tin sản phẩm đánh giá chưa đầy đủ.");
    ids.add(item.orderItemId);
    return item;
  });
}

export async function getReviewableItems(signal?: AbortSignal) {
  return parseReviewableItems(await apiRequest<unknown>("/me/reviewable-items", { refresh: false, signal }));
}

/** Sends the review, then its photos. A photo failure leaves the review sent and is reported as photosFailed. */
export async function submitReview(orderItemId: number, values: ReviewValues, photos: File[] = []): Promise<{ photosFailed: boolean }> {
  if (!parseOrderItemId(String(orderItemId))) throw new Error("Sản phẩm trong đơn hàng không hợp lệ.");
  const errors = validateReview(values);
  if (errors.rating || errors.content) throw new Error(errors.rating || errors.content);
  // Recheck eligibility: another tab may already have reviewed the item.
  const items = await getReviewableItems(AbortSignal.timeout(12000));
  if (!items.some((item) => item.orderItemId === orderItemId)) throw new Error("Sản phẩm này đã được đánh giá hoặc không còn đủ điều kiện đánh giá.");
  const created = await apiRequest<{ id: number }>("/me/feedback", { method: "POST", refresh: false, json: { orderItemId, rating: values.rating, content: values.content.trim() } });
  // One photo per request: the Next.js proxy truncates request bodies above 10 MB, and 5 photos may reach 25 MB.
  let photosFailed = false;
  for (const photo of photos) {
    const form = new FormData();
    form.append("photos", photo, photo.name);
    try { await apiRequest<unknown>(`/me/feedback/${created.id}/photos`, { method: "POST", refresh: false, body: form }); }
    catch { photosFailed = true; }
  }
  return { photosFailed };
}

export function reviewErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 501) return "Tính năng đánh giá hiện chưa khả dụng. Vui lòng quay lại sau.";
    if (error.status === 409) return "Sản phẩm này đã được đánh giá. Bạn có thể kiểm tra lại trong đơn hàng.";
    if (error.status === 400 || error.status === 422) return "Thông tin đánh giá chưa hợp lệ. Vui lòng kiểm tra lại.";
    if ([401, 403, 404].includes(error.status)) return "Chưa thể đánh giá sản phẩm này. Vui lòng quay lại kiểm tra đơn hàng.";
    return "Chưa thể gửi đánh giá. Nội dung của bạn vẫn được giữ lại để thử lại.";
  }
  return error instanceof Error && !(error instanceof TypeError) ? error.message : "Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.";
}
