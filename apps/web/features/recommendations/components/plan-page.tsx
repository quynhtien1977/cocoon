"use client";

import { useCallback } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/brand/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiData } from "@/lib/api/use-api-data";
import { cn } from "@/lib/utils";
import { loadPlanPage } from "../api";
import { toPlanDraft } from "../schemas";
import { PlanDetail } from "./plan-detail";
import { PlanEditor } from "./plan-editor";

/** M14 route body: a new plan without `id`; otherwise drafts open in the editor and other plans read-only. */
export function PlanPage({ id }: { id?: number }) {
  const load = useCallback((signal: AbortSignal) => loadPlanPage(id, signal), [id]);
  const { data, loading, error, missing, retry } = useApiData(load, "Chưa tải được kế hoạch gợi ý. Kiểm tra kết nối rồi thử lại.");
  if (data) {
    const { plan, ...lists } = data;
    if (!plan) return <PlanEditor {...lists} />;
    if (plan.status !== "Draft") return <PlanDetail initial={plan} {...lists} />;
    return <PlanEditor initial={toPlanDraft(plan)} planId={plan.id} {...lists} />;
  }
  if (loading) return <div role="status" className="space-y-4"><span className="sr-only">Đang tải kế hoạch gợi ý</span><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (missing) return <EmptyState title="Không tìm thấy kế hoạch" description="Kế hoạch không tồn tại hoặc đã bị xóa." action={<Link href="/manager/recommendations" className={cn(buttonVariants(), "h-12 px-4")}>Về tổng quan gợi ý</Link>} />;
  return <div role="alert"><EmptyState title="Chưa tải được kế hoạch" description={error ?? "Hãy thử lại."} action={<Button type="button" className="h-12 px-4" onClick={retry}>Thử lại</Button>} /></div>;
}
