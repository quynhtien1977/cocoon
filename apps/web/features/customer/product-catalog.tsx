"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { EmptyState } from "@/components/brand/empty-state";
import { ProductCarousel } from "@/features/landing/product-carousel";
import { products } from "@/features/landing/products";
import landing from "@/features/landing/landing.module.css";
import styles from "./product-catalog.module.css";

const normalize = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").replaceAll("đ", "d").toLowerCase();

export function ProductCatalog({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState("Tất cả");
  const [sort, setSort] = useState("featured");
  const visible = products.filter((product) => (category === "Tất cả" || product.category === category) && normalize(product.name).includes(normalize(query.trim())));
  const price = (value: string) => Number(value.replace(/\D/g, ""));
  if (sort !== "featured") visible.sort((a, b) => sort === "price-asc" ? price(a.price) - price(b.price) : price(b.price) - price(a.price));
  return <section className={`${landing.products} ${styles.catalog}`}>
    <nav aria-label="Đường dẫn" className={styles.breadcrumb}><Link href="/account">Trang chủ</Link><span aria-hidden="true">/</span><span aria-current="page">Sản phẩm</span></nav>
    <div className={styles.intro}><span className={landing.eyebrow}>Chăm sóc từ thực vật Việt Nam</span><h1>Tất cả sản phẩm</h1><p>Tìm một người bạn đồng hành cho làn da và mái tóc của bạn.</p></div>
    <div className={styles.toolbar}>
      <div className={styles.search}><Search size={18} aria-hidden="true" /><label htmlFor="catalog-search" className="sr-only">Tìm sản phẩm trong danh mục</label><input id="catalog-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên sản phẩm…" /></div>
      <label className={styles.sort}>Sắp xếp<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="featured">Nổi bật</option><option value="price-asc">Giá tăng dần</option><option value="price-desc">Giá giảm dần</option></select></label>
    </div>
    <div className={landing.tabs} aria-label="Lọc danh mục">{["Tất cả", "Chăm sóc da", "Chăm sóc tóc"].map((name) => <button type="button" key={name} aria-pressed={category === name} onClick={() => setCategory(name)}>{name}</button>)}</div>
    <p className={styles.count} role="status">{visible.length} sản phẩm</p>
    {visible.length ? <ProductCarousel products={visible} grid /> : <EmptyState title="Chưa tìm thấy sản phẩm" description="Thử tên khác hoặc xem lại tất cả sản phẩm." action={<button type="button" className={landing.textLink} onClick={() => { setQuery(""); setCategory("Tất cả"); }}>Xem tất cả sản phẩm</button>} />}
    <p className={landing.priceNote}>Danh mục và giá tham khảo từ website Cocoon, chưa phải danh mục bán hàng trực tiếp. Xem sản phẩm trên website thương hiệu để biết thông tin hiện tại.</p>
  </section>;
}
