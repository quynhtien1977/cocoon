"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare, Star, ArrowRight, CheckCircle2, CornerDownRight } from "lucide-react";
import { RatingStars } from "@/components/brand/rating-stars";
import {
  loadProductInsights,
  loadProductReviews,
  type ProductInsights,
  type ProductReviewItem,
} from "./product-service";

const ratingFmt = new Intl.NumberFormat("vi-VN", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
  } catch {
    return "";
  }
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (!parts.length || !parts[0]) return "KH";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ProductReviewsSection({
  productId,
  productName,
}: {
  productId: number;
  productName: string;
}) {
  const [insights, setInsights] = useState<ProductInsights | null>(null);
  const [reviews, setReviews] = useState<ProductReviewItem[]>([]);
  const [totalReviews, setTotalReviews] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  // Load initial insights and first page of reviews
  useEffect(() => {
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]);
    setLoading(true);
    setError("");

    Promise.all([
      loadProductInsights(productId, signal).catch(() => null),
      loadProductReviews(productId, { page: 1, pageSize: 6, rating: selectedRating ?? undefined }, signal).catch(() => null),
    ])
      .then(([insightsData, reviewsData]) => {
        if (controller.signal.aborted) return;
        if (insightsData) setInsights(insightsData);
        if (reviewsData) {
          setReviews(reviewsData.items);
          setTotalReviews(reviewsData.totalCount);
          setPage(1);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError("Chưa thể tải nhận xét của sản phẩm. Bạn vui lòng thử lại sau.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [productId, selectedRating]);

  // Load more reviews when user clicks "Xem thêm nhận xét"
  const handleLoadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const res = await loadProductReviews(productId, {
        page: nextPage,
        pageSize: 6,
        rating: selectedRating ?? undefined,
      });
      setReviews((prev) => [...prev, ...res.items]);
      setPage(nextPage);
      setTotalReviews(res.totalCount);
    } catch {
      // Keep existing reviews on error
    } finally {
      setLoadingMore(false);
    }
  };

  const countOf = (star: number) =>
    insights?.ratingDistribution.find((r) => r.rating === star)?.count ?? 0;
  const totalFeedback = insights?.totalFeedback ?? 0;
  const averageRating = insights?.averageRating;

  return (
    <section
      aria-label="Đánh giá và nhận xét từ khách hàng"
      className="mt-12 border-t border-[#dfd7c5] pt-10"
    >
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-[#92764c]">
            LẮNG NGHE & CHIA SẺ
          </span>
          <h2 className="font-heading text-2xl text-[#211e18] sm:text-3xl">
            Nhận xét của khách hàng
          </h2>
        </div>
        <p className="text-sm text-[#81765e]">
          Đánh giá chân thật từ khách hàng đã trải nghiệm {productName}
        </p>
      </div>

      {loading ? (
        <div role="status" className="space-y-4 py-8 text-center text-[#81765e]">
          <p>Đang tải nhận xét…</p>
        </div>
      ) : error ? (
        <div className="rounded-lg border border-[#e4ddcd] bg-[#fbf9f4] p-6 text-center text-[#81765e]">
          <p>{error}</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Rating Summary Card */}
          <div className="grid gap-6 rounded-lg border border-[#e4ddcd] bg-[#fffdf7] p-6 md:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
            {/* Score & Stars */}
            <div className="flex flex-col items-center justify-center border-b border-[#ebd7b2]/40 pb-6 text-center md:border-b-0 md:border-r md:pb-0 md:pr-6">
              <span className="font-heading text-5xl font-medium tracking-tight text-[#211e18]">
                {averageRating !== null && averageRating !== undefined
                  ? ratingFmt.format(averageRating)
                  : "—"}
                <span className="text-xl font-normal text-[#81765e]">/5</span>
              </span>
              <div className="mt-2">
                <RatingStars value={averageRating ?? null} />
              </div>
              <p className="mt-2 text-xs text-[#81765e]">
                {totalFeedback > 0 ? `Dựa trên ${totalFeedback} lượt đánh giá` : "Chưa có lượt đánh giá"}
              </p>
            </div>

            {/* Distribution bars */}
            <div className="flex flex-col justify-center space-y-2">
              {([5, 4, 3, 2, 1] as const).map((star) => {
                const count = countOf(star);
                const percent = totalFeedback > 0 ? (count / totalFeedback) * 100 : 0;
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() =>
                      setSelectedRating((prev) => (prev === star ? null : star))
                    }
                    className={`grid grid-cols-[3rem_minmax(0,1fr)_4rem] items-center gap-3 rounded px-2 py-1 text-left text-xs transition-colors hover:bg-[#f5efe4] ${
                      selectedRating === star ? "bg-[#ede0cc] font-semibold" : ""
                    }`}
                  >
                    <span className="flex items-center gap-1 text-[#211e18]">
                      {star} <Star className="size-3.5 fill-[#c5a25d] text-[#c5a25d]" />
                    </span>
                    <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-[#ede7d8]">
                      <div
                        className="h-full rounded-full bg-[#c5a25d] transition-all"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="text-right text-[#81765e] tabular-nums">
                      {count} ({Math.round(percent)}%)
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filter Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs uppercase tracking-wider text-[#81765e]">Lọc:</span>
            <button
              type="button"
              onClick={() => setSelectedRating(null)}
              className={`rounded-full px-3.5 py-1.5 text-xs transition-colors ${
                selectedRating === null
                  ? "bg-[#211e18] text-[#fefbf4]"
                  : "border border-[#d5cab4] bg-[#fffdf7] text-[#514736] hover:border-[#9c7c42]"
              }`}
            >
              Tất cả ({totalFeedback})
            </button>
            {([5, 4, 3, 2, 1] as const).map((star) => {
              const count = countOf(star);
              return (
                <button
                  key={star}
                  type="button"
                  onClick={() =>
                    setSelectedRating((prev) => (prev === star ? null : star))
                  }
                  className={`flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs transition-colors ${
                    selectedRating === star
                      ? "bg-[#211e18] text-[#fefbf4]"
                      : "border border-[#d5cab4] bg-[#fffdf7] text-[#514736] hover:border-[#9c7c42]"
                  }`}
                >
                  <span>{star} sao</span>
                  <span className="text-[11px] opacity-80">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Reviews List */}
          {reviews.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#d5cab4] bg-[#fbf9f4] p-10 text-center">
              <MessageSquare className="mx-auto size-10 text-[#a89d87]" strokeWidth={1.5} />
              <h3 className="mt-3 font-heading text-lg text-[#211e18]">
                {selectedRating !== null
                  ? `Chưa có nhận xét ${selectedRating} sao nào`
                  : "Chưa có nhận xét nào cho sản phẩm này"}
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-[#81765e]">
                Mỗi chia sẻ chân thành sau khi trải nghiệm giúp Cocoon ngày một hoàn thiện hơn.
              </p>
              <div className="mt-5">
                <Link
                  href="/account/orders"
                  className="inline-flex items-center gap-2 rounded bg-[#211e18] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#fefbf4] transition-colors hover:bg-[#514630]"
                >
                  Đánh giá sản phẩm đã mua <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((item) => {
                const round1Replies = (item.replies || []).filter((r) => (r.round ?? 1) === 1);
                const round2Replies = (item.replies || []).filter((r) => (r.round ?? 1) >= 2);

                return (
                  <article
                    key={item.id}
                    className="rounded-lg border border-[#e4ddcd] bg-[#fffdf7] p-5 transition-shadow hover:shadow-xs"
                  >
                    <header className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          aria-hidden="true"
                          className="grid size-9 shrink-0 place-items-center rounded-full bg-[#ede0cc] font-mono text-xs font-semibold text-[#6b5530]"
                        >
                          {getInitials(item.customerName)}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h4 className="text-sm font-semibold text-[#211e18]">
                              {item.customerName}
                            </h4>
                            <span
                              title="Đã mua hàng tại Cocoon"
                              className="inline-flex items-center gap-0.5 text-[11px] text-[#4f7a4a]"
                            >
                              <CheckCircle2 className="size-3" />
                              Đã mua hàng
                            </span>
                            {item.contentEditedAt && (
                              <span className="rounded bg-[#eee6d5] px-1.5 py-0.5 text-[10px] text-[#826438]">
                                Đã chỉnh sửa
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2">
                            <RatingStars value={item.rating} />
                            {item.originalRating != null && (
                              <span className="text-xs text-[#81765e]">
                                Đã sửa từ {item.originalRating}★
                              </span>
                            )}
                            {item.variantName && (
                              <span className="text-xs text-[#81765e]">
                                · Phân loại: <strong>{item.variantName}</strong>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <time
                        dateTime={item.createdAt}
                        className="text-xs text-[#81765e]"
                      >
                        {formatDate(item.createdAt)}
                      </time>
                    </header>

                    <p className="mt-3 text-sm leading-relaxed text-[#41392d] whitespace-pre-line">
                      {item.content}
                    </p>

                    {/* Vòng 1: Phản hồi của nhân viên Cocoon (nếu có) */}
                    {round1Replies.length > 0 && (
                      <div className="mt-4 space-y-2 border-t border-[#dfd7c5]/60 pt-3">
                        {round1Replies.map((reply) => (
                          <div
                            key={reply.id}
                            className="rounded-md border-l-2 border-[#9c7c42] bg-[#f8f5ee] p-3 text-xs leading-relaxed text-[#302a20]"
                          >
                            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                              <span className="flex items-center gap-1.5 font-semibold text-[#806b3f]">
                                <CornerDownRight className="size-3.5 text-[#9c7c42]" />
                                Phản hồi từ Cocoon ({reply.staffName})
                              </span>
                              <time
                                dateTime={reply.createdAt}
                                className="text-[11px] text-[#81765e]"
                              >
                                {formatDate(reply.createdAt)}
                              </time>
                            </div>
                            <p className="mt-1 whitespace-pre-line text-[#41392d]">
                              {reply.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Ý kiến bổ sung của khách hàng (nếu có) */}
                    {item.followUp && (
                      <div className="mt-3 rounded-md border-l-2 border-[#81745e] bg-[#fbf9f4] p-3 text-xs leading-relaxed text-[#302a20]">
                        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 font-semibold text-[#6b5530]">
                            <MessageSquare className="size-3.5 text-[#81745e]" />
                            Ý kiến bổ sung của khách hàng ({item.customerName})
                          </span>
                          <time
                            dateTime={item.followUp.createdAt}
                            className="text-[11px] text-[#81765e]"
                          >
                            {formatDate(item.followUp.createdAt)}
                          </time>
                        </div>
                        <p className="mt-1 whitespace-pre-line text-[#41392d]">
                          {item.followUp.content}
                        </p>
                      </div>
                    )}

                    {/* Vòng 2: Giải đáp từ Cocoon cho ý kiến bổ sung (nếu có) */}
                    {round2Replies.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {round2Replies.map((reply) => (
                          <div
                            key={reply.id}
                            className="rounded-md border-l-2 border-[#9c7c42] bg-[#f8f5ee] p-3 text-xs leading-relaxed text-[#302a20]"
                          >
                            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                              <span className="flex items-center gap-1.5 font-semibold text-[#806b3f]">
                                <CornerDownRight className="size-3.5 text-[#9c7c42]" />
                                Giải đáp từ Cocoon ({reply.staffName})
                              </span>
                              <time
                                dateTime={reply.createdAt}
                                className="text-[11px] text-[#81765e]"
                              >
                                {formatDate(reply.createdAt)}
                              </time>
                            </div>
                            <p className="mt-1 whitespace-pre-line text-[#41392d]">
                              {reply.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}

              {reviews.length < totalReviews && (
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="inline-flex min-h-11 items-center justify-center rounded border border-[#d5cab4] bg-[#fffdf7] px-6 text-xs font-semibold uppercase tracking-wider text-[#211e18] transition-colors hover:border-[#9c7c42] hover:bg-[#fbf9f4] disabled:opacity-50"
                  >
                    {loadingMore ? "Đang tải thêm…" : `Xem thêm nhận xét (${totalReviews - reviews.length} nhận xét còn lại)`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
