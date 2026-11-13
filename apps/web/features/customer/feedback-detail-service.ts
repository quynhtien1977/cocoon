import { ApiError, apiRequest } from "../../lib/api/client";
import { previewOrders } from "./orders-preview";

export type FeedbackReply = { id: number; staffName: string; content: string; createdAt: string; round?: number };
export type FeedbackFollowUp = { content: string; createdAt: string };
export type FeedbackEdits = { originalRating: number | null; ratingEditedAt: string | null; contentEditedAt: string | null };
export type FeedbackDetail = {
  id: number; rating: number; content: string; createdAt: string;
  status: "New" | "Accepted" | "Assigned" | "Replied" | "Closed";
  orderCode: string; product: { name: string; variant: string; imageUrl: string | null };
  replies: FeedbackReply[];
  followUp: FeedbackFollowUp | null;
  autoCloseAt: string | null;
  canFollowUp: boolean;
  edits?: FeedbackEdits;
  canEditRating?: boolean;
  ratingEditableUntil?: string | null;
  canEditContent?: boolean;
  canClose?: boolean;
};
const statuses = ["New", "Accepted", "Assigned", "Replied", "Closed"] as const;
const validId = (id: unknown): id is number => typeof id === "number" && Number.isInteger(id) && id > 0 && id <= 2147483647;
const validDate = (date: unknown): date is string => typeof date === "string" && Number.isFinite(Date.parse(date));
const nonempty = (value: unknown): value is string => typeof value === "string" && !!value.trim();

// Endpoint exists, but its enriched response DTO is not implemented yet.
// Reject an incomplete reply collection rather than claiming staff have not replied.
export function parseFeedbackDetail(response: unknown, expectedId: number): FeedbackDetail {
  const item = response as FeedbackDetail | null;
  const status = typeof item?.status === "number" ? statuses[item.status] : item?.status;
  if (!item || item.id !== expectedId || !validId(item.id) || !Number.isInteger(item.rating) || item.rating < 1 || item.rating > 5 || !nonempty(item.content) || !validDate(item.createdAt) || !statuses.includes(status!) || typeof item.orderCode !== "string" || !item.product || !nonempty(item.product.name) || typeof item.product.variant !== "string" || !(item.product.imageUrl === null || typeof item.product.imageUrl === "string") || !Array.isArray(item.replies)) throw new Error("Thông tin phản hồi chưa đầy đủ. Vui lòng thử lại sau.");
  const ids = new Set<number>();
  const replies = item.replies.map(reply => {
    if (!reply || !validId(reply.id) || ids.has(reply.id) || !nonempty(reply.content) || !validDate(reply.createdAt) || !(reply.staffName == null || typeof reply.staffName === "string")) throw new Error("Chưa đọc được phần trả lời từ Cocoon.");
    ids.add(reply.id);
    return { ...reply, staffName: reply.staffName?.trim() || "Nhân viên Cocoon", round: typeof reply.round === "number" ? reply.round : 1 };
  }).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

  let followUp: FeedbackFollowUp | null = null;
  if (item.followUp && typeof item.followUp === "object") {
    if (nonempty(item.followUp.content) && validDate(item.followUp.createdAt)) {
      followUp = { content: item.followUp.content.trim(), createdAt: item.followUp.createdAt };
    }
  }

  const autoCloseAt = typeof item.autoCloseAt === "string" && validDate(item.autoCloseAt) ? item.autoCloseAt : null;
  const canFollowUp = Boolean(item.canFollowUp);

  let edits: FeedbackEdits = { originalRating: null, ratingEditedAt: null, contentEditedAt: null };
  if (item.edits && typeof item.edits === "object") {
    edits = {
      originalRating: typeof item.edits.originalRating === "number" && Number.isInteger(item.edits.originalRating) && item.edits.originalRating >= 1 && item.edits.originalRating <= 5 ? item.edits.originalRating : null,
      ratingEditedAt: typeof item.edits.ratingEditedAt === "string" && validDate(item.edits.ratingEditedAt) ? item.edits.ratingEditedAt : null,
      contentEditedAt: typeof item.edits.contentEditedAt === "string" && validDate(item.edits.contentEditedAt) ? item.edits.contentEditedAt : null,
    };
  }
  const canEditRating = Boolean(item.canEditRating);
  const ratingEditableUntil = typeof item.ratingEditableUntil === "string" && validDate(item.ratingEditableUntil) ? item.ratingEditableUntil : null;
  const canEditContent = Boolean(item.canEditContent);
  const canClose = Boolean(item.canClose);

  return { ...item, status: status!, replies, followUp, autoCloseAt, canFollowUp, edits, canEditRating, ratingEditableUntil, canEditContent, canClose };
}

function previewFeedback(id: number): FeedbackDetail {
  const order = previewOrders.find(order => order.items.some(item => item.review?.id === id));
  const item = order?.items.find(item => item.review?.id === id);
  if (!order || !item?.review) throw new Error("Không tìm thấy phản hồi minh họa này.");
  const comments: Record<number, string> = {
    2: "Nước tẩy trang làm sạch nhẹ nhàng, không gây khô căng. Mình rất thích cảm giác dễ chịu sau khi sử dụng và sẽ tiếp tục ủng hộ Cocoon.",
    3: "Mùi bưởi dễ chịu, tóc cảm giác mềm hơn sau khi dùng. Mình mong vòi xịt có thể phun đều hơn một chút.",
    4: "Hương cà phê rất dễ chịu, da mềm mịn sau khi sử dụng. Bao bì đẹp và dễ dùng, mình rất hài lòng!",
  };
  const created = new Date(Date.parse(order.orderedAt) + 4 * 86400000).toISOString();
  const autoClose = id === 2 ? new Date(Date.now() + 6 * 86400000).toISOString() : null;
  const sampleFollowUp = id === 3 ? { content: "Cho mình hỏi thêm sản phẩm này có thể kết hợp với serum cấp ẩm phục hồi da không ạ?", createdAt: new Date(Date.parse(created) + 24 * 3600000).toISOString() } : null;
  return { id, rating: item.review.rating, content: comments[id], createdAt: created, status: id === 4 ? "New" : id === 3 ? "Assigned" : "Replied", orderCode: order.code,
    product: { name: item.name, variant: item.variant, imageUrl: item.imageUrl },
    replies: id === 4 ? [] : [{ id: id * 10, staffName: "Chăm sóc khách hàng Cocoon", createdAt: new Date(Date.parse(created) + 3600000).toISOString(), content: id === 3 ? "Cocoon cảm ơn bạn đã chia sẻ trải nghiệm. Chúng mình đã ghi nhận góp ý về vòi xịt để cải thiện sản phẩm. Mong tiếp tục được đồng hành cùng bạn!" : "Cocoon cảm ơn bạn đã tin yêu và chia sẻ cảm nhận. Niềm vui của bạn là động lực để chúng mình chăm chút hơn cho từng sản phẩm. Chúc bạn luôn có những trải nghiệm thật dịu lành!", round: 1 }],
    followUp: sampleFollowUp,
    autoCloseAt: autoClose,
    canFollowUp: id === 2,
    edits: {
      originalRating: id === 3 ? 4 : null,
      ratingEditedAt: id === 3 ? created : null,
      contentEditedAt: id === 2 ? created : null,
    },
    canEditRating: id === 4 || id === 2,
    ratingEditableUntil: new Date(Date.now() + 25 * 86400000).toISOString(),
    canEditContent: id === 4,
    canClose: id !== 4,
  };
}

export async function loadFeedbackDetail(value: string, preview = false, signal?: AbortSignal): Promise<FeedbackDetail> {
  const id = /^[1-9]\d*$/.test(value) ? Number(value) : NaN;
  if (!validId(id)) throw new Error("Mã phản hồi không hợp lệ.");
  if (preview) return previewFeedback(id);
  return parseFeedbackDetail(await apiRequest<unknown>(`/me/feedback/${id}`, { signal }), id);
}

export async function sendFollowUp(id: number, content: string): Promise<void> {
  await apiRequest<void>(`/me/feedback/${id}/follow-up`, { method: "POST", json: { content } });
}

export async function editFeedback(id: number, rating: number, content: string): Promise<void> {
  await apiRequest<void>(`/me/feedback/${id}`, { method: "PUT", json: { rating, content } });
}

export async function closeFeedback(id: number): Promise<void> {
  await apiRequest<void>(`/me/feedback/${id}/close`, { method: "POST" });
}

export function editFeedbackError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.message) return error.message;
    if (error.status === 400) return "Nội dung phản hồi cần từ 20 đến 1.000 ký tự.";
    if (error.status === 404) return "Không tìm thấy phản hồi này.";
    if (error.status === 409) return "Không thể chỉnh sửa đánh giá vào lúc này.";
  }
  return error instanceof Error && error.message ? error.message : "Chưa lưu được đánh giá. Vui lòng thử lại.";
}

export function closeFeedbackError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.message) return error.message;
    if (error.status === 404) return "Không tìm thấy phản hồi này.";
    if (error.status === 409) return "Phản hồi đã đóng.";
  }
  return error instanceof Error && error.message ? error.message : "Chưa đóng được phản hồi. Vui lòng thử lại.";
}

export function followUpError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.message) return error.message;
    if (error.status === 400) return "Nội dung ý kiến cần từ 20 đến 1.000 ký tự.";
    if (error.status === 409) return "Không thể gửi thêm ý kiến vào lúc này.";
    if (error.status === 404) return "Không tìm thấy phản hồi này.";
  }
  return error instanceof Error && error.message ? error.message : "Chưa gửi được ý kiến. Vui lòng thử lại.";
}

export function feedbackDetailError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 501) return "Chi tiết phản hồi hiện chưa khả dụng. Vui lòng quay lại sau.";
    if (error.status === 404) return "Không tìm thấy phản hồi này.";
    if (error.status === 403) return "Bạn không có quyền xem phản hồi này.";
    return "Chưa tải được phản hồi. Kiểm tra kết nối rồi thử lại.";
  }
  return error instanceof Error && !(error instanceof TypeError) && !["AbortError", "TimeoutError"].includes(error.name) ? error.message : "Kết nối bị gián đoạn. Vui lòng thử lại.";
}
