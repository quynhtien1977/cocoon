import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RatingStarsProps {
  value: number | null;
  className?: string;
}

export function RatingStars({ value, className }: RatingStarsProps) {
  const rating = value !== null && Number.isFinite(value) && value > 0 ? Math.round(Math.min(5, value) * 10) / 10 : null;
  if (rating === null) return <span className={cn("text-sm text-muted-foreground", className)}>Chưa có đánh giá</span>;
  const formatted = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(rating);
  return (
    <span role="img" aria-label={`${formatted} trên 5 sao`} className={cn("inline-flex items-center gap-2 text-sm", className)}>
      <span aria-hidden="true" className="flex gap-1">
        {[0, 1, 2, 3, 4].map((index) => (
          <span key={index} className="relative size-4">
            <Star className="size-4 text-muted-foreground" strokeWidth={1.5} />
            <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${Math.max(0, Math.min(1, rating - index)) * 100}%` }}>
              <Star className="size-4 max-w-none fill-gold-strong text-gold-strong" strokeWidth={1.5} />
            </span>
          </span>
        ))}
      </span>
      <span aria-hidden="true" className="tabular-nums text-muted-foreground">{formatted}/5</span>
    </span>
  );
}
