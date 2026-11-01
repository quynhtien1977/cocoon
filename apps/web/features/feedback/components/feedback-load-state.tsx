import Link from "next/link";
import { EmptyState } from "@/components/brand/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Loading, missing and failed states of M6 and S2, before there is a feedback to show. */
export function FeedbackLoadState({ loading, missing, error, onRetry, backHref }: { loading: boolean; missing: boolean; error: string | null; onRetry: () => void; backHref: string }) {
  if (loading) return <div role="status" className="space-y-4"><span className="sr-only">Đang tải phản hồi</span><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (missing) return <EmptyState title="Không tìm thấy phản hồi" description="Phản hồi không tồn tại hoặc không được giao cho bạn." action={<Link href={backHref} className={cn(buttonVariants(), "h-12 px-4")}>Về danh sách phản hồi</Link>} />;
  return <div role="alert"><EmptyState title="Chưa tải được phản hồi" description={error ?? "Hãy thử lại."} action={<Button type="button" className="h-12 px-4" onClick={onRetry}>Thử lại</Button>} /></div>;
}
