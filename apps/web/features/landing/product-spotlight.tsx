"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { Barlow_Condensed } from "next/font/google";
import { ArrowRight } from "lucide-react";
import assets from "@/public/images/landing/sources.json";
import styles from "./product-spotlight.module.css";
import { ProductLink } from "./product-link";

const spotlightFont = Barlow_Condensed({
  variable: "--font-spotlight",
  subsets: ["latin", "vietnamese"],
  weight: "400",
});

export function ProductSpotlight() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let previousTime = 0;
    let current = 0;

    const getOffset = () => {
      if (reducedMotion.matches) return 0;
      const { top, height } = section.getBoundingClientRect();
      // Match the reference: start at viewport entry, finish at center/top.
      const progress = Math.max(0, Math.min(1, (window.innerHeight - top) / (window.innerHeight + height / 2)));
      const eased = progress < 0.5 ? 2 * progress ** 2 : 1 - (-2 * progress + 2) ** 2 / 2;
      return 1 - eased;
    };

    const render = (time: number) => {
      frame = 0;
      const target = getOffset();
      const elapsed = previousTime ? Math.min(time - previousTime, 64) : 16;
      previousTime = time;
      current = reducedMotion.matches ? 0 : current + (target - current) * (1 - Math.exp(-elapsed / 100));
      if (Math.abs(target - current) < 0.001) current = target;
      section.style.setProperty("--reveal-offset", String(current));
      if (current !== target) frame = window.requestAnimationFrame(render);
      else previousTime = 0;
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(render);
    };

    current = getOffset();
    section.style.setProperty("--reveal-offset", String(current));
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    reducedMotion.addEventListener("change", schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      reducedMotion.removeEventListener("change", schedule);
      section.style.removeProperty("--reveal-offset");
    };
  }, []);

  return (
    <section id="cau-chuyen" ref={sectionRef} className={`${styles.spotlight} ${spotlightFont.variable}`} aria-labelledby="spotlight-title">
      <h2 id="spotlight-title" className={styles.heading}>Dầu gội bồ kết</h2>
      <div className={styles.artwork}>
        <Image className={`${styles.layer} ${styles.left}`} src={assets["spotlight-left"].src} alt="" fill sizes="(min-width: 1280px) 50vw, 400px" />
        <Image className={`${styles.layer} ${styles.right}`} src={assets["spotlight-right"].src} alt="" fill sizes="(min-width: 1280px) 50vw, 400px" />
        <Image className={`${styles.layer} ${styles.product}`} src={assets["spotlight-product"].src} alt="Dầu gội bồ kết Cocoon 500ml cùng bọt mịn và trái bồ kết" fill sizes="(min-width: 1280px) 50vw, 400px" />
      </div>
      <div className={styles.description}>
        <p>Giải pháp làm sạch gàu và chăm sóc da đầu với chiết xuất bồ kết Việt Nam, BHA (Salicylic Acid), Crinipan PMC và Bioecolia®. Tác động đa tầng làm sạch gàu đến 100%*, giúp giảm ngứa, giảm dầu nhờn và hạn chế tình trạng gàu quay lại, đồng thời hỗ trợ cân bằng hệ vi sinh da đầu, giúp duy trì da đầu sạch khỏe. Công thức không chứa sulfate, giúp làm sạch dịu nhẹ, phù hợp cho da đầu nhạy cảm.</p>
        <ProductLink href="https://cocoonvietnam.com/san-pham/dau-goi-bo-ket-500ml" className={styles.link}>MUA NGAY <ArrowRight size={20} aria-hidden="true" /></ProductLink>
      </div>
    </section>
  );
}
