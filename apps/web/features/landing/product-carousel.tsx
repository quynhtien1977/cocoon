"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import styles from "./landing.module.css";
import carousel from "./product-carousel.module.css";

type Product = {
  name: string;
  size: string;
  category: string;
  image: string;
  hoverImage: string;
  price: string;
  url: string;
};

export function ProductCarousel({ products }: { products: Product[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const stepRef = useRef(0);
  const [position, setPosition] = useState({ index: 0, max: 0, visible: 4 });

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const card = track.querySelector("article");
      if (!card) return;
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      const step = card.getBoundingClientRect().width + gap;
      if (!step) return;
      stepRef.current = step;
      const max = Math.max(0, Math.round((track.scrollWidth - track.clientWidth) / step));
      const index = Math.max(0, Math.min(max, Math.round(track.scrollLeft / step)));
      const visible = Math.max(1, Math.round((track.clientWidth + gap) / step));
      setPosition((previous) => previous.index === index && previous.max === max && previous.visible === visible
        ? previous : { index, max, visible });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(track);
    track.addEventListener("scroll", schedule, { passive: true });
    schedule();
    return () => {
      observer.disconnect();
      track.removeEventListener("scroll", schedule);
      cancelAnimationFrame(frame);
    };
  }, []);

  const goTo = (index: number, smooth = true) => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    trackRef.current?.scrollTo({
      left: Math.max(0, Math.min(position.max, index)) * stepRef.current,
      behavior: smooth && !reducedMotion ? "smooth" : "instant",
    });
  };

  return (
    <div className={carousel.carousel}>
      <div ref={trackRef} id="bestseller-track" className={carousel.track} role="region" aria-label="Danh sách sản phẩm bán chạy" tabIndex={0}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
            event.preventDefault();
            goTo(position.index + (event.key === "ArrowRight" ? 1 : -1));
          }
          if (event.key === "Home" || event.key === "End") {
            event.preventDefault();
            goTo(event.key === "Home" ? 0 : position.max);
          }
        }}>
        {products.map((product) => (
          <article key={product.url} className={carousel.card}>
            <a href={product.url} target="_blank" rel="noreferrer" className={`${styles.productImage} ${carousel.image}`}>
              <Image src={product.image} alt={product.name} fill sizes="(min-width: 801px) 25vw, 50vw" />
              <Image className={carousel.hoverImage} src={product.hoverImage} alt="" aria-hidden="true" fill sizes="(min-width: 801px) 25vw, 50vw" />
              <span>XEM SẢN PHẨM <ArrowUpRight size={16} /></span>
            </a>
            <p className={styles.productCategory}>{product.category}</p>
            <h3><a href={product.url} target="_blank" rel="noreferrer">{product.name}</a></h3>
            <p className={styles.productSize}>{product.size}</p>
            <p className={styles.price}>{product.price}</p>
          </article>
        ))}
      </div>
      {position.max > 0 && <>
        <div className={carousel.arrows}>
          <button type="button" aria-label="Sản phẩm trước" aria-controls="bestseller-track" disabled={position.index === 0} onClick={() => goTo(position.index - 1)}><ChevronLeft size={22} /></button>
          <button type="button" aria-label="Sản phẩm tiếp theo" aria-controls="bestseller-track" disabled={position.index === position.max} onClick={() => goTo(position.index + 1)}><ChevronRight size={22} /></button>
        </div>
        <input className={carousel.slider} type="range" min={0} max={position.max} step={1} value={position.index}
          aria-label="Vị trí danh sách sản phẩm" aria-controls="bestseller-track"
          aria-valuetext={`Sản phẩm ${position.index + 1} đến ${Math.min(products.length, position.index + position.visible)} trên ${products.length}`}
          style={{ "--thumb-width": `${Math.min(100, position.visible / products.length * 100)}%` } as CSSProperties}
          onChange={(event) => goTo(Number(event.target.value), false)} />
      </>}
    </div>
  );
}
