"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Leaf, RefreshCw } from "lucide-react";
import landing from "../landing/landing.module.css";
import { ProductCarousel } from "../landing/product-carousel";
import { loadRecommendations, recordRecommendationClick, type CustomerRecommendation } from "./recommendation-service";

const vnd = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

/** One shared customer section for the home page and both product-detail presentations. */
export function RecommendationSection({ home = false, excludeProductId, excludeProductName }: { home?: boolean; excludeProductId?: number; excludeProductName?: string }) {
  const titleId = useId();
  const [items, setItems] = useState<CustomerRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const recorded = useRef(new Set<number>());
  useEffect(() => {
    const controller = new AbortController();
    loadRecommendations(AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]))
      .then(result => { if (!controller.signal.aborted) setItems(result); })
      .catch(() => { if (!controller.signal.aborted) setError("Cocoon chưa thể tải gợi ý lúc này. Bạn thử lại sau một chút nhé."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);
  const normalizedName = (name: string) => name.normalize("NFC").trim().toLocaleLowerCase("vi");
  const visible = items.filter(item => item.product.id !== excludeProductId && (!excludeProductName || normalizedName(item.product.name) !== normalizedName(excludeProductName))).slice(0, 4);
  function opened(id: number) {
    if (recorded.current.has(id)) return;
    recorded.current.add(id);
    // Tracking is best effort: a failed analytics request must never block opening a product.
    void recordRecommendationClick(id).catch(() => { recorded.current.delete(id); });
  }
  const href = (item: CustomerRecommendation) => `/account/products/${item.product.id}`;
  const cards = visible.map(item => ({
    name: item.product.name,
    size: item.product.avgRating === null ? "" : `${item.product.avgRating.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}/5 ★`,
    category: item.reasons[0]?.label ?? "Gợi ý cho bạn",
    image: item.product.imageUrl ?? "",
    hoverImage: item.product.imageUrl ?? "",
    price: item.product.minPrice === null ? "" : vnd.format(item.product.minPrice),
    url: href(item),
  }));
  return <section id={home ? "goi-y-cho-ban" : undefined} aria-labelledby={titleId} className={home ? landing.products : "mt-14 border-t border-[#e4ddcd] pt-10 sm:mt-16 sm:pt-12"}>
    <div className={landing.sectionHeading}><div><span className={landing.eyebrow}>Một chút chăm chút dành cho bạn</span><h2 id={titleId}>Có thể bạn sẽ thích</h2></div><Link href="/account/products" className={landing.textLink}>KHÁM PHÁ TẤT CẢ <ArrowRight size={18} /></Link></div>
    {loading ? <div role="status"><p className="mb-4 text-sm text-[#827a67]">Đang chọn những gợi ý dành cho bạn…</p><div aria-hidden="true" className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">{[1, 2, 3, 4].map(key => <div key={key} className="aspect-square bg-[#ebe6db] motion-safe:animate-pulse" />)}</div></div> : error ? <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#e2dac8] bg-[#fffdf7] p-6"><p role="alert" className="text-sm leading-7 text-[#827a67]">{error}</p><button type="button" onClick={() => { setLoading(true); setError(""); setAttempt(value => value + 1); }} className="inline-flex min-h-11 items-center gap-2 px-3 text-sm text-[#806b3f] underline underline-offset-4"><RefreshCw size={14} />Thử lại</button></div> : visible.length ? <ProductCarousel products={cards} trackId="recommendation-track" label="Danh sách sản phẩm gợi ý cho bạn" onOpen={url => { const item = visible.find(entry => href(entry) === url); if (item) opened(item.id); }} /> : <div className="rounded-lg border border-dashed border-[#d9cfb8] px-6 py-10 text-center"><Leaf size={28} strokeWidth={1.2} className="mx-auto text-[#909b79]" /><h3 className="mt-4 font-heading text-2xl text-[#514b3d]">Cùng Cocoon tìm hiểu điều bạn thích</h3><p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-[#827a67]">{excludeProductId ? "Chưa có thêm gợi ý khác lúc này. Bạn có thể cập nhật sở thích hoặc khám phá toàn bộ sản phẩm." : "Thêm sở thích vào hồ sơ để những gợi ý tiếp theo gần hơn với nhu cầu của bạn."}</p><Link href="/account/profile" className="mt-5 inline-flex min-h-11 items-center gap-2 border-b border-[#b89d68] px-1 text-sm text-[#806b3f]">Cập nhật sở thích <ArrowRight size={15} /></Link></div>}
  </section>;
}
