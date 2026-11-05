"use client";

import Link from "next/link";
import { EmptyState } from "@/components/brand/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Loading, 404 and error states shared by the M8–M10 route loaders (same as M4). */
export function LoadState({ loading, missing, error, retry, label }: { loading: boolean; missing: boolean; error: string | null; retry: () => void; label: string }) {
  if (loading) return <div role="status" className="space-y-4"><span className="sr-only">Đang tải {label}</span><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (missing) return <EmptyState title="Không tìm thấy khảo sát" description="Khảo sát không tồn tại hoặc đã bị xóa." action={<Link href="/manager/surveys" className={cn(buttonVariants(), "h-12 px-4")}>Về danh sách khảo sát</Link>} />;
  return <div role="alert"><EmptyState title={`Chưa tải được ${label}`} description={error ?? "Hãy thử lại."} action={<Button type="button" className="h-12 px-4" onClick={retry}>Thử lại</Button>} /></div>;
}
