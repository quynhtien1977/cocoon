"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowRight, Check, CircleCheck, Info, Plus, Rocket, Search, X } from "lucide-react";
import { ConfirmDialog } from "@/components/brand/confirm-dialog";
import { EmptyState } from "@/components/brand/empty-state";
import { PageHeader } from "@/components/brand/page-header";
import { StatusBadge } from "@/components/brand/status-badge";
import { emptySegmentFilter, matchesSegment, SegmentFilterBuilder, segmentAgeError, type SegmentCustomer, type SegmentOption } from "@/components/data/segment-filter-builder";
import { Button, buttonVariants } from "@/components/ui/button";
import { screen } from "@/lib/screens";
import { cn } from "@/lib/utils";
import { MAX_PLAN_PRODUCTS, segmentSummary, toPlanUpsertRequest, validatePlanDetails } from "../schemas";
import type { PlanDraft, PlanProduct } from "../types";

const time = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" });
const date = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" });
const fieldClass = "min-h-12 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring aria-invalid:border-destructive";
const labelClass = "font-label text-sm uppercase tracking-wider text-muted-foreground";
const card = "min-w-0 rounded-lg border border-border bg-card p-4 sm:p-6";
const SAMPLE_SIZE = 5;
const steps = [["Thông tin chung", "Tên, mục tiêu và thời gian"], ["Phân khúc khách hàng", "Chọn nhóm khách nhận gợi ý"], ["Lựa chọn sản phẩm", "Chọn và sắp xếp sản phẩm"]];

const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();
const showDate = (value: string) => value ? date.format(new Date(`${value}T12:00:00+07:00`)) : "Chưa chọn";
const emptyDraft = (): PlanDraft => ({ name: "", goal: "", startAt: "", endAt: "", segment: emptySegmentFilter(), productIds: [] });

export interface PlanEditorProps {
  /** Existing Draft plan for /plans/[id]; omit for /plans/new. */
  initial?: PlanDraft;
  planId?: number;
  products: readonly PlanProduct[];
  customers: readonly SegmentCustomer[];
  preferences: readonly SegmentOption[];
  categories: readonly SegmentOption[];
}

export function PlanEditor({ initial, planId, products, customers, preferences, categories }: PlanEditorProps) {
  const s = screen("M14");
  const id = useId();
  const [draft, setDraft] = useState<PlanDraft>(() => initial ?? emptyDraft());
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [activated, setActivated] = useState(false);
  const [query, setQuery] = useState("");
  const update = (patch: Partial<PlanDraft>) => { setDraft((current) => ({ ...current, ...patch })); setProblem(null); setSavedAt(null); };

  const ageError = segmentAgeError(draft.segment);
  const matched = ageError ? [] : customers.filter((customer) => matchesSegment(customer, draft.segment));
  const selected = draft.productIds.flatMap((productId) => products.find((item) => item.id === productId) ?? []);
  const needle = normalize(query.trim());
  const available = products.filter((item) => !draft.productIds.includes(item.id) && normalize(`${item.name} ${item.categoryName}`).includes(needle));

  /** First step whose required data is missing, or null. Reports its problem on the way. */
  function firstInvalid(upTo: number): number | null {
    const found = validatePlanDetails(draft);
    setErrors(found);
    if (Object.keys(found).length) { setProblem("Còn thiếu thông tin ở bước 1. Sửa các ô được đánh dấu rồi thử lại."); return 0; }
    if (upTo >= 1 && ageError) { setProblem("Khoảng tuổi không hợp lệ. Sửa khoảng tuổi rồi thử lại."); return 1; }
    setProblem(null);
    return null;
  }

  function goTo(next: number) {
    if (next > step) {
      const invalid = firstInvalid(next - 1);
      if (invalid !== null) { setStep(invalid); return; }
    } else setProblem(null);
    setStep(next);
  }

  function save() {
    const invalid = firstInvalid(0);
    if (invalid !== null) { setStep(invalid); return; }
    // Static phase: the request body is built to check the contract but not sent until api.ts lands.
    toPlanUpsertRequest(draft);
    setSavedAt(new Date());
  }

  function reviewActivation() {
    const invalid = firstInvalid(1);
    if (invalid !== null) { setStep(invalid); return; }
    if (matched.length === 0) { setStep(1); setProblem("Chưa kích hoạt được: không có khách phù hợp. Bỏ bớt tiêu chí rồi thử lại."); return; }
    if (draft.productIds.length === 0) { setStep(2); setProblem("Chưa kích hoạt được: chưa chọn sản phẩm. Chọn ít nhất một sản phẩm rồi thử lại."); return; }
    setConfirming(true);
  }

  const move = (index: number, offset: -1 | 1) => {
    const ids = [...draft.productIds];
    [ids[index], ids[index + offset]] = [ids[index + offset], ids[index]];
    update({ productIds: ids });
  };
  const add = (productId: number) => {
    if (draft.productIds.length >= MAX_PLAN_PRODUCTS) { setProblem(`Đã đủ tối đa ${MAX_PLAN_PRODUCTS} sản phẩm. Bỏ bớt một sản phẩm rồi chọn lại.`); return; }
    update({ productIds: [...draft.productIds, productId] });
  };

  if (activated) {
    return (
      <>
        <PageHeader eyebrow={s.code} title="Đã kích hoạt kế hoạch" description={draft.name.trim()} actions={<StatusBadge kind="recommendationPlan" status="Active" />} />
        <section role="status" className={card}>
          <p className="flex gap-2 text-status-sage-fg"><CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />Kế hoạch áp dụng cho {matched.length} khách hàng với {selected.length} sản phẩm (dữ liệu mẫu, chưa gửi máy chủ).</p>
          <Link href="/manager/recommendations" className={cn(buttonVariants(), "mt-4 h-12 px-4")}>Về tổng quan gợi ý</Link>
        </section>
      </>
    );
  }

  const fieldError = (name: string) => errors[name] && <p id={`${id}-${name}-error`} className="text-sm text-destructive">{errors[name]}</p>;
  const describedBy = (name: string) => errors[name] ? `${id}-${name}-error` : undefined;

  return (
    <>
      <Link href="/manager/recommendations" className="mb-3 inline-flex min-h-12 items-center gap-1 font-label text-sm uppercase tracking-wider text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden="true" />Tổng quan gợi ý</Link>
      <PageHeader eyebrow={planId ? `${s.code} · KP-${planId}` : s.code} title={planId ? "Sửa kế hoạch gợi ý" : "Tạo kế hoạch gợi ý sản phẩm"} description="Thiết lập sản phẩm hiển thị trong mục Gợi ý cho bạn của nhóm khách hàng phù hợp." actions={<StatusBadge kind="recommendationPlan" status="Draft" />} />

      <ol aria-label="Các bước tạo kế hoạch" className={cn(card, "mb-6 grid gap-2 md:grid-cols-3")}>
        {steps.map(([title, hint], index) => (
          <li key={title}>
            <button type="button" aria-current={index === step ? "step" : undefined} onClick={() => goTo(index)} className={cn("flex min-h-12 w-full items-center gap-3 rounded-md border p-3 text-left focus-visible:outline-2 focus-visible:outline-ring", index === step ? "border-gold bg-status-beige-bg" : "border-transparent hover:bg-muted")}>
              <span aria-hidden="true" className={cn("flex size-8 shrink-0 items-center justify-center rounded-md text-sm font-bold", index < step ? "bg-status-sage-bg text-status-sage-fg" : index === step ? "bg-primary text-primary-foreground" : "border border-input text-muted-foreground")}>{index < step ? <Check className="size-4" /> : index + 1}</span>
              <span className="min-w-0"><span className="block font-semibold">{index + 1}. {title}</span><span className="block text-xs text-muted-foreground">{hint}</span></span>
            </button>
          </li>
        ))}
      </ol>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <aside aria-labelledby={`${id}-summary`} className={cn(card, "order-last space-y-4 lg:sticky lg:top-6 lg:order-first")}>
          <h2 id={`${id}-summary`} className="border-b border-border pb-3 font-heading text-lg">Hồ sơ kế hoạch</h2>
          <dl className="space-y-3 text-sm">
            <div><dt className="text-muted-foreground">Tên kế hoạch</dt><dd className="font-semibold break-words">{draft.name.trim() || "Chưa đặt tên"}</dd></div>
            <div className="grid grid-cols-2 gap-3"><div><dt className="text-muted-foreground">Bắt đầu</dt><dd className="font-semibold">{showDate(draft.startAt)}</dd></div><div><dt className="text-muted-foreground">Kết thúc</dt><dd className="font-semibold">{showDate(draft.endAt)}</dd></div></div>
            <div><dt className="text-muted-foreground">Phân khúc</dt><dd>{segmentSummary(draft.segment, preferences, categories)}</dd></div>
            <div className="flex items-baseline justify-between gap-3 border-t border-border pt-3"><dt className="text-muted-foreground">Khách phù hợp</dt><dd className="font-heading text-2xl lining-nums tabular-nums">{matched.length}</dd></div>
            <div className="flex items-baseline justify-between gap-3"><dt className="text-muted-foreground">Sản phẩm đã chọn</dt><dd className="font-semibold tabular-nums">{selected.length}/{MAX_PLAN_PRODUCTS}</dd></div>
          </dl>
          <p className="flex gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground"><Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />Chỉ bản nháp mới sửa được. Sản phẩm hiển thị theo thứ tự ưu tiên từ trên xuống.</p>
        </aside>

        <div className="min-w-0 space-y-6">
          {step === 0 && (
            <section aria-labelledby={`${id}-details`} className={cn(card, "space-y-6")}>
              <h2 id={`${id}-details`} className="border-b border-border pb-3 font-heading text-xl">Thông tin chung</h2>
              <div className="space-y-2">
                <label htmlFor={`${id}-name`} className={labelClass}>Tên kế hoạch <span aria-hidden="true" className="text-destructive">*</span></label>
                <input id={`${id}-name`} value={draft.name} maxLength={120} required onChange={(event) => update({ name: event.target.value })} aria-invalid={!!errors.name} aria-describedby={describedBy("name")} className={fieldClass} />
                {fieldError("name")}
              </div>
              <div className="space-y-2">
                <label htmlFor={`${id}-goal`} className={labelClass}>Mục tiêu</label>
                <textarea id={`${id}-goal`} value={draft.goal} rows={3} placeholder="Ví dụ: Đẩy dòng sen Hậu Giang cho khách da nhạy cảm" onChange={(event) => update({ goal: event.target.value })} className={cn(fieldClass, "py-3")} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor={`${id}-start`} className={labelClass}>Ngày bắt đầu <span aria-hidden="true" className="text-destructive">*</span></label>
                  <input id={`${id}-start`} type="date" value={draft.startAt} required onChange={(event) => update({ startAt: event.target.value })} aria-invalid={!!errors.startAt} aria-describedby={describedBy("startAt")} className={fieldClass} />
                  {fieldError("startAt")}
                </div>
                <div className="space-y-2">
                  <label htmlFor={`${id}-end`} className={labelClass}>Ngày kết thúc <span aria-hidden="true" className="text-destructive">*</span></label>
                  <input id={`${id}-end`} type="date" value={draft.endAt} min={draft.startAt || undefined} required onChange={(event) => update({ endAt: event.target.value })} aria-invalid={!!errors.endAt} aria-describedby={describedBy("endAt")} className={fieldClass} />
                  {fieldError("endAt")}
                </div>
              </div>
            </section>
          )}

          {step === 1 && (
            <>
              <SegmentFilterBuilder value={draft.segment} onChange={(segment) => update({ segment })} preferences={preferences} categories={categories} matchCount={matched.length} />
              <section aria-labelledby={`${id}-sample`} className={card}>
                <h2 id={`${id}-sample`} className="font-heading text-lg">Khách hàng mẫu</h2>
                {matched.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Chưa có khách phù hợp. Bỏ bớt tiêu chí để mở rộng phân khúc.</p> : (
                  <ul className="mt-2 divide-y divide-border">
                    {matched.slice(0, SAMPLE_SIZE).map((customer) => <li key={customer.id} className="flex flex-wrap justify-between gap-x-3 py-2 text-sm"><span className="min-w-0"><span className="block font-semibold">{customer.fullName}</span><span className="block break-words text-muted-foreground">{customer.email}</span></span><span className="text-muted-foreground">{customer.daysSinceLastOrder === null ? "Chưa mua" : `Mua ${customer.daysSinceLastOrder} ngày trước`}</span></li>)}
                  </ul>
                )}
              </section>
            </>
          )}

          {step === 2 && (
            <>
              <section aria-labelledby={`${id}-selected`} className={card}>
                <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-3">
                  <h2 id={`${id}-selected`} className="font-heading text-xl">Sản phẩm trong kế hoạch</h2>
                  <span className="font-label text-sm uppercase tracking-wider text-muted-foreground">{selected.length}/{MAX_PLAN_PRODUCTS} đã chọn</span>
                </header>
                {selected.length === 0 ? <EmptyState title="Chưa chọn sản phẩm" description="Chọn sản phẩm từ danh sách bên dưới." className="mt-4 border-0 py-6" /> : (
                  <ol className="mt-4 space-y-3">
                    {selected.map((product, index) => (
                      <li key={product.id} className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3">
                        <span aria-hidden="true" className={cn("flex size-8 shrink-0 items-center justify-center rounded-md text-sm font-bold", index === 0 ? "bg-primary text-primary-foreground" : "bg-muted")}>{index + 1}</span>
                        <span className="min-w-40 flex-1"><span className="block font-semibold">{product.name}</span><span className="block text-xs text-muted-foreground">{product.categoryName} · {product.preferences.join(", ")}</span></span>
                        <span className="flex gap-1">
                          {index > 0 && <Button type="button" variant="ghost" size="icon-lg" className="size-12" aria-label={`Đưa ${product.name} lên trên`} onClick={() => move(index, -1)}><ArrowDown className="rotate-180" aria-hidden="true" /></Button>}
                          {index < selected.length - 1 && <Button type="button" variant="ghost" size="icon-lg" className="size-12" aria-label={`Đưa ${product.name} xuống dưới`} onClick={() => move(index, 1)}><ArrowDown aria-hidden="true" /></Button>}
                          <Button type="button" variant="ghost" size="icon-lg" className="size-12 text-destructive" aria-label={`Bỏ chọn ${product.name}`} onClick={() => update({ productIds: draft.productIds.filter((item) => item !== product.id) })}><X aria-hidden="true" /></Button>
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
              <section aria-labelledby={`${id}-catalog`} className={card}>
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                  <h2 id={`${id}-catalog`} className="font-heading text-lg">Sản phẩm khả dụng</h2>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Tìm sản phẩm theo tên hoặc danh mục" placeholder="Tìm sản phẩm" className={cn(fieldClass, "pl-9")} />
                  </div>
                </header>
                {available.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Không có sản phẩm phù hợp.</p> : (
                  <ul className="mt-1 divide-y divide-border">
                    {available.map((product) => (
                      <li key={product.id} className="flex items-center justify-between gap-3 py-2">
                        <span className="min-w-0"><span className="block text-sm font-semibold">{product.name}</span><span className="block text-xs text-muted-foreground">{product.categoryName}</span></span>
                        <Button type="button" variant="outline" className="min-h-12 shrink-0 px-3 font-label uppercase tracking-wider" aria-label={`Chọn ${product.name}`} onClick={() => add(product.id)}><Plus aria-hidden="true" />Chọn</Button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      <footer className="mt-8 border-t border-border pt-6">
        <div aria-live="polite" className="mb-4 text-sm empty:hidden">
          {problem ? <p role="alert" className="text-destructive">{problem}</p> : savedAt ? <p className="flex items-center gap-2 text-status-sage-fg"><CircleCheck className="size-4" aria-hidden="true" />Đã lưu bản nháp lúc {time.format(savedAt)} (dữ liệu mẫu, chưa gửi máy chủ).</p> : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {step > 0 ? <Button type="button" variant="ghost" className="h-12 px-4" onClick={() => goTo(step - 1)}><ArrowLeft aria-hidden="true" />Quay lại bước {step}</Button> : <Link href="/manager/recommendations" className={cn(buttonVariants({ variant: "ghost" }), "h-12 px-4")}>Hủy</Link>}
          <div className="flex w-full flex-wrap gap-3 sm:w-auto">
            <Button type="button" variant="outline" className="h-12 flex-1 px-6 sm:flex-none" onClick={save}>Lưu bản nháp</Button>
            {step < steps.length - 1
              ? <Button type="button" className="h-12 flex-1 px-6 sm:flex-none" onClick={() => goTo(step + 1)}>Tiếp tục<ArrowRight aria-hidden="true" /></Button>
              : <Button type="button" className="h-12 flex-1 px-6 sm:flex-none" onClick={reviewActivation}><Rocket aria-hidden="true" />Kích hoạt kế hoạch</Button>}
          </div>
        </div>
      </footer>
      <ConfirmDialog portal="manager" appearance="soft" open={confirming} onOpenChange={setConfirming} icon={<Rocket className="size-4" />} eyebrow="Xác nhận kích hoạt" title="Kích hoạt kế hoạch gợi ý?" confirmLabel="Kích hoạt ngay"
        description={`${selected.length} sản phẩm sẽ hiển thị ở mục Gợi ý cho bạn của ${matched.length} khách hàng, và các khách này sẽ nhận thông báo trong ứng dụng.`} onConfirm={() => { toPlanUpsertRequest(draft); setActivated(true); }}>
        <ol className="space-y-1 rounded-md bg-muted p-3 text-sm">{selected.map((product, index) => <li key={product.id}>{index + 1}. {product.name}</li>)}</ol>
      </ConfirmDialog>
    </>
  );
}
