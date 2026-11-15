"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Leaf } from "lucide-react";
import type { products } from "@/features/landing/products";
import { ApiProductDetail } from "./api-product-detail";
import { loadShopProducts } from "./shop-service";
import styles from "./product-detail.module.css";
import { RecommendationSection } from "./recommendation-section";

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .trim()
    .toLowerCase();

export function ProductDetail({ product }: { product: typeof products[number] }) {
  const images = [...new Set([product.image, product.hoverImage])];
  const [selected, setSelected] = useState(images[0]);
  const [matchedId, setMatchedId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const targetName = normalizeText(product.name);
    loadShopProducts({ search: product.name, pageSize: 10 }, controller.signal, {
      refresh: false,
      redirectOnUnauthorized: false,
    })
      .then((res) => {
        if (controller.signal.aborted) return;
        const match =
          res.items.find((item) => normalizeText(item.name) === targetName) ??
          res.items.find(
            (item) => normalizeText(item.name).includes(targetName) || targetName.includes(normalizeText(item.name))
          );
        if (match) setMatchedId(String(match.id));
      })
      .catch(() => {});
    return () => controller.abort();
  }, [product.name]);

  if (matchedId) {
    return <ApiProductDetail id={matchedId} />;
  }

  return <article className={styles.detail}>
    <nav aria-label="Đường dẫn" className={styles.breadcrumb}><Link href="/account">Trang chủ</Link><span>/</span><Link href="/account/products">Sản phẩm</Link><span>/</span><span aria-current="page">{product.name}</span></nav>
    <div className={styles.layout}>
      <div><div className={styles.image}><Image src={selected} alt={product.name} fill sizes="(min-width: 800px) 50vw, 100vw" priority /></div>
        {images.length > 1 && <div className={styles.thumbnails} aria-label="Hình ảnh sản phẩm">{images.map((src, index) => <button key={src} type="button" aria-label={`Xem ảnh sản phẩm ${index + 1}`} aria-pressed={selected === src} onClick={() => setSelected(src)}><Image src={src} alt="" width={80} height={80} /></button>)}</div>}
      </div>
      <div className={styles.info}><p className={styles.category}>{product.category}</p><h1>{product.name}</h1><p className={styles.size}>{product.size}</p><p className={styles.price}>{product.price || "Giá đang cập nhật"}</p><span className={styles.note}>Giá tham khảo từ website thương hiệu</span>
        <p className={styles.vegan}><Leaf size={20} strokeWidth={1.5} />Mỹ phẩm 100% thuần chay từ Việt Nam</p>
        <div className={styles.description}><h2>Thông tin sản phẩm</h2><p>{product.name} · {product.size}.</p><p>Thuộc dòng {product.category.toLocaleLowerCase("vi")} của Cocoon.</p><p>Hình ảnh và thông tin đang hiển thị là dữ liệu tham khảo. Tính năng đặt hàng sẽ sớm có mặt.</p></div>
        <Link href="/account/products" className={styles.back}><ArrowLeft size={18} />Tiếp tục khám phá sản phẩm</Link>
      </div>
    </div>
    <RecommendationSection excludeProductName={product.name} />
  </article>;
}
