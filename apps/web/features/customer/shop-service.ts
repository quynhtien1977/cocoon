import { apiRequest } from "@/lib/api/client";

export type ShopVariant = {
  id: number;
  name: string;
  price: number;
  imageUrl: string | null;
  /** Photo the card fades to on hover; null when the variant has a single photo. */
  hoverImageUrl: string | null;
  /** Detail gallery, main photo first. */
  images: string[];
};

export type ShopProduct = {
  id: number;
  name: string;
  categoryId: number;
  categoryName: string;
  minPrice: number;
  imageUrl: string | null;
  averageRating: number | null;
  feedbackCount: number;
  variants: ShopVariant[];
  /** Hover photo of the variant whose photo is imageUrl; null when there is none. */
  hoverImageUrl: string | null;
};

export type ShopCategory = {
  id: number;
  name: string;
};

export type ShopProductsResponse = {
  items: ShopProduct[];
  totalCount: number;
  page: number;
  pageSize: number;
};

export interface ShopQuery {
  search?: string;
  categoryId?: number | null;
  page?: number;
  pageSize?: number;
}

export interface ShopRequestOptions {
  redirectOnUnauthorized?: boolean;
  refresh?: boolean;
}

export async function loadShopProducts(
  params: ShopQuery = {},
  signal?: AbortSignal,
  options?: ShopRequestOptions
): Promise<ShopProductsResponse> {
  const query = new URLSearchParams();
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.categoryId && params.categoryId > 0) query.set("categoryId", String(params.categoryId));
  if (params.page && params.page > 0) query.set("page", String(params.page));
  if (params.pageSize && params.pageSize > 0) query.set("pageSize", String(params.pageSize));
  const qs = query.toString();
  const requestOptions: { signal?: AbortSignal; redirectOnUnauthorized?: boolean; refresh?: boolean } = { signal };
  if (options?.redirectOnUnauthorized !== undefined) {
    requestOptions.redirectOnUnauthorized = options.redirectOnUnauthorized;
  }
  if (options?.refresh !== undefined) {
    requestOptions.refresh = options.refresh;
  }
  return await apiRequest<ShopProductsResponse>(`/shop/products${qs ? `?${qs}` : ""}`, requestOptions);
}

export async function loadShopCategories(
  signal?: AbortSignal,
  options?: ShopRequestOptions
): Promise<ShopCategory[]> {
  const requestOptions: { signal?: AbortSignal; redirectOnUnauthorized?: boolean; refresh?: boolean } = { signal };
  if (options?.redirectOnUnauthorized !== undefined) {
    requestOptions.redirectOnUnauthorized = options.redirectOnUnauthorized;
  }
  if (options?.refresh !== undefined) {
    requestOptions.refresh = options.refresh;
  }
  return await apiRequest<ShopCategory[]>("/shop/categories", requestOptions);
}

const vndCurrency = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

export function toCarouselProduct(product: ShopProduct) {
  const image = product.imageUrl ?? product.variants.find((v) => v.imageUrl)?.imageUrl ?? "";
  // Empty when the product has a single photo, so the card keeps its photo instead of fading to the same one.
  const hoverImage = product.hoverImageUrl && product.hoverImageUrl !== image ? product.hoverImageUrl : "";
  const variantNames = product.variants.map((v) => v.name).filter(Boolean).join(" · ");
  const ratingText =
    product.averageRating !== null && product.feedbackCount > 0
      ? `★ ${product.averageRating.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} (${product.feedbackCount})`
      : "";
  const size = [variantNames, ratingText].filter(Boolean).join(" · ");

  return {
    name: product.name,
    category: product.categoryName || "Cocoon",
    size,
    image,
    hoverImage,
    price: Number.isFinite(product.minPrice) && product.minPrice > 0 ? vndCurrency.format(product.minPrice) : "Giá đang cập nhật",
    url: `/account/products/${product.id}`,
  };
}

export interface PlaceOrderItemInput {
  variantId: number;
  quantity: number;
}

export interface PlaceOrderInput {
  items: PlaceOrderItemInput[];
  shippingAddress: string;
}

export interface OrderPlacedResult {
  id: number;
  code: string;
  totalAmount: number;
}

export async function placeOrder(input: PlaceOrderInput): Promise<OrderPlacedResult> {
  return await apiRequest<OrderPlacedResult>("/me/orders", {
    method: "POST",
    json: input,
  });
}
