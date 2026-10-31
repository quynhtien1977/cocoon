"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CircleCheck, Lock } from "lucide-react";
import { ConfirmDialog } from "@/components/brand/confirm-dialog";
import { PageHeader } from "@/components/brand/page-header";
import { StatusBadge } from "@/components/brand/status-badge";
import type { SegmentOption } from "@/components/data/segment-filter-builder";
import { Button } from "@/components/ui/button";
import { screen } from "@/lib/screens";
import { segmentSummary } from "../schemas";
import type { PlanProduct, RecommendationPlan } from "../types";

const date = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" });
const percent = new Intl.NumberFormat("vi-VN", { style: "percent", maximumFractionDigits: 1 });
const card = "min-w-0 rounded-lg border border-border bg-card p-4 sm:p-6";

/** Read-only view of an Active or Ended plan: only drafts can be edited. */
export function PlanDetail({ initial, products, preferences, categories }: { initial: RecommendationPlan; products: readonly PlanProduct[]; preferences: readonly SegmentOption[]; categories: readonly SegmentOption[] }) {
  const s = screen("M14");
  const [plan, setPlan] = useState(initial);
  const [ended, setEnded] = useState(false);
  const selected = plan.productIds.flatMap((id) => products.find((item) => item.id === id) ?? []);

  return (
    <>
      <Link href="/manager/recommendations" className="mb-3 inline-flex min-h-12 items-center gap-1 font-label text-sm uppercase tracking-wider text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden="true" />Tổng quan gợi ý</Link>
      <PageHeader eyebrow={`${s.code} · KP-${plan.id}`} title={plan.name} description={plan.goal ?? undefined} actions={<>
        <StatusBadge kind="recommendationPlan" status={plan.status} className="self-center whitespace-nowrap" />
        {plan.status === "Active" && (
          <ConfirmDialog portal="manager" title="Kết thúc kế hoạch?" description={`“${plan.name}” sẽ dừng ngay và không chạy lại được. Số liệu đã có vẫn được giữ.`} confirmLabel="Kết thúc kế hoạch"
            trigger={<Button type="button" variant="outline" className="h-12 px-4 text-destructive"><Lock aria-hidden="true" />Kết thúc kế hoạch</Button>} onConfirm={() => { setPlan((current) => ({ ...current, status: "Ended" })); setEnded(true); }} />
        )}
      </>} />
      <div aria-live="polite">{ended && <p className="mb-6 flex items-center gap-2 rounded-md border border-border bg-status-sage-bg p-3 text-sm text-status-sage-fg"><CircleCheck className="size-4 shrink-0" aria-hidden="true" />Đã kết thúc kế hoạch (dữ liệu mẫu, chưa gửi máy chủ).</p>}</div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section aria-labelledby="plan-info" className={card}>
          <h2 id="plan-info" className="border-b border-border pb-3 font-heading text-lg">Thông tin kế hoạch</h2>
          <dl className="mt-3 space-y-3 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Thời gian</dt><dd className="text-right font-semibold">{date.format(new Date(plan.startAt))} – {date.format(new Date(plan.endAt))}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Số khách</dt><dd className="font-semibold tabular-nums">{plan.recipientCount}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Tỷ lệ bấm</dt><dd className="font-semibold tabular-nums">{plan.clickRate === null ? "—" : percent.format(plan.clickRate)}</dd></div>
            <div><dt className="text-muted-foreground">Phân khúc</dt><dd className="mt-1">{segmentSummary(plan.segment, preferences, categories)}</dd></div>
          </dl>
        </section>
        <section aria-labelledby="plan-products" className={card}>
          <h2 id="plan-products" className="border-b border-border pb-3 font-heading text-lg">Sản phẩm theo thứ tự ưu tiên</h2>
          <ol className="mt-3 space-y-3">
            {selected.map((product, index) => <li key={product.id} className="flex items-center gap-3 text-sm"><span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted font-bold">{index + 1}</span><span className="min-w-0"><span className="block font-semibold">{product.name}</span><span className="block text-xs text-muted-foreground">{product.categoryName}</span></span></li>)}
          </ol>
        </section>
      </div>
    </>
  );
}
