"use client";

import { Children, Fragment, isValidElement, useState, type ReactNode } from "react";
import Link from "next/link";
import { ImageOff } from "lucide-react";
import { RatingStars } from "@/components/brand/rating-stars";
import { cn } from "@/lib/utils";

export interface ProductCardProps {
  name: string;
  href?: string;
  imageUrl?: string | null;
  imageAlt?: string;
  minPrice: number | null;
  avgRating?: number | null;
  /** Pass ReasonChip elements (an array or fragment). Only the first two render. */
  reason?: ReactNode;
  action?: ReactNode;
  className?: string;
}

function flattenReasons(reason: ReactNode): ReactNode[] {
  return Children.toArray(reason).flatMap((child) => isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment ? flattenReasons(child.props.children) : [child]);
}

export function ProductCard({ name, href, imageUrl, imageAlt, minPrice, avgRating = null, reason, action, className }: ProductCardProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const hasImage = !!imageUrl && failedSource !== imageUrl;
  const price = minPrice !== null && Number.isFinite(minPrice) && minPrice >= 0
    ? new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(minPrice)
    : null;
  const reasons = flattenReasons(reason).slice(0, 2);

  return (
    <article className={cn("flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground", className)}>
      <div className="relative aspect-square overflow-hidden bg-muted">
        {hasImage ? (
          // Product media URLs come from the caller; no image proxy or remote-host allowlist is assumed.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl!} alt={imageAlt ?? name} width={512} height={512} loading="lazy" decoding="async"
            className="absolute inset-0 h-full w-full object-contain p-4" onError={() => setFailedSource(imageUrl!)} />
        ) : (
          <div role="img" aria-label="Chưa có ảnh sản phẩm" className="flex h-full flex-col items-center justify-center gap-3 p-4 text-muted-foreground">
            <ImageOff aria-hidden="true" className="size-8" strokeWidth={1.5} />
            <span className="text-center text-sm">Chưa có ảnh sản phẩm</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="font-heading text-lg leading-snug break-words">
          {href ? <Link href={href} className="underline-offset-4 hover:underline">{name}</Link> : name}
        </h3>
        <p className="text-sm font-bold tabular-nums">{price === null ? "Chưa có giá" : `Từ ${price}`}</p>
        <RatingStars value={avgRating} />
        {reasons.length > 0 && <div aria-label="Lý do gợi ý" className="flex flex-wrap gap-2">{reasons}</div>}
        {action && <div className="mt-auto flex flex-wrap gap-2 pt-1">{action}</div>}
      </div>
    </article>
  );
}
