"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, LoaderCircle, MessageSquare, ShoppingBag } from "lucide-react";
import { FeedbackThread } from "../../components/brand/feedback-thread";
import { StatusBadge } from "../../components/brand/status-badge";
import { feedbackDetailError, loadFeedbackDetail, type FeedbackDetail } from "./feedback-detail-service";

export function FeedbackDetailPage({ id, preview = false }: { id: string; preview?: boolean }) {
  const [detail, setDetail] = useState<FeedbackDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    loadFeedbackDetail(id, preview, AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]))
      .then(value => { if (!controller.signal.aborted) setDetail(value); })
      .catch(reason => { if (!controller.signal.aborted) setError(feedbackDetailError(reason)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, preview, attempt]);
  return <div className="pb-8 text-[#302b23]">
    <Link href={`/account/orders?tab=reviewed${preview ? "&preview=1" : ""}`} className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm text-[#806439] hover:underline"><ArrowLeft size={17} />Quay lại đơn hàng đã đánh giá</Link>
    <header className="mb-8"><p className="font-label text-sm uppercase tracking-widest text-[#977c4d]">Cocoon lắng nghe bạn</p><h1 className="mt-3 font-heading text-4xl sm:text-5xl">Chi tiết phản hồi</h1><p className="mt-3 text-sm leading-7 text-[#887c68]">Cảm nhận của bạn và những lời hồi đáp từ Cocoon, trong cùng một cuộc trò chuyện.</p></header>
    {preview && <aside className="mb-6 rounded border border-[#dcc9a5] bg-[#eee7d5] p-4 text-sm leading-6 text-[#7e6946]"><strong>Giao diện mẫu</strong> · Đánh giá và câu trả lời dưới đây chỉ để minh họa, không phải phản hồi thực tế của bạn.</aside>}
    {loading ? <p role="status" className="flex min-h-48 items-center justify-center gap-3 text-[#81745e]"><LoaderCircle className="motion-safe:animate-spin" size={20} />Đang tải phản hồi…</p> : error ? <div className="grid justify-items-center gap-4 rounded border border-dashed border-[#d7c9af] p-8 text-center"><MessageSquare size={32} className="text-[#977c4d]" /><h2 className="font-heading text-2xl">Chưa thể hiển thị phản hồi</h2><p role="alert" className="text-sm text-[#81745e]">{error}</p><button type="button" onClick={() => { setError(""); setLoading(true); setAttempt(value => value + 1); }} className="min-h-11 border border-[#a18b66] px-6 py-3 text-sm">Thử lại</button></div> : detail && <div className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="min-w-0 rounded border border-[#e4dbc9] bg-[#fffcf7] p-6">
        <div className="mb-6 grid aspect-square place-items-center bg-[#f1ecdf] text-[#b4a58a]">{detail.product.imageUrl && failedImage !== detail.product.imageUrl ? (
          // API media hosts are not known yet; use a native image with a fallback.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={detail.product.imageUrl} alt={detail.product.name} width={240} height={240} className="h-full w-full object-contain" onError={() => setFailedImage(detail.product.imageUrl)} />
        ) : <ShoppingBag size={40} aria-label="Chưa có ảnh sản phẩm" />}</div>
        <p className="text-xs uppercase tracking-wide text-[#977c4d]">Sản phẩm đã đánh giá</p><h2 className="mt-3 break-words font-heading text-2xl">{detail.product.name}</h2><p className="mt-2 text-sm text-[#887c68]">{detail.product.variant}</p>
        <dl className="my-6 grid gap-3 border-t border-[#e4dbc9] pt-6 text-sm"><div className="flex flex-wrap justify-between gap-2"><dt className="text-[#887c68]">Đơn hàng</dt><dd>{detail.orderCode || "—"}</dd></div><div className="flex justify-between gap-2"><dt className="text-[#887c68]">Mã phản hồi</dt><dd>#{detail.id}</dd></div></dl><StatusBadge kind="feedback" status={detail.status} />
      </aside>
      <FeedbackThread rating={detail.rating} content={detail.content} createdAt={detail.createdAt} replies={detail.replies} />
    </div>}
  </div>;
}
