"use client";

import { useCallback, useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronsDownUp, ChevronsUpDown, CircleCheck, Info, ListChecks, Plus, SlidersHorizontal } from "lucide-react";
import { EmptyState } from "@/components/brand/empty-state";
import { PageHeader } from "@/components/brand/page-header";
import { StatusBadge } from "@/components/brand/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { useApiData } from "@/lib/api/use-api-data";
import { cn } from "@/lib/utils";
import { createSurvey, loadBuilder, updateSurvey } from "../api";
import { newQuestion, QuestionEditor } from "../question-editor";
import { purposeLabels, validateSurveyDraft } from "../schemas";
import type { PreferenceOption, SurveyDraft, SurveyPurpose, UpcomingProduct } from "../types";
import { fieldClass, labelClass } from "./form-styles";
import { LoadState } from "./load-state";
import { SurveyPreview } from "./survey-preview";

const time = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" });

const emptyDraft = (): SurveyDraft => ({ title: "", description: "", purpose: "Satisfaction", productId: null, openAt: "", closeAt: "", questions: [newQuestion()] });

/** M8 route body: /surveys/new without an id, /surveys/[id]/edit with one. */
export function SurveyBuilderPage({ id }: { id?: number }) {
  const load = useCallback((signal: AbortSignal) => loadBuilder(id, signal), [id]);
  const { data, loading, error, missing, retry } = useApiData(load, "Chưa tải được khảo sát. Kiểm tra kết nối rồi thử lại.");
  const back = <Link href="/manager/surveys" className="mb-3 inline-flex min-h-12 items-center gap-1 font-label text-sm uppercase tracking-wider text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden="true" />Danh sách khảo sát</Link>;
  if (!data) return <>{back}<LoadState loading={loading} missing={missing} error={error} retry={retry} label="khảo sát" /></>;
  if (data.status && data.status !== "Draft") return <>{back}<EmptyState title="Không sửa được khảo sát" description="Khảo sát đã mở nên câu hỏi bị khóa. Muốn đổi câu hỏi hãy tạo khảo sát mới."
    action={<Link href="/manager/surveys" className={cn(buttonVariants(), "h-12 px-4")}>Về danh sách khảo sát</Link>} /></>;
  return <>{back}<SurveyBuilder initial={data.draft} surveyId={data.surveyId} preferences={data.preferences} products={data.products} /></>;
}

export interface SurveyBuilderProps {
  /** Existing Draft survey for /surveys/[id]/edit; omit for /surveys/new. */
  initial?: SurveyDraft;
  surveyId?: number;
  preferences: readonly PreferenceOption[];
  /** Products with status Upcoming, for the NewProduct purpose. */
  products: readonly UpcomingProduct[];
}

export function SurveyBuilder({ initial, surveyId, preferences, products }: SurveyBuilderProps) {
  const id = useId();
  const [draft, setDraft] = useState<SurveyDraft>(() => initial ?? emptyDraft());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [savedId, setSavedId] = useState(surveyId);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const update = (patch: Partial<SurveyDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const questionErrors = (index: number) => Object.fromEntries(Object.entries(errors)
    .filter(([path]) => path.startsWith(`questions.${index}.`))
    .map(([path, message]) => [path.slice(`questions.${index}.`.length), message]));
  const errorCount = Object.keys(errors).length;

  const moveQuestion = (index: number, offset: -1 | 1) => setDraft((current) => {
    const questions = [...current.questions];
    [questions[index], questions[index + offset]] = [questions[index + offset], questions[index]];
    return { ...current, questions };
  });

  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const found = validateSurveyDraft(draft);
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length) { setSavedAt(null); return; }
    setSaving(true);
    try {
      // After the first create, later saves update the same draft instead of creating another.
      const saved = savedId === undefined ? await createSurvey(draft) : await updateSurvey(savedId, draft);
      setSavedId(saved.id);
      setSavedAt(new Date());
    } catch (reason) {
      setSavedAt(null);
      setServerError(reason instanceof ApiError ? reason.message : "Không kết nối được máy chủ. Thử lại sau.");
    } finally {
      setSaving(false);
    }
  }

  const fieldError = (name: string) => errors[name] && <p id={`${id}-${name}-error`} className="text-sm text-destructive">{errors[name]}</p>;
  const describedBy = (name: string) => errors[name] ? `${id}-${name}-error` : undefined;

  return (
    <form onSubmit={save} noValidate>
      <PageHeader title={initial ? "Sửa khảo sát" : "Tạo khảo sát"} description="Câu hỏi 4 loại; lựa chọn có thể gắn sở thích để cập nhật hồ sơ khách khi họ trả lời."
        actions={<StatusBadge kind="survey" status="Draft" />} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section aria-labelledby={`${id}-config`} className="space-y-6 rounded-lg border border-border bg-card p-4 sm:p-6 lg:sticky lg:top-22">
          <h2 id={`${id}-config`} className="flex items-center gap-2 border-b border-border pb-4 font-heading text-xl"><SlidersHorizontal className="size-5 text-gold-strong" aria-hidden="true" />Thông tin khảo sát</h2>

          <div className="space-y-2">
            <label htmlFor={`${id}-title`} className={labelClass}>Tên khảo sát <span aria-hidden="true" className="text-destructive">*</span></label>
            <input id={`${id}-title`} value={draft.title} onChange={(event) => update({ title: event.target.value })} maxLength={200} required
              aria-invalid={!!errors.title} aria-describedby={describedBy("title")} className={fieldClass} />
            {fieldError("title")}
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor={`${id}-description`} className={labelClass}>Mô tả</label>
              <span id={`${id}-description-count`} className="text-xs tabular-nums text-muted-foreground">{draft.description.length}/1000</span>
            </div>
            <textarea id={`${id}-description`} value={draft.description} onChange={(event) => update({ description: event.target.value })} maxLength={1000} rows={4}
              aria-describedby={`${id}-description-count`} className={cn(fieldClass, "py-3")} />
          </div>

          <div className="space-y-2">
            <label htmlFor={`${id}-purpose`} className={labelClass}>Mục đích <span aria-hidden="true" className="text-destructive">*</span></label>
            <select id={`${id}-purpose`} value={draft.purpose} onChange={(event) => { const purpose = event.target.value as SurveyPurpose; update({ purpose, productId: purpose === "NewProduct" ? draft.productId : null }); }} className={fieldClass}>
              {(Object.keys(purposeLabels) as SurveyPurpose[]).map((purpose) => <option key={purpose} value={purpose}>{purposeLabels[purpose]}</option>)}
            </select>
          </div>

          {draft.purpose === "NewProduct" && (
            <div className="space-y-2 rounded-md border border-border bg-muted p-4">
              <label htmlFor={`${id}-product`} className={labelClass}>Sản phẩm sắp ra mắt <span aria-hidden="true" className="text-destructive">*</span></label>
              <select id={`${id}-product`} value={draft.productId ?? ""} onChange={(event) => update({ productId: event.target.value ? Number(event.target.value) : null })}
                aria-invalid={!!errors.productId} aria-describedby={describedBy("productId")} className={fieldClass}>
                <option value="">Chọn sản phẩm</option>
                {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
              </select>
              {fieldError("productId")}
              <p className="text-xs text-muted-foreground">Chỉ hiện sản phẩm có trạng thái Sắp ra mắt.</p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor={`${id}-openAt`} className={labelClass}>Ngày mở</label>
              <input id={`${id}-openAt`} type="date" value={draft.openAt} onChange={(event) => update({ openAt: event.target.value })} className={fieldClass} />
            </div>
            <div className="space-y-2">
              <label htmlFor={`${id}-closeAt`} className={labelClass}>Ngày đóng</label>
              <input id={`${id}-closeAt`} type="date" value={draft.closeAt} min={draft.openAt || undefined} onChange={(event) => update({ closeAt: event.target.value })}
                aria-invalid={!!errors.closeAt} aria-describedby={describedBy("closeAt")} className={fieldClass} />
              {fieldError("closeAt")}
            </div>
          </div>

          <p className="flex gap-2 rounded-md border border-border bg-muted p-4 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Khảo sát chỉ sửa được khi còn là bản nháp. Sau khi mở, câu hỏi và lựa chọn được khóa.
          </p>
        </section>

        <section aria-labelledby={`${id}-questions`} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-x-3 border-b border-border pb-2">
            <h2 id={`${id}-questions`} className="flex items-center gap-2 font-heading text-xl">
              <ListChecks className="size-5 text-gold-strong" aria-hidden="true" />Câu hỏi
              <span className="rounded-sm bg-muted px-2 py-0.5 font-label text-xs uppercase tracking-wider text-muted-foreground">{draft.questions.length} câu</span>
            </h2>
            <Button type="button" variant="ghost" className="min-h-12 px-2 font-label uppercase tracking-wider text-muted-foreground" aria-pressed={collapsed} onClick={() => setCollapsed((value) => !value)}>
              {collapsed ? <><ChevronsUpDown aria-hidden="true" />Mở rộng tất cả</> : <><ChevronsDownUp aria-hidden="true" />Thu gọn tất cả</>}
            </Button>
          </div>
          {errors.questions && <p role="alert" className="text-sm text-destructive">{errors.questions}</p>}
          {draft.questions.map((question, index) => (
            <QuestionEditor key={question.key} index={index} total={draft.questions.length} question={question} preferences={preferences} errors={questionErrors(index)} collapsed={collapsed}
              onChange={(next) => setDraft((current) => ({ ...current, questions: current.questions.map((item, i) => i === index ? next : item) }))}
              onRemove={() => setDraft((current) => ({ ...current, questions: current.questions.filter((_, i) => i !== index) }))}
              onMove={(offset) => moveQuestion(index, offset)} />
          ))}
          <Button type="button" variant="outline" className="min-h-16 w-full border-2 border-dashed border-input bg-transparent font-label uppercase tracking-wider hover:border-gold hover:bg-card" onClick={() => { setCollapsed(false); update({ questions: [...draft.questions, newQuestion()] }); }}>
            <Plus aria-hidden="true" />Thêm câu hỏi
          </Button>
        </section>
      </div>

      <footer className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
        <div aria-live="polite" className="text-sm">
          {errorCount > 0 ? <p className="text-destructive">Chưa lưu được: còn {errorCount} lỗi. Sửa các ô được đánh dấu rồi lưu lại.</p>
            : serverError ? <p role="alert" className="text-destructive">Chưa lưu được: {serverError}</p>
            : savedAt ? <p className="flex flex-wrap items-center gap-2 text-status-sage-fg"><CircleCheck className="size-4" aria-hidden="true" />Đã lưu bản nháp lúc {time.format(savedAt)}.
              <Link href={`/manager/surveys/${savedId}/send`} className="font-semibold text-foreground underline underline-offset-4">Gửi khảo sát</Link></p>
            : null}
        </div>
        <div className="flex w-full flex-wrap gap-3 sm:w-auto">
          <Link href="/manager/surveys" className={cn(buttonVariants({ variant: "ghost" }), "h-12 px-4")}>Hủy</Link>
          <Button type="submit" variant="outline" className="h-12 flex-1 px-6 sm:flex-none" disabled={saving}>{saving ? "Đang lưu…" : "Lưu bản nháp"}</Button>
          <SurveyPreview draft={draft} products={products} />
        </div>
      </footer>
    </form>
  );
}
