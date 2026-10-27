"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { ApiError } from "../../lib/api/client";
import { loadProduct, type ApiProduct } from "./product-service";
import styles from "./product-detail.module.css";

export function ApiProductDetail({ id }: { id: string }) {
  const [product, setProduct] = useState<ApiProduct | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [variantIndex, setVariantIndex] = useState(0);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    loadProduct(id, AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]))
      .then(value => { if (!controller.signal.aborted) setProduct(value); })
      .catch(reason => {
        if (controller.signal.aborted) return;
        setError(reason instanceof ApiError && reason.status === 501 ? "Chi tiết sản phẩm hiện chưa khả dụng. Vui lòng quay lại sau."
          : reason instanceof ApiError && reason.status === 404 ? "Không tìm thấy sản phẩm này."
          : "Chưa thể tải sản phẩm. Vui lòng thử lại.");
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, attempt]);
  const variant = product?.variants[variantIndex];
  return <article className={styles.detail}>
    <nav aria-label="Đường dẫn" className={styles.breadcrumb}><Link href="/account">Trang chủ</Link><span>/</span><Link href="/account/products">Sản phẩm</Link><span>/</span><span aria-current="page">{product?.name ?? "Chi tiết sản phẩm"}</span></nav>
    {loading ? <p role="status" className="py-12 text-center">Đang tải sản phẩm…</p> : error ? <div className="rounded border border-[#dfd7c5] p-8 text-center"><h1 className="mb-4 font-heading text-3xl">Thông tin sản phẩm</h1><p role="alert">{error}</p><button type="button" className={styles.back} onClick={() => { setLoading(true); setError(""); setAttempt(value => value + 1); }}>Thử lại</button></div> : product && <div className={styles.layout}>
      <div className={styles.image}>{variant?.imageUrl && failedImage !== variant.imageUrl ? (
        // API image hosts are not configured for the Next optimizer yet.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={variant.imageUrl} alt={product.name} className="h-full w-full object-contain" onError={() => setFailedImage(variant.imageUrl)} />
      ) : <div className="grid h-full place-content-center justify-items-center gap-4 text-[#81765e]"><ShoppingBag size={48} /><span>Chưa có ảnh sản phẩm</span></div>}</div>
      <div className={styles.info}><p className={styles.category}>{product.categoryName || "Cocoon"}</p><h1>{product.name}</h1>
        {product.variants.length > 0 && <label className="grid gap-2 text-sm">Biến thể<select className="min-h-12 rounded border border-[#dfd7c5] p-3" value={variantIndex} onChange={event => setVariantIndex(Number(event.target.value))}>{product.variants.map((item, index) => <option key={index} value={index}>{item.name}</option>)}</select></label>}
        <p className={styles.price}>{variant ? new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(variant.price) : "Giá đang cập nhật"}</p>
        {([["Thông tin sản phẩm", product.description], ["Công dụng", product.benefits], ["Thành phần", product.ingredients], ["Hướng dẫn sử dụng", product.usage]] as const).map(([title, text]) => text && <section key={title} className={styles.description}><h2>{title}</h2><p className="whitespace-pre-line">{text}</p></section>)}
      </div>
    </div>}
    <Link href="/account/products" className={styles.back}><ArrowLeft size={18} />Tiếp tục khám phá sản phẩm</Link>
  </article>;
}
