"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Leaf, ShoppingBag } from "lucide-react";
import { ApiError } from "../../lib/api/client";
import { loadProduct, type ApiProduct } from "./product-service";
import { CheckoutDialog } from "./checkout-dialog";
import styles from "./product-detail.module.css";
import { RecommendationSection } from "./recommendation-section";

export function ApiProductDetail({ id }: { id: string }) {
  const [product, setProduct] = useState<ApiProduct | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [variantIndex, setVariantIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [failedImage, setFailedImage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    loadProduct(id, AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]))
      .then((value) => {
        if (!controller.signal.aborted) setProduct(value);
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        setError(
          reason instanceof ApiError && reason.status === 501
            ? "Chi tiết sản phẩm hiện chưa khả dụng. Vui lòng quay lại sau."
            : reason instanceof ApiError && reason.status === 404
            ? "Không tìm thấy sản phẩm này."
            : "Chưa thể tải sản phẩm. Vui lòng thử lại."
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, attempt]);

  const variant = product?.variants[variantIndex];
  const variantImages = product
    ? product.variants
        .map((item, index) => ({ src: item.imageUrl, variantIndex: index, alt: item.name }))
        .filter((entry): entry is { src: string; variantIndex: number; alt: string } => Boolean(entry.src))
    : [];
  const uniqueImages = variantImages.filter(
    (entry, index, arr) => arr.findIndex((other) => other.src === entry.src) === index
  );
  const activeImage = variant?.imageUrl ?? uniqueImages[0]?.src ?? null;

  return (
    <article className={styles.detail}>
      <nav aria-label="Đường dẫn" className={styles.breadcrumb}>
        <Link href="/account">Trang chủ</Link>
        <span>/</span>
        <Link href="/account/products">Sản phẩm</Link>
        <span>/</span>
        <span aria-current="page">{product?.name ?? "Chi tiết sản phẩm"}</span>
      </nav>

      {loading ? (
        <p role="status" className="py-12 text-center">
          Đang tải sản phẩm…
        </p>
      ) : error ? (
        <div className="rounded border border-[#dfd7c5] p-8 text-center">
          <h1 className="mb-4 font-heading text-3xl">Thông tin sản phẩm</h1>
          <p role="alert">{error}</p>
          <button
            type="button"
            className={styles.back}
            onClick={() => {
              setLoading(true);
              setError("");
              setAttempt((value) => value + 1);
            }}
          >
            Thử lại
          </button>
        </div>
      ) : (
        product && (
          <div className={styles.layout}>
            <div>
              <div className={styles.image}>
                {activeImage && failedImage !== activeImage ? (
                  // API image hosts are not configured for the Next optimizer yet.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={activeImage}
                    alt={product.name}
                    onError={() => setFailedImage(activeImage)}
                  />
                ) : (
                  <div className="grid h-full place-content-center justify-items-center gap-4 text-[#81765e]">
                    <ShoppingBag size={48} />
                    <span>Chưa có ảnh sản phẩm</span>
                  </div>
                )}
              </div>
              {uniqueImages.length > 1 && (
                <div className={styles.thumbnails} aria-label="Hình ảnh sản phẩm">
                  {uniqueImages.map((entry, index) => (
                    <button
                      key={entry.src}
                      type="button"
                      aria-label={`Xem ảnh sản phẩm ${index + 1}`}
                      aria-pressed={activeImage === entry.src}
                      onClick={() => {
                        setVariantIndex(entry.variantIndex);
                        setFailedImage(null);
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={entry.src} alt="" width={80} height={80} />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className={styles.info}>
              <p className={styles.category}>{product.categoryName || "Cocoon"}</p>
              <h1>{product.name}</h1>
              <p className={styles.size}>
                {variant ? variant.name : product.variants.map((item) => item.name).join(" · ")}
              </p>
              {product.variants.length > 1 && (
                <>
                  <div className={styles.variantPills} role="group" aria-label="Chọn biến thể">
                    {product.variants.map((item, index) => (
                      <button
                        key={item.id}
                        type="button"
                        className={styles.variantPill}
                        aria-pressed={index === variantIndex}
                        onClick={() => {
                          setVariantIndex(index);
                          setFailedImage(null);
                        }}
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                  <select
                    aria-label="Chọn biến thể"
                    className="sr-only"
                    value={variantIndex}
                    onChange={(event) => {
                      setVariantIndex(Number(event.target.value));
                      setFailedImage(null);
                    }}
                  >
                    {product.variants.map((item, index) => (
                      <option key={item.id} value={index}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </>
              )}
              <p className={styles.price}>
                {variant
                  ? new Intl.NumberFormat("vi-VN", {
                      style: "currency",
                      currency: "VND",
                      maximumFractionDigits: 0,
                    }).format(variant.price)
                  : "Giá đang cập nhật"}
              </p>
              <span className={styles.note}>Giá niêm yết từ Cocoon · Thanh toán khi nhận hàng</span>
              <p className={styles.vegan}>
                <Leaf size={20} strokeWidth={1.5} />
                Mỹ phẩm 100% thuần chay từ Việt Nam
              </p>

              {product.status === "Active" && variant && (
                <div className={styles.purchaseRow}>
                  <label htmlFor="buy-quantity" className={styles.quantityField}>
                    Số lượng
                    <input
                      id="buy-quantity"
                      type="number"
                      min={1}
                      max={10}
                      className={styles.quantityInput}
                      value={quantity}
                      onChange={(event) => {
                        const parsed = Number.parseInt(event.target.value, 10);
                        setQuantity(Number.isFinite(parsed) ? Math.min(10, Math.max(1, parsed)) : 1);
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className={styles.buyButton}
                    onClick={() => setCheckoutOpen(true)}
                  >
                    <ShoppingBag size={18} />
                    Mua ngay
                  </button>
                </div>
              )}

              {([
                ["Thông tin sản phẩm", product.description],
                ["Công dụng", product.benefits],
                ["Thành phần", product.ingredients],
                ["Hướng dẫn sử dụng", product.usage],
              ] as const).map(
                ([title, text]) =>
                  text && (
                    <section key={title} className={styles.description}>
                      <h2>{title}</h2>
                      <p className="whitespace-pre-line">{text}</p>
                    </section>
                  )
              )}

              <Link href="/account/products" className={styles.back}>
                <ArrowLeft size={18} />
                Tiếp tục khám phá sản phẩm
              </Link>
            </div>
          </div>
        )
      )}

      {product && variant && (
        <CheckoutDialog
          open={checkoutOpen}
          onOpenChange={setCheckoutOpen}
          product={product}
          variant={variant}
          quantity={quantity}
        />
      )}

      {product && !loading && !error && <RecommendationSection excludeProductId={product.id} />}
    </article>
  );
}
