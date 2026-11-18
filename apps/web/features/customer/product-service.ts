import { apiRequest } from "../../lib/api/client";

export type ApiProductVariant = {
  id: number;
  name: string;
  price: number;
  imageUrl: string | null;
  /** Detail gallery, main photo first; empty when the variant has no usable photo. */
  images: string[];
};

export type ApiProduct = {
  id: number;
  name: string;
  description: string;
  ingredients: string;
  benefits: string;
  usage: string;
  categoryName: string;
  status: "Active" | "Upcoming" | "Inactive";
  variants: ApiProductVariant[];
  averageRating?: number | null;
  feedbackCount?: number;
};

export function productId(value: string): number | null {
  return /^[1-9]\d*$/.test(value) && Number(value) <= 2147483647 ? Number(value) : null;
}

const statusValues = ["Active", "Upcoming", "Inactive"] as const;

const usableImage = (value: unknown): string | null =>
  typeof value === "string" && /^(https?:\/\/|\/(?!\/)|data:image\/(?:png|jpeg|webp|svg\+xml);base64,)/i.test(value) ? value : null;

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
    const imageUrl = usableImage(variant.imageUrl);
    const variantId = typeof variant.id === "number" && Number.isSafeInteger(variant.id) && variant.id > 0 ? variant.id : 0;
    // Older API builds have no `images`; fall back to the main photo. Unusable URLs are dropped, not rejected.
    const gallery = Array.isArray(variant.images) ? variant.images.map(usableImage).filter((url): url is string => url !== null) : [];
    const images = [...new Set(gallery.length ? gallery : imageUrl ? [imageUrl] : [])];
    return { id: variantId, name: variant.name, price: variant.price, imageUrl, images };
  });

  const rawStatus = row.status;
  const status: "Active" | "Upcoming" | "Inactive" =
    typeof rawStatus === "number" && rawStatus >= 0 && rawStatus < statusValues.length
      ? statusValues[rawStatus]
      : typeof rawStatus === "string" && (statusValues as readonly string[]).includes(rawStatus)
      ? (rawStatus as "Active" | "Upcoming" | "Inactive")
      : "Active";

  const averageRating =
    typeof row.averageRating === "number" && Number.isFinite(row.averageRating)
      ? Math.round(row.averageRating * 10) / 10
      : null;
  const feedbackCount =
    typeof row.feedbackCount === "number" && Number.isSafeInteger(row.feedbackCount) && row.feedbackCount >= 0
      ? row.feedbackCount
      : 0;

  return {
    id,
    name: row.name,
    description: text("description"),
    ingredients: text("ingredients"),
    benefits: text("benefits"),
    usage: text("usage"),
    categoryName: text("categoryName"),
    status,
    variants,
    averageRating,
    feedbackCount,
  };
}

export type ProductRatingCount = { rating: number; count: number };

export type ProductInsights = {
  totalFeedback: number;
  averageRating: number | null;
  ratingDistribution: ProductRatingCount[];
};

export type ProductReviewFollowUp = {
  content: string;
  createdAt: string;
};

export type ProductReviewReplyItem = {
  id: number;
  staffName: string;
  content: string;
  createdAt: string;
  round: number;
};

export type ProductReviewItem = {
  id: number;
  customerName: string;
  rating: number;
  content: string;
  createdAt: string;
  variantName: string | null;
  followUp: ProductReviewFollowUp | null;
  replies: ProductReviewReplyItem[];
  originalRating?: number | null;
  contentEditedAt?: string | null;
};

export type ProductReviewsResult = {
  items: ProductReviewItem[];
  totalCount: number;
  page: number;
  pageSize: number;
};

export async function loadProductInsights(id: number, signal?: AbortSignal): Promise<ProductInsights> {
  const data = await apiRequest<ProductInsights>(`/products/${id}/insights`, { signal });
  if (
    !data ||
    !Number.isSafeInteger(data.totalFeedback) ||
    data.totalFeedback < 0 ||
    !(data.averageRating === null || (typeof data.averageRating === "number" && data.averageRating >= 1 && data.averageRating <= 5)) ||
    !Array.isArray(data.ratingDistribution)
  ) {
    throw new Error("Dữ liệu phân tích đánh giá chưa hợp lệ.");
  }
  return data;
}

export async function loadProductReviews(
  id: number,
  options?: { rating?: number; page?: number; pageSize?: number },
  signal?: AbortSignal
): Promise<ProductReviewsResult> {
  const params = new URLSearchParams();
  if (options?.rating) params.set("rating", String(options.rating));
  if (options?.page) params.set("page", String(options.page));
  if (options?.pageSize) params.set("pageSize", String(options.pageSize));
  const query = params.toString() ? `?${params.toString()}` : "";

  const data = await apiRequest<{
    items?: unknown[];
    totalCount?: unknown;
    page?: unknown;
    pageSize?: unknown;
  }>(`/products/${id}/reviews${query}`, { signal });

  const rawItems = Array.isArray(data?.items) ? data.items : [];
  const items: ProductReviewItem[] = rawItems
    .filter((item): item is Record<string, unknown> => item != null && typeof item === "object")
    .map((item) => {
      const rawReplies = Array.isArray(item.replies) ? item.replies : [];
      const replies: ProductReviewReplyItem[] = rawReplies
        .filter((r): r is Record<string, unknown> => r != null && typeof r === "object")
        .map((r) => ({
          id: typeof r.id === "number" ? r.id : 0,
          staffName:
            typeof r.staffName === "string" && r.staffName.trim()
              ? r.staffName.trim()
              : "Nhân viên Cocoon",
          content: typeof r.content === "string" ? r.content : "",
          createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString(),
          round: typeof r.round === "number" ? r.round : 1,
        }));

      const rawFollowUp =
        item.followUp && typeof item.followUp === "object"
          ? (item.followUp as Record<string, unknown>)
          : null;
      const followUp: ProductReviewFollowUp | null =
        rawFollowUp && typeof rawFollowUp.content === "string" && rawFollowUp.content.trim()
          ? {
              content: rawFollowUp.content.trim(),
              createdAt:
                typeof rawFollowUp.createdAt === "string"
                  ? rawFollowUp.createdAt
                  : new Date().toISOString(),
            }
          : null;

      return {
        id: typeof item.id === "number" ? item.id : 0,
        customerName:
          typeof item.customerName === "string" && item.customerName.trim()
            ? item.customerName.trim()
            : "Khách hàng",
        rating: typeof item.rating === "number" ? Math.max(1, Math.min(5, item.rating)) : 5,
        content: typeof item.content === "string" ? item.content : "",
        createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
        variantName: typeof item.variantName === "string" ? item.variantName : null,
        followUp,
        replies,
        originalRating: typeof item.originalRating === "number" ? item.originalRating : null,
        contentEditedAt: typeof item.contentEditedAt === "string" ? item.contentEditedAt : null,
      };
    });

  return {
    items,
    totalCount: typeof data?.totalCount === "number" ? data.totalCount : items.length,
    page: typeof data?.page === "number" ? data.page : 1,
    pageSize: typeof data?.pageSize === "number" ? data.pageSize : 10,
  };
}
