"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Leaf, MessageSquare, ShoppingBag } from "lucide-react";
import { RatingInput } from "@/components/brand/rating-input";
import { RatingStars } from "@/components/brand/rating-stars";
import { previewOrders } from "./orders-preview";
import { getReviewableItems, parseOrderItemId, reviewErrorMessage, submitReview, validateReview, type ReviewableItem } from "./review-service";
import styles from "./product-review.module.css";
import { ReviewPhotoGallery, ReviewPhotoPicker, useReviewPhotos } from "./review-photos";

const demoItems: ReviewableItem[] = previewOrders.flatMap((order) => order.items.filter((item) => !item.review).map((item) => ({ orderItemId: item.id, name: item.name, variant: item.variant, imageUrl: item.imageUrl, orderCode: order.code })));
const sentiments = ["Chọn mức độ hài lòng của bạn", "Rất không hài lòng", "Chưa hài lòng", "Bình thường", "Hài lòng", "Rất hài lòng"];

function ReviewedProduct({ item }: { item: ReviewableItem }) {
  const [failed, setFailed] = useState(false);
  return <aside className={styles.product}><div className={styles.image}>{item.imageUrl && !failed ? <Image src={item.imageUrl} alt={item.name} width={360} height={360} unoptimized onError={() => setFailed(true)} /> : <ShoppingBag size={48} aria-label="Chưa có ảnh sản phẩm" />}</div><div className={styles.productInfo}><span>Sản phẩm bạn đánh giá</span><h2>{item.name}</h2><p>{item.variant}</p><p className={styles.orderCode}>Đơn #{item.orderCode}</p><div className={styles.thanks}><Leaf size={20} /><p>Mỗi chia sẻ giúp Cocoon lắng nghe và chăm sóc bạn tốt hơn.</p></div></div></aside>;
}

export function ProductReview({ orderItemParam, preview = false, previewItem }: { orderItemParam?: string; preview?: boolean; previewItem?: string }) {
  const requestedId = parseOrderItemId(preview ? previewItem : orderItemParam);
  const invalidId = !preview && orderItemParam !== undefined && requestedId === null;
  const [items, setItems] = useState<ReviewableItem[]>(preview ? demoItems : []);
  const [selectedId, setSelectedId] = useState<number | null>(requestedId ?? (preview ? demoItems[0].orderItemId : null));
  const [loading, setLoading] = useState(!preview && !invalidId);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [rating, setRating] = useState<number | null>(null);
  const [content, setContent] = useState("");
  const [errors, setErrors] = useState({ rating: "", content: "" });
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const photoState = useReviewPhotos();
  const busy = useRef(false);
  const active = useRef(true);
  const form = useRef<HTMLFormElement>(null);
  const successHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => { if (success) successHeading.current?.focus(); }, [success]);
  useEffect(() => {
    if (preview || invalidId) return;
    const controller = new AbortController();
    getReviewableItems(AbortSignal.any([controller.signal, AbortSignal.timeout(12000)])).then((data) => {
      if (controller.signal.aborted) return;
      setItems(data);
      if (requestedId === null) setSelectedId(data[0]?.orderItemId ?? null);
    }).catch((error: unknown) => { if (!controller.signal.aborted) setLoadError(reviewErrorMessage(error)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt, preview, invalidId, requestedId]);
  const item = items.find((item) => item.orderItemId === selectedId);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy.current || photoState.loading || success || !item) return;
    const next = validateReview({ rating, content });
    setErrors(next); setMessage("");
    if (next.rating || next.content) {
      form.current?.querySelector<HTMLElement>(next.rating ? '[role="radio"]' : 'textarea')?.focus();
      return;
    }
    if (preview) { setSuccess(true); return; }
    if (photoState.photos.length) { setMessage("Chưa thể gửi ảnh kèm đánh giá. Vui lòng bỏ ảnh để gửi nhận xét bằng văn bản, hoặc quay lại khi tính năng gửi ảnh khả dụng."); return; }
    busy.current = true; setPending(true);
    try {
      await submitReview(item.orderItemId, { rating, content });
      if (active.current) setSuccess(true);
    } catch (error) { if (active.current) setMessage(reviewErrorMessage(error)); }
    finally { busy.current = false; if (active.current) setPending(false); }
  };

  return <div className={styles.page}>
    <Link href="/account/orders" className={styles.back}><ArrowLeft size={17} />Quay lại đơn hàng</Link>
    <header className={styles.heading}><p>Trải nghiệm của bạn, cảm hứng của Cocoon</p><h1>Đánh giá sản phẩm</h1><span>Chia sẻ cảm nhận sau khi sử dụng để cùng Cocoon chăm sóc vẻ đẹp thuần Việt.</span></header>
    {preview && <div className={styles.notice}><strong>Chế độ xem thử</strong> · Đây là sản phẩm minh họa. Nội dung bạn nhập không được gửi hoặc lưu vào tài khoản.</div>}
    {loading ? <div className={styles.state} role="status">Đang tải sản phẩm có thể đánh giá…</div> : loadError || invalidId || !item ? <div className={styles.state}><MessageSquare size={36} /><h2>{invalidId ? "Liên kết sản phẩm không hợp lệ" : loadError ? "Chưa thể mở đánh giá" : "Chưa có sản phẩm để đánh giá"}</h2><p role={loadError ? "alert" : "status"}>{invalidId ? "Vui lòng chọn sản phẩm từ đơn hàng của bạn." : loadError || (requestedId ? "Sản phẩm này đã được đánh giá hoặc không nằm trong danh sách được đánh giá của bạn." : "Các sản phẩm đủ điều kiện sẽ xuất hiện tại đây sau khi đơn hàng được giao.")}</p><div>{loadError && <button type="button" onClick={() => { setLoadError(""); setLoading(true); setAttempt((n) => n + 1); }}>Thử lại</button>}<Link href="/account/orders">Về đơn hàng</Link>{loadError && <Link href="/account/feedback/new?preview=1" className={styles.primary}>Xem giao diện mẫu</Link>}</div></div> : <>
      {!success && requestedId === null && items.length > 1 && <label className={styles.select}>Chọn sản phẩm<select disabled={pending || photoState.loading} value={selectedId ?? ""} onChange={(event) => { photoState.clear(); setSelectedId(Number(event.target.value)); setRating(null); setContent(""); setErrors({ rating: "", content: "" }); setMessage(""); }}>{items.map((item) => <option key={item.orderItemId} value={item.orderItemId}>{item.name} · {item.orderCode}</option>)}</select></label>}
      <div className={styles.layout}><ReviewedProduct key={item.orderItemId} item={item} />
        {success ? <section className={styles.success}><Check size={36} /><h2 ref={successHeading} tabIndex={-1}>{preview ? "Bản xem trước đánh giá" : "Cảm ơn bạn đã chia sẻ!"}</h2><p role="status">{preview ? "Bạn đang xem thử nội dung. Chưa có đánh giá nào được gửi." : "Đánh giá của bạn đã được gửi đến Cocoon."}</p><RatingStars value={rating} /><blockquote>{content.trim()}</blockquote><ReviewPhotoGallery photos={photoState.photos} />{preview ? <button type="button" className={styles.primary} onClick={() => setSuccess(false)}>Chỉnh sửa bản xem thử</button> : <Link href="/account/orders" className={styles.primary}>Về đơn hàng <ArrowRight size={16} /></Link>}</section> : <form ref={form} onSubmit={submit} noValidate className={styles.form} aria-label="Đánh giá sản phẩm" aria-busy={pending}><fieldset disabled={pending}>
          <h2>Bạn cảm thấy sản phẩm thế nào?</h2><RatingInput label="Mức độ hài lòng" name="rating" value={rating} onValueChange={(value) => { setRating(value); setErrors((previous) => ({ ...previous, rating: "" })); }} required disabled={pending} error={errors.rating} /><p className={styles.sentiment} aria-live="polite">{sentiments[rating ?? 0]}</p>
          <label htmlFor="review-content" className={styles.label}>Nhận xét của bạn <span aria-hidden="true">*</span></label><p id="review-hint" className={styles.hint}>Bạn thích điều gì ở sản phẩm? Kết cấu, mùi hương hay cảm nhận trên da và tóc?</p><textarea id="review-content" name="content" value={content} onChange={(event) => { setContent(event.target.value); setErrors((previous) => ({ ...previous, content: "" })); }} rows={6} maxLength={1000} required placeholder="Viết cảm nhận chân thật của bạn…" aria-invalid={!!errors.content} aria-describedby={`review-hint review-count${errors.content ? " review-error" : ""}`} /><div className={styles.counter} id="review-count">{content.length}/1.000 ký tự</div>{errors.content && <p id="review-error" role="alert" className={styles.error}>{errors.content}</p>}
          <ReviewPhotoPicker state={photoState} disabled={pending} /><p className={styles.privacy}>Chỉ chia sẻ trải nghiệm về sản phẩm; tránh đưa số điện thoại, địa chỉ hoặc thông tin riêng tư vào nhận xét.</p>{message && <p role="alert" className={styles.error}>{message}</p>}<button type="submit" className={styles.submit} disabled={pending || photoState.loading}>{pending ? "Đang gửi đánh giá…" : preview ? "Xem trước đánh giá" : "Gửi đánh giá"}<ArrowRight size={18} /></button>
        </fieldset></form>}
      </div>
    </>}
  </div>;
}
