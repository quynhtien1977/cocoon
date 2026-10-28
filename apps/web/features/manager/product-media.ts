// Exact-name references only; numeric catalog IDs are never mapped to sample IDs.
const photos: Record<string, string> = {
  "gel rửa mặt bí đao": "/images/manager-products/winter-melon.jpg",
  "gel bí đao rửa mặt": "/images/manager-products/winter-melon.jpg",
  "nước sen hậu giang": "/images/manager-products/lotus.jpg",
  "cà phê đắk lắk làm sạch da chết mặt": "/images/manager-products/coffee.jpg",
  "nước dưỡng tóc tinh dầu bưởi": "/images/landing/product-1.jpg",
  "thạch hoa hồng dưỡng ẩm": "/images/manager-products/rose.jpg",
  "bơ dưỡng thể cà phê đắk lắk": "/images/manager-products/coffee-body.png",
  "son dưỡng dầu dừa bến tre": "/images/manager-products/coconut.jpg",
  "son dưỡng dầu dừa": "/images/manager-products/coconut.jpg",
};
export function safeProductImage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (/^\/(?!\/)/.test(value)) return value;
  try { const url = new URL(value); if (["https:", "http:"].includes(url.protocol) && !url.username && !url.password) return url.href; } catch { /* invalid URL */ }
  return null;
}
export function resolveProductImage(name: string, image: unknown): string | null {
  return safeProductImage(image) ?? photos[name.trim().normalize("NFC").toLocaleLowerCase("vi")] ?? null;
}
