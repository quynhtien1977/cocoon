import { apiRequest } from "@/lib/api/client";

export type ShopVariant = {
  id: number;
  name: string;
  price: number;
  imageUrl: string | null;
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

export async function loadShopProducts(params: ShopQuery = {}, signal?: AbortSignal): Promise<ShopProductsResponse> {
  const query = new URLSearchParams();
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.categoryId && params.categoryId > 0) query.set("categoryId", String(params.categoryId));
  if (params.page && params.page > 0) query.set("page", String(params.page));
  if (params.pageSize && params.pageSize > 0) query.set("pageSize", String(params.pageSize));
  const qs = query.toString();
  return await apiRequest<ShopProductsResponse>(`/shop/products${qs ? `?${qs}` : ""}`, { signal });
}

export async function loadShopCategories(signal?: AbortSignal): Promise<ShopCategory[]> {
  return await apiRequest<ShopCategory[]>("/shop/categories", { signal });
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
