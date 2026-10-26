import type { CustomerOrder, OrderItem } from "./orders-service";
import { products } from "../landing/products";

function item(index: number, id: number, quantity: number, rating?: number): OrderItem {
  const product = products[index];
  return { id, name: product.name, variant: product.size, imageUrl: product.image, productSlug: product.url.split("/").at(-1), quantity, unitPrice: Number(product.price.replace(/\D/g, "")), review: rating ? { id, rating } : null };
}

/** Illustration only: these IDs must never be submitted to any API. */
export const previewOrders: CustomerOrder[] = [
  { id: 1, code: "MINH-HOA-001", orderedAt: "2026-10-20T09:00:00+07:00", status: "Completed", totalAmount: 748000, items: [item(0, 1, 1), item(3, 2, 1, 5)] },
  { id: 2, code: "MINH-HOA-002", orderedAt: "2026-10-12T10:00:00+07:00", status: "Completed", totalAmount: 590000, items: [item(1, 3, 2, 4), item(4, 4, 2, 5)] },
  { id: 3, code: "MINH-HOA-003", orderedAt: "2026-10-05T15:00:00+07:00", status: "Completed", totalAmount: 339000, items: [item(2, 5, 1)] },
];
