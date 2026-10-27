import { ApiError, apiRequest } from "../../lib/api/client";
import { previewOrders } from "./orders-preview";

export type FeedbackReply = { id: number; staffName: string; content: string; createdAt: string };
export type FeedbackDetail = {
  id: number; rating: number; content: string; createdAt: string;
  status: "New" | "Accepted" | "Assigned" | "Replied" | "Closed";
  orderCode: string; product: { name: string; variant: string; imageUrl: string | null };
  replies: FeedbackReply[];
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
    return { ...reply, staffName: reply.staffName?.trim() || "Nhân viên Cocoon" };
  }).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  return { ...item, status: status!, replies };
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
  return { id, rating: item.review.rating, content: comments[id], createdAt: created, status: id === 4 ? "New" : "Replied", orderCode: order.code,
    product: { name: item.name, variant: item.variant, imageUrl: item.imageUrl },
    replies: id === 4 ? [] : [{ id: id * 10, staffName: "Chăm sóc khách hàng Cocoon", createdAt: new Date(Date.parse(created) + 3600000).toISOString(), content: id === 3 ? "Cocoon cảm ơn bạn đã chia sẻ trải nghiệm. Chúng mình đã ghi nhận góp ý về vòi xịt để cải thiện sản phẩm. Mong tiếp tục được đồng hành cùng bạn!" : "Cocoon cảm ơn bạn đã tin yêu và chia sẻ cảm nhận. Niềm vui của bạn là động lực để chúng mình chăm chút hơn cho từng sản phẩm. Chúc bạn luôn có những trải nghiệm thật dịu lành!" }],
  };
}

export async function loadFeedbackDetail(value: string, preview = false, signal?: AbortSignal): Promise<FeedbackDetail> {
  const id = /^[1-9]\d*$/.test(value) ? Number(value) : NaN;
  if (!validId(id)) throw new Error("Mã phản hồi không hợp lệ.");
  if (preview) return previewFeedback(id);
  return parseFeedbackDetail(await apiRequest<unknown>(`/me/feedback/${id}`, { signal }), id);
}

export function feedbackDetailError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 501) return "Chi tiết phản hồi hiện chưa khả dụng. Vui lòng quay lại sau.";
    if (error.status === 404) return "Không tìm thấy phản hồi này.";
    if (error.status === 403) return "Bạn không có quyền xem phản hồi này.";
    return "Chưa thể tải phản hồi. Vui lòng thử lại.";
  }
  return error instanceof Error && !(error instanceof TypeError) && !["AbortError", "TimeoutError"].includes(error.name) ? error.message : "Kết nối bị gián đoạn. Vui lòng thử lại.";
}
