import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { RecommendationSection } from "@/features/customer/recommendation-section";
import styles from "@/features/customer/orders.module.css";

export const metadata: Metadata = {
  title: "Sản phẩm gợi ý | Cocoon",
};

export default function Page() {
  return (
    <div className={styles.orders}>
      <nav className={styles.breadcrumb} aria-label="Đường dẫn">
        <Link href="/account">Trang chủ</Link>
        <span>/</span>
        <span aria-current="page">Sản phẩm gợi ý</span>
      </nav>
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Chăm chút riêng cho bạn</p>
          <h1>Sản phẩm gợi ý</h1>
          <p>Những lựa chọn được tuyển chọn từ nhu cầu chăm sóc da, tóc và lịch sử trải nghiệm của bạn.</p>
        </div>
        <Link href="/account/profile" className={styles.shop}>
          Cập nhật nhu cầu <ArrowRight size={17} />
        </Link>
      </div>
      <RecommendationSection grid limit={12} />
    </div>
  );
}
