"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, MessageSquare, RefreshCw, ShoppingBag } from "lucide-react";
import { EmptyState } from "@/components/brand/empty-state";
import { RatingStars } from "@/components/brand/rating-stars";
import { StatusBadge } from "@/components/brand/status-badge";
import { apiRequest } from "@/lib/api/client";
import styles from "./orders.module.css";

type FeedbackStatus = "New" | "Accepted" | "Assigned" | "Replied" | "Closed";

const feedbackStatuses: readonly FeedbackStatus[] = ["New", "Accepted", "Assigned", "Replied", "Closed"];

const statusTabs: readonly { key: "" | FeedbackStatus; label: string }[] = [
  { key: "", label: "Tất cả" },
  { key: "New", label: "Mới gửi" },
  { key: "Accepted", label: "Đã tiếp nhận" },
  { key: "Assigned", label: "Đang xử lý" },
  { key: "Replied", label: "Đã trả lời" },
  { key: "Closed", label: "Đã đóng" },
];

interface MyFeedbackApiItem {
  id: number;
  rating: number;
  content: string;
  status: FeedbackStatus | number;
  createdAt: string;
  orderCode: string | null;
  product: {
    id: number;
    name: string;
    variant: string;
    imageUrl: string | null;
  };
  hasReply: boolean;
}

interface MyFeedbackItem {
  id: number;
  rating: number;
  content: string;
  status: FeedbackStatus;
  createdAt: string;
  orderCode: string | null;
  product: {
    id: number;
    name: string;
    variant: string;
    imageUrl: string | null;
  };
  hasReply: boolean;
}

interface MyFeedbackPageResponse {
  items: MyFeedbackApiItem[];
  totalCount: number;
  page: number;
  pageSize: number;
}

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));

function FeedbackProductImage({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <div className={styles.image}>
      {src && failed !== src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} width={100} height={100} loading="lazy" onError={() => setFailed(src)} />
      ) : (
        <ShoppingBag size={28} aria-label="Chưa có ảnh sản phẩm" />
      )}
    </div>
  );
}

/** Customer feedback history (C3), reading from GET /api/v1/me/feedback. */
export function MyFeedbackPage() {
  const [items, setItems] = useState<MyFeedbackItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<"" | FeedbackStatus>("");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (statusFilter) params.set("status", statusFilter);

    apiRequest<MyFeedbackPageResponse>(`/me/feedback?${params.toString()}`, {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]),
    })
      .then((res) => {
        if (controller.signal.aborted) return;
        const normalized: MyFeedbackItem[] = res.items.map((item) => ({
          ...item,
          status:
            typeof item.status === "number"
              ? (feedbackStatuses[item.status] ?? "New")
              : item.status,
        }));
        setItems(normalized);
        setTotalCount(res.totalCount);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError("Chưa tải được danh sách phản hồi. Kiểm tra kết nối rồi thử lại.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [page, statusFilter, attempt]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className={styles.orders}>
      <nav className={styles.breadcrumb} aria-label="Đường dẫn">
        <Link href="/account">Trang chủ</Link>
        <span>/</span>
        <span aria-current="page">Phản hồi của tôi</span>
      </nav>

      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Chia sẻ cùng Cocoon</p>
          <h1>Phản hồi của bạn</h1>
          <p>Theo dõi đánh giá bạn đã gửi cho sản phẩm Cocoon và trao đổi cùng đội ngũ chăm sóc khách hàng.</p>
        </div>
        <Link href="/account/orders?filter=unreviewed" className={styles.shop}>
          Đánh giá sản phẩm đã mua <ArrowRight size={17} />
        </Link>
      </div>

      <div className={styles.filters} aria-label="Lọc trạng thái phản hồi">
        {statusTabs.map((tab) => (
          <button
            key={tab.key || "all"}
            type="button"
            aria-pressed={statusFilter === tab.key}
            onClick={() => {
              setLoading(true);
              setError("");
              setStatusFilter(tab.key);
              setPage(1);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.toolbar}>
        <p aria-live="polite">{loading ? "Đang tải phản hồi…" : `${totalCount} phản hồi`}</p>
      </div>

      {loading ? (
        <div className={styles.loading} role="status">
          Đang tải lịch sử phản hồi của bạn…
          <div />
          <div />
        </div>
      ) : error ? (
        <div className={styles.unavailable}>
          <MessageSquare size={36} />
          <h2>Chưa thể tải phản hồi</h2>
          <p role="alert">{error}</p>
          <div>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setError("");
                setAttempt((v) => v + 1);
              }}
            >
              <RefreshCw size={15} className="mr-1 inline" />
              Thử lại
            </button>
          </div>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="Chưa có phản hồi nào"
          description={
            statusFilter
              ? "Không có phản hồi nào ở trạng thái này."
              : "Sau khi nhận đơn hàng, bạn có thể gửi đánh giá sản phẩm ngay trong mục Đơn hàng."
          }
          action={
            statusFilter ? (
              <button
                type="button"
                className={styles.shop}
                onClick={() => {
                  setLoading(true);
                  setStatusFilter("");
                  setPage(1);
                }}
              >
                Xem tất cả phản hồi <ArrowRight size={16} />
              </button>
            ) : (
              <Link href="/account/orders" className={styles.shop}>
                Xem đơn hàng của bạn <ArrowRight size={16} />
              </Link>
            )
          }
        />
      ) : (
        <div className={styles.list}>
          {items.map((item) => (
            <article key={item.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <span className={styles.orderCode}>Phản hồi #{item.id}</span>
                  <span className={styles.date}>Gửi ngày {formatDate(item.createdAt)}</span>
                  {item.orderCode && <span className={styles.date}>· Đơn #{item.orderCode}</span>}
                </div>
                <StatusBadge kind="feedback" status={item.status} />
              </div>

              <Link href={`/account/feedback/${item.id}`} className={`${styles.item} ${styles.reviewedItem}`}>
                <FeedbackProductImage src={item.product.imageUrl} name={item.product.name} />
                <div className={styles.itemInfo}>
                  <h3>{item.product.name}</h3>
                  {item.product.variant && <p>{item.product.variant}</p>}
                  <div className="my-2">
                    <RatingStars value={item.rating} />
                  </div>
                  <p className="line-clamp-2 text-sm text-[#4a4134]">{item.content}</p>
                </div>
                <div className={styles.itemAction}>
                  <small>{item.hasReply ? "Cocoon đã trả lời" : "Chờ phản hồi"}</small>
                  <span className={`${styles.secondary} ${styles.feedbackAction}`}>
                    Xem chi tiết <ArrowRight size={14} />
                  </span>
                </div>
              </Link>
            </article>
          ))}
        </div>
      )}

      {!loading && totalPages > 1 && (
        <nav className={styles.pagination} aria-label="Phân trang phản hồi">
          <button type="button" disabled={page === 1} onClick={() => { setLoading(true); setPage(page - 1); }}>
            Trang trước
          </button>
          <span>
            {page}/{totalPages}
          </span>
          <button type="button" disabled={page >= totalPages} onClick={() => { setLoading(true); setPage(page + 1); }}>
            Trang sau
          </button>
        </nav>
      )}
    </div>
  );
}
