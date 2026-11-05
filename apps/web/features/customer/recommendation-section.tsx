"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Leaf, RefreshCw } from "lucide-react";
import { ProductCard } from "../../components/brand/product-card";
import { ReasonChip } from "../../components/brand/reason-chip";
import { loadRecommendations, recordRecommendationClick, type CustomerRecommendation } from "./recommendation-service";

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
  return <section id={home ? "goi-y-cho-ban" : undefined} aria-labelledby={titleId} className={home ? "border-y border-[#e8e0cf] bg-[#f5f2e9] px-6 py-14 sm:px-8 lg:px-[6%] lg:py-20" : "mt-14 border-t border-[#e4ddcd] pt-10 sm:mt-16 sm:pt-12"}>
    <div className="mx-auto max-w-[1440px]">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-3 flex items-center gap-2 font-label text-xs uppercase tracking-[0.18em] text-[#867045]"><Leaf size={14} strokeWidth={1.4} />Một chút chăm chút dành cho bạn</p><h2 id={titleId} className="font-heading text-[32px] font-normal leading-tight text-[#383428] sm:text-[40px]">Có thể bạn sẽ thích</h2><p className="mt-3 max-w-xl text-sm leading-7 text-[#827a67]">Những lựa chọn từ Cocoon, gợi ý theo sở thích và trải nghiệm của riêng bạn.</p></div><Link href="/account/products" className="inline-flex min-h-11 items-center gap-2 font-label text-sm uppercase tracking-wider text-[#806b3f] underline-offset-4 hover:underline">Khám phá tất cả <ArrowRight size={16} /></Link></header>
      {loading ? <div role="status"><p className="mb-4 text-sm text-[#827a67]">Đang chọn những gợi ý dành cho bạn…</p><div aria-hidden="true" className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">{[1, 2, 3, 4].map(key => <div key={key} className="aspect-[3/4] rounded-lg bg-[#e9e5da] motion-safe:animate-pulse" />)}</div></div> : error ? <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#e2dac8] bg-[#fffdf7] p-6"><p role="alert" className="text-sm leading-7 text-[#827a67]">{error}</p><button type="button" onClick={() => { setLoading(true); setError(""); setAttempt(value => value + 1); }} className="inline-flex min-h-11 items-center gap-2 px-3 text-sm text-[#806b3f] underline underline-offset-4"><RefreshCw size={14} />Thử lại</button></div> : visible.length ? <div className="grid grid-cols-2 items-stretch gap-4 lg:grid-cols-4 lg:gap-6">{visible.map(item => <ProductCard key={item.id} name={item.product.name} href={`/account/products/${item.product.id}`} imageUrl={item.product.imageUrl} minPrice={item.product.minPrice} avgRating={item.product.avgRating} onOpen={() => opened(item.id)} reason={item.reasons.map((reason, index) => <ReasonChip key={`${reason.code}:${index}`} className="bg-[#eeeadc] text-[#7c6b46]">{reason.label}</ReasonChip>)} className="border-[#e6e0d3] bg-[#fffdf8] shadow-none transition-[border-color,box-shadow] duration-300 hover:border-[#c9b78f] hover:shadow-[0_8px_24px_#51442508] motion-reduce:transition-none" />)}</div> : <div className="rounded-lg border border-dashed border-[#d9cfb8] px-6 py-10 text-center"><Leaf size={28} strokeWidth={1.2} className="mx-auto text-[#909b79]" /><h3 className="mt-4 font-heading text-2xl text-[#514b3d]">Cùng Cocoon tìm hiểu điều bạn thích</h3><p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-[#827a67]">{excludeProductId ? "Chưa có thêm gợi ý khác lúc này. Bạn có thể cập nhật sở thích hoặc khám phá toàn bộ sản phẩm." : "Thêm sở thích vào hồ sơ để những gợi ý tiếp theo gần hơn với nhu cầu của bạn."}</p><Link href="/account/profile" className="mt-5 inline-flex min-h-11 items-center gap-2 border-b border-[#b89d68] px-1 text-sm text-[#806b3f]">Cập nhật sở thích <ArrowRight size={15} /></Link></div>}
    </div>
  </section>;
}
