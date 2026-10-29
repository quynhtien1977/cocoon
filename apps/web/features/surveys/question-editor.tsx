"use client";

import { useId } from "react";
import { ArrowDown, ArrowUp, Plus, Star, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fieldClass, labelClass } from "./components/form-styles";
import { isChoice, questionTypeLabels } from "./schemas";
import type { OptionDraft, PreferenceOption, QuestionDraft, QuestionType } from "./types";

let keySeed = 0;
/** Client-only key for new questions/options; never sent to the API. */
export const draftKey = (prefix: string) => `${prefix}-${++keySeed}`;

export interface QuestionEditorProps {
  index: number;
  total: number;
  question: QuestionDraft;
  preferences: readonly PreferenceOption[];
  /** Errors relative to this question: "text", "options", "options.1.text". */
  errors?: Record<string, string>;
  onChange: (question: QuestionDraft) => void;
  onRemove: () => void;
  onMove: (offset: -1 | 1) => void;
}

/** One block for the four QuestionType values (spec 4.5); choice options can tag a preference (spec 5.6 rule 4). */
export function QuestionEditor({ index, total, question, preferences, errors = {}, onChange, onRemove, onMove }: QuestionEditorProps) {
  const id = useId();
  const number = String(index + 1).padStart(2, "0");
  const update = (patch: Partial<QuestionDraft>) => onChange({ ...question, ...patch });
  const updateOption = (position: number, patch: Partial<OptionDraft>) => update({ options: question.options.map((option, i) => i === position ? { ...option, ...patch } : option) });
  const changeType = (type: QuestionType) => update({
    type,
    // Choice questions start with two blank options; other types never carry options.
    options: isChoice(type) ? (question.options.length ? question.options : [newOption(), newOption()]) : [],
  });

  return (
    <fieldset className="rounded-lg border border-border bg-card p-6" aria-describedby={errors.options ? `${id}-options-error` : undefined}>
      <legend className="sr-only">Câu {index + 1}</legend>
      <div className="flex flex-wrap items-center gap-3 border-b border-border pb-4">
        <span className="rounded-sm border border-gold px-2 py-1 font-label text-sm uppercase tracking-wider text-gold-strong">Câu {number}</span>
        <label htmlFor={`${id}-type`} className="sr-only">Loại câu hỏi</label>
        <select id={`${id}-type`} value={question.type} onChange={(event) => changeType(event.target.value as QuestionType)} className={cn(fieldClass, "w-auto")}>
          {(Object.keys(questionTypeLabels) as QuestionType[]).map((type) => <option key={type} value={type}>{questionTypeLabels[type]}</option>)}
        </select>
        <label className="ml-auto inline-flex min-h-12 items-center gap-2 font-label text-sm uppercase tracking-wider">
          <input type="checkbox" checked={question.isRequired} onChange={(event) => update({ isRequired: event.target.checked })} className="size-5 accent-gold-strong" />
          Bắt buộc
        </label>
        <span className="flex gap-1">
          <Button type="button" variant="ghost" size="icon-lg" className="size-12" disabled={index === 0} onClick={() => onMove(-1)} aria-label={`Đưa câu ${index + 1} lên`}><ArrowUp aria-hidden="true" /></Button>
          <Button type="button" variant="ghost" size="icon-lg" className="size-12" disabled={index === total - 1} onClick={() => onMove(1)} aria-label={`Đưa câu ${index + 1} xuống`}><ArrowDown aria-hidden="true" /></Button>
          <Button type="button" variant="ghost" size="icon-lg" className="size-12 text-destructive" onClick={onRemove} aria-label={`Xóa câu ${index + 1}`}><Trash2 aria-hidden="true" /></Button>
        </span>
      </div>

      <div className="mt-4 space-y-2">
        <label htmlFor={`${id}-text`} className={labelClass}>Nội dung câu hỏi</label>
        <input id={`${id}-text`} value={question.text} onChange={(event) => update({ text: event.target.value })} maxLength={500}
          aria-invalid={!!errors.text} aria-describedby={errors.text ? `${id}-text-error` : undefined} className={cn(fieldClass, "font-heading text-base")} />
        {errors.text && <p id={`${id}-text-error`} className="text-sm text-destructive">{errors.text}</p>}
      </div>

      {isChoice(question.type) && (
        <div className="mt-6 space-y-3">
          <p className={labelClass}>Lựa chọn</p>
          <ul className="space-y-3">
            {question.options.map((option, position) => {
              const optionError = errors[`options.${position}.text`];
              return (
                <li key={option.key} className="space-y-1">
                  <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,14rem)_auto]">
                    <span aria-hidden="true" className={cn("size-4 border border-input", question.type === "SingleChoice" ? "rounded-full" : "rounded-sm")} />
                    <label htmlFor={`${id}-option-${position}`} className="sr-only">Lựa chọn {position + 1}</label>
                    <input id={`${id}-option-${position}`} value={option.text} onChange={(event) => updateOption(position, { text: event.target.value })} maxLength={200} placeholder={`Lựa chọn ${position + 1}`}
                      aria-invalid={!!optionError} aria-describedby={optionError ? `${id}-option-${position}-error` : undefined} className={fieldClass} />
                    <label htmlFor={`${id}-preference-${position}`} className="sr-only">Gắn sở thích cho lựa chọn {position + 1}</label>
                    <select id={`${id}-preference-${position}`} value={option.preferenceId ?? ""} onChange={(event) => updateOption(position, { preferenceId: event.target.value ? Number(event.target.value) : null })}
                      className={cn(fieldClass, "col-start-2 sm:col-start-auto", option.preferenceId !== null && "border-gold bg-status-beige-bg text-status-beige-fg")}>
                      <option value="">Không gắn sở thích</option>
                      {preferences.map((preference) => <option key={preference.id} value={preference.id}># {preference.name}</option>)}
                    </select>
                    <Button type="button" variant="ghost" size="icon-lg" className="col-start-3 row-start-1 size-12 sm:col-start-auto" onClick={() => update({ options: question.options.filter((_, i) => i !== position) })} aria-label={`Xóa lựa chọn ${position + 1}`}><X aria-hidden="true" /></Button>
                  </div>
                  {optionError && <p id={`${id}-option-${position}-error`} className="pl-6 text-sm text-destructive">{optionError}</p>}
                </li>
              );
            })}
          </ul>
          {errors.options && <p id={`${id}-options-error`} className="text-sm text-destructive">{errors.options}</p>}
          <Button type="button" variant="ghost" className="min-h-12 px-3 font-label uppercase tracking-wider text-gold-strong" onClick={() => update({ options: [...question.options, newOption()] })}>
            <Plus aria-hidden="true" />Thêm lựa chọn
          </Button>
        </div>
      )}

      {question.type === "Rating" && (
        <div className="mt-6 rounded-md border border-border bg-muted p-4">
          <p className={labelClass}>Xem trước thang điểm</p>
          <div aria-hidden="true" className="mt-3 flex justify-around text-gold-strong">
            {[1, 2, 3, 4, 5].map((value) => <span key={value} className="flex flex-col items-center gap-1 text-xs text-muted-foreground"><Star className="size-6 text-gold-strong" strokeWidth={1.5} />{value} sao</span>)}
          </div>
          <p className="sr-only">Khách chọn từ 1 đến 5 sao.</p>
        </div>
      )}

      {question.type === "ShortText" && (
        <div className="mt-6 rounded-md border border-border bg-muted p-4">
          <p className={labelClass}>Xem trước ô trả lời</p>
          <div aria-hidden="true" className="mt-3 min-h-16 rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">Khách nhập câu trả lời ngắn…</div>
        </div>
      )}
    </fieldset>
  );
}

const newOption = (): OptionDraft => ({ key: draftKey("option"), text: "", preferenceId: null });

export const newQuestion = (type: QuestionType = "SingleChoice"): QuestionDraft => ({
  key: draftKey("question"), text: "", type, isRequired: true,
  options: isChoice(type) ? [newOption(), newOption()] : [],
});
