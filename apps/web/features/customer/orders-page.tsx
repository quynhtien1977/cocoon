"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, PackageCheck, Search, ShoppingBag, Star } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { EmptyState } from "@/components/brand/empty-state";
import { RatingStars } from "@/components/brand/rating-stars";
import { filterOrders, loadOrders, type CustomerOrder, type OrderFilter } from "./orders-service";
import { previewOrders } from "./orders-preview";
import styles from "./orders.module.css";

const tabs = [
  { key: "all", label: "Tất cả" }, { key: "delivered", label: "Đã giao" },
  { key: "shipping", label: "Đang giao", disabled: true }, { key: "pending", label: "Chờ xác nhận", disabled: true },
  { key: "reviewed", label: "Đã đánh giá" }, { key: "unreviewed", label: "Chờ đánh giá" },
] as const;
const money = (value: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
const date = (value: string) => new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value));

function OrderImage({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  return <div className={styles.image}>{src && failed !== src ? (
    // API media hosts are not known yet; display source URLs without a proxy allowlist.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={name} width={100} height={100} loading="lazy" onError={() => setFailed(src)} />
  ) : <ShoppingBag size={28} aria-label="Chưa có ảnh sản phẩm" />}</div>;
}

export function OrdersPage({ initialFilter = "all", initialPreview = false }: { initialFilter?: OrderFilter; initialPreview?: boolean } = {}) {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [filter, setFilter] = useState<OrderFilter>(initialFilter);
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState(initialPreview);
  const [pending, setPending] = useState(!initialPreview);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState(1);
  useEffect(() => {
    if (preview) return;
    const controller = new AbortController();
    loadOrders(AbortSignal.any([controller.signal, AbortSignal.timeout(12000)])).then((data) => { if (!controller.signal.aborted) setOrders(data); }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setError(error instanceof ApiError && error.status === 501 ? "Lịch sử đơn hàng hiện chưa khả dụng. Bạn có thể quay lại sau hoặc xem giao diện mẫu." : "Chưa thể tải đơn hàng. Vui lòng thử lại sau.");
    }).finally(() => { if (!controller.signal.aborted) setPending(false); });
    return () => controller.abort();
  }, [attempt, preview]);
  const source = preview ? previewOrders : orders;
  const visible = filterOrders(source, filter, query);
  const pageCount = Math.max(1, Math.ceil(visible.length / 5));
  const delivered = source.filter((order) => order.status === "Completed");
  const awaiting = delivered.flatMap((order) => order.items).filter((item) => !item.review).length;
  const reviewed = delivered.flatMap((order) => order.items).filter((item) => item.review).length;
  const ready = preview || (!pending && !error);
  const select = (value: OrderFilter) => { setFilter(value); setPage(1); };

  return <div className={styles.orders}>
    <nav className={styles.breadcrumb} aria-label="Đường dẫn"><Link href="/account">Trang chủ</Link><span>/</span><span aria-current="page">Đơn hàng</span></nav>
    <div className={styles.heading}><div><p className={styles.eyebrow}>Cocoon đồng hành cùng bạn</p><h1>Đơn hàng của bạn</h1><p>Theo dõi những sản phẩm đã đồng hành cùng bạn và chia sẻ trải nghiệm của mình.</p></div><Link href="/account/products" className={styles.shop}>Khám phá sản phẩm <ArrowRight size={17} /></Link></div>
    {preview && <div className={styles.preview} role="status"><span><strong>Giao diện mẫu</strong> · Các đơn hàng dưới đây chỉ để minh họa, không phải lịch sử mua hàng của bạn.</span><button type="button" onClick={() => { setPreview(false); setPage(1); setPending(true); setError(""); }}>Thoát xem mẫu</button></div>}
    <div className={styles.summary}>
      <div><PackageCheck size={24} /><span><strong>{ready ? delivered.length : "—"}</strong> đơn đã giao</span></div>
      <div><Star size={24} /><span><strong>{ready ? awaiting : "—"}</strong> sản phẩm chờ đánh giá</span></div>
      <div><Check size={24} /><span><strong>{ready ? reviewed : "—"}</strong> sản phẩm đã đánh giá</span></div>
    </div>
    <div className={styles.filters} aria-label="Lọc đơn hàng">{tabs.map((tab) => <button key={tab.key} type="button" disabled={"disabled" in tab} aria-pressed={filter === tab.key} onClick={() => select(tab.key as OrderFilter)}>{tab.label}{"disabled" in tab && <small>Sắp có</small>}</button>)}</div>
    <div className={styles.toolbar}><p aria-live="polite">{ready ? `${visible.length} đơn hàng${query ? " phù hợp" : ""}` : "Lịch sử mua hàng"}</p><label className={styles.search}><Search size={18} /><span className="sr-only">Tìm theo mã đơn hoặc tên sản phẩm</span><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Tìm mã đơn hoặc tên sản phẩm…" /></label></div>
    {!preview && pending ? <div className={styles.loading} role="status">Đang tải đơn hàng của bạn…<div /><div /></div> : !preview && error ? <div className={styles.unavailable}><ShoppingBag size={36} /><h2>Hẹn bạn với những trải nghiệm mới</h2><p role="alert">{error}</p><div><button type="button" onClick={() => { setPending(true); setError(""); setAttempt((value) => value + 1); }}>Thử lại</button><button type="button" className={styles.primary} onClick={() => { setPreview(true); setQuery(""); select("all"); }}>Xem giao diện mẫu</button></div></div> : !visible.length ? <EmptyState title={filter === "unreviewed" ? "Không có sản phẩm chờ đánh giá" : "Chưa có đơn hàng phù hợp"} description={query ? "Thử tìm theo tên sản phẩm hoặc mã đơn khác." : "Các đơn hàng tương ứng sẽ được hiển thị tại đây."} action={<button type="button" className={styles.shop} onClick={() => { setQuery(""); select("all"); }}>Xem tất cả đơn hàng <ArrowRight size={16} /></button>} /> : <div className={styles.list}>
      {visible.slice((page - 1) * 5, page * 5).map((order) => <article key={order.id} className={styles.card}>
        <div className={styles.cardHeader}><div><span className={styles.orderCode}>Đơn #{order.code}</span><span className={styles.date}>Đặt ngày {date(order.orderedAt)}</span></div><span className={styles.status}><PackageCheck size={16} />{order.status === "Completed" ? "Đã giao" : order.status === "Cancelled" ? "Đã hủy" : "Đã trả hàng"}</span></div>
        {order.items.length !== order.originalItemCount && <p className={styles.partial}>Đang hiển thị {order.items.length}/{order.originalItemCount} sản phẩm phù hợp trong đơn.</p>}
        {order.items.map((item) => {
          const feedbackHref = item.review ? `/account/feedback/${item.review.id}${preview ? "?preview=1" : ""}` : null;
          const content = <>
          <OrderImage src={item.imageUrl} name={item.name} />
          <div className={styles.itemInfo}><h3>{!feedbackHref && item.productSlug ? <Link href={`/account/products/${encodeURIComponent(item.productSlug)}`}>{item.name}</Link> : item.name}</h3><p>{item.variant}</p><span>Số lượng: {item.quantity}</span><div className={styles.reviewState}>{item.review ? <><RatingStars value={item.review.rating} /><span>Đã đánh giá</span></> : order.status === "Completed" ? <span>Chờ bạn chia sẻ trải nghiệm</span> : null}</div></div>
          <div className={styles.itemAction}><strong>{money(item.unitPrice * item.quantity)}</strong>{item.quantity > 1 && <small>{money(item.unitPrice)} / sản phẩm</small>}{feedbackHref ? <span className={`${styles.secondary} ${styles.feedbackAction}`}>Xem phản hồi <ArrowRight size={14} /></span> : order.status === "Completed" && <Link className={styles.primary} href={preview ? `/account/feedback/new?preview=1&item=${item.id}` : `/account/feedback/new?orderItemId=${item.id}`}>Đánh giá sản phẩm</Link>}</div>
          </>;
          return feedbackHref ? <Link href={feedbackHref} className={`${styles.item} ${styles.reviewedItem}`} key={item.id} aria-label={`Xem phản hồi về ${item.name}`}>{content}</Link> : <div className={styles.item} key={item.id}>{content}</div>;
        })}
        <div className={styles.cardFooter}><span>{order.status === "Completed" ? "Cảm ơn bạn đã lựa chọn Cocoon." : "Thông tin được cập nhật theo đơn hàng."}</span><p>Tổng đơn hàng <strong>{money(order.totalAmount)}</strong></p></div>
      </article>)}
    </div>}
    {ready && pageCount > 1 && <nav className={styles.pagination} aria-label="Phân trang đơn hàng"><button type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>Trang trước</button><span>{page}/{pageCount}</span><button type="button" disabled={page === pageCount} onClick={() => setPage(page + 1)}>Trang sau</button></nav>}
  </div>;
}
