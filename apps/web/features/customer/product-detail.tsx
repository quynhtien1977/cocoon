"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Leaf } from "lucide-react";
import type { products } from "@/features/landing/products";
import styles from "./product-detail.module.css";

export function ProductDetail({ product }: { product: typeof products[number] }) {
  const images = [...new Set([product.image, product.hoverImage])];
  const [selected, setSelected] = useState(images[0]);
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
  </article>;
}
