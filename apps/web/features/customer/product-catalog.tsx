"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LoaderCircle, Search } from "lucide-react";
import { EmptyState } from "@/components/brand/empty-state";
import { ProductCard } from "@/components/brand/product-card";
import { loadShopCategories, loadShopProducts, type ShopCategory, type ShopProduct } from "./shop-service";
import landing from "@/features/landing/landing.module.css";
import styles from "./product-catalog.module.css";

export function ProductCatalog({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [searchInput, setSearchInput] = useState(initialQuery);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(24);
  const [sort, setSort] = useState("featured");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  // Load categories once
  useEffect(() => {
    let active = true;
    loadShopCategories()
      .then((data) => {
        if (active) setCategories(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Load products when query, categoryId, page or attempt change
  useEffect(() => {
    const controller = new AbortController();
    loadShopProducts({ search: query, categoryId, page, pageSize }, controller.signal)
      .then((res) => {
        if (!controller.signal.aborted) {
          setProducts(res.items);
          setTotalCount(res.totalCount);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError("Không thể tải danh sách sản phẩm. Vui lòng thử lại.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query, categoryId, page, pageSize, attempt]);

  const sortedProducts = [...products];
  if (sort === "price-asc") {
    sortedProducts.sort((a, b) => a.minPrice - b.minPrice);
  } else if (sort === "price-desc") {
    sortedProducts.sort((a, b) => b.minPrice - a.minPrice);
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setQuery(searchInput);
    setPage(1);
  };

  const handleCategoryChange = (newCatId: number | null) => {
    setLoading(true);
    setError("");
    setCategoryId(newCatId);
    setPage(1);
  };

  return (
    <section className={`${landing.products} ${styles.catalog}`}>
      <nav aria-label="Đường dẫn" className={styles.breadcrumb}>
        <Link href="/account">Trang chủ</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Sản phẩm</span>
      </nav>
      <div className={styles.intro}>
        <span className={landing.eyebrow}>Chăm sóc từ thực vật Việt Nam</span>
        <h1>Tất cả sản phẩm</h1>
        <p>Tìm một người bạn đồng hành cho làn da và mái tóc của bạn.</p>
      </div>

      <div className={styles.toolbar}>
        <form onSubmit={handleSearchSubmit} className={styles.search}>
          <Search size={18} aria-hidden="true" />
          <label htmlFor="catalog-search" className="sr-only">Tìm sản phẩm trong danh mục</label>
          <input
            id="catalog-search"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onBlur={() => {
              if (searchInput !== query) {
                setQuery(searchInput);
                setPage(1);
              }
            }}
            placeholder="Tìm theo tên sản phẩm…"
          />
        </form>
        <label className={styles.sort}>
          Sắp xếp
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="featured">Nổi bật</option>
            <option value="price-asc">Giá tăng dần</option>
            <option value="price-desc">Giá giảm dần</option>
          </select>
        </label>
      </div>

      <div className={`${landing.tabs} ${styles.tabs}`} aria-label="Lọc danh mục">
        <button
          type="button"
          aria-pressed={categoryId === null}
          onClick={() => handleCategoryChange(null)}
        >
          Tất cả
        </button>
        {categories.map((c) => (
          <button
            type="button"
            key={c.id}
            aria-pressed={categoryId === c.id}
            onClick={() => handleCategoryChange(c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>

      <p className={styles.count} role="status">
        {loading ? "Đang tải…" : `${totalCount} sản phẩm`}
      </p>

      {loading && products.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-[#81745e]">
          <LoaderCircle size={28} className="motion-safe:animate-spin mr-3" />
          <span>Đang tải danh sách sản phẩm…</span>
        </div>
      ) : error ? (
        <div className="rounded border border-[#dfd7c5] p-8 text-center bg-[#fffdf8]">
          <p role="alert" className="text-red-800 mb-4">{error}</p>
          <button
            type="button"
            className="border border-[#a18b66] px-4 py-2 text-sm rounded bg-[#29251e] text-[#fffaf0]"
            onClick={() => setAttempt((v) => v + 1)}
          >
            Thử lại
          </button>
        </div>
      ) : sortedProducts.length ? (
        <div className={landing.productGrid}>
          {sortedProducts.map((product) => (
            <ProductCard
              key={product.id}
              name={product.name}
              href={`/account/products/${product.id}`}
              imageUrl={product.imageUrl}
              minPrice={product.minPrice}
              avgRating={product.averageRating}
              reason={product.feedbackCount > 0 ? <span className="text-xs text-[#81745e]">{product.feedbackCount} đánh giá</span> : null}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Chưa tìm thấy sản phẩm"
          description="Thử tên khác hoặc xem lại tất cả sản phẩm."
          action={
            <button
              type="button"
              className={landing.textLink}
              onClick={() => {
                setQuery("");
                setSearchInput("");
                setCategoryId(null);
                setPage(1);
              }}
            >
              Xem tất cả sản phẩm
            </button>
          }
        />
      )}

      {totalPages > 1 && (
        <nav className="flex justify-center items-center gap-6 mt-10 text-sm" aria-label="Phân trang sản phẩm">
          <button
            type="button"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="border border-[#d7c9af] px-4 py-2 rounded disabled:opacity-40 hover:bg-[#eee7d5]"
          >
            Trang trước
          </button>
          <span>{page} / {totalPages}</span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="border border-[#d7c9af] px-4 py-2 rounded disabled:opacity-40 hover:bg-[#eee7d5]"
          >
            Trang sau
          </button>
        </nav>
      )}
    </section>
  );
}
