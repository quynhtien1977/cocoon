"use client";

import { useId, useRef, useState, type ChangeEvent } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Plus, Star, Trash2, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { uploadQuestionImage } from "./api";
import { fieldClass, labelClass } from "./components/form-styles";
import { isChoice, MAX_QUESTION_MEDIA, questionTypeLabels } from "./schemas";
import type { OptionDraft, PreferenceOption, QuestionDraft, QuestionMediaDraft, QuestionType, SurveyStatus } from "./types";
import { youtubeEmbedUrl, youtubeVideoId } from "./youtube";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.has(file.type.toLowerCase())) return "Chỉ chấp nhận ảnh JPG, PNG hoặc WebP.";
  if (file.size > MAX_IMAGE_BYTES) return "Ảnh minh họa tối đa 2 MB.";
  return null;
}

let keySeed = 0;
/** Client-only key for new questions/options; never sent to the API. */
export const draftKey = (prefix: string) => `${prefix}-${++keySeed}`;

export interface QuestionEditorProps {
  index: number;
  total: number;
  question: QuestionDraft;
  preferences: readonly PreferenceOption[];
  surveyId?: number;
  status?: SurveyStatus;
  /** Errors relative to this question: "text", "options", "options.1.text", "media", "media.0.videoUrl". */
  errors?: Record<string, string>;
  /** Shows only the header and a one-line summary; errors keep the block open. */
  collapsed?: boolean;
  onChange: (question: QuestionDraft) => void;
  onRemove: () => void;
  onMove: (offset: -1 | 1) => void;
}

/** One block for the four QuestionType values (spec 4.5); choice options can tag a preference (spec 5.6 rule 4). */
export function QuestionEditor({ index, total, question, preferences, surveyId, status = "Draft", errors = {}, collapsed = false, onChange, onRemove, onMove }: QuestionEditorProps) {
  const id = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const isDraft = status === "Draft";
  const media = question.media ?? [];
  const compact = collapsed && Object.keys(errors).length === 0;
  const number = String(index + 1).padStart(2, "0");
  const update = (patch: Partial<QuestionDraft>) => onChange({ ...question, ...patch });
  const updateOption = (position: number, patch: Partial<OptionDraft>) => update({ options: question.options.map((option, i) => i === position ? { ...option, ...patch } : option) });
  const changeType = (type: QuestionType) => update({
    type,
    // Choice questions start with two blank options; other types never carry options.
    options: isChoice(type) ? (question.options.length ? question.options : [newOption(), newOption()]) : [],
  });

  const moveMedia = (position: number, offset: -1 | 1) => {
    const next = [...media];
    [next[position], next[position + offset]] = [next[position + offset], next[position]];
    update({ media: next });
  };

  const removeMedia = (position: number) => {
    setUploadError(null);
    update({ media: media.filter((_, i) => i !== position) });
  };

  const updateMediaVideo = (position: number, videoUrl: string) => {
    update({ media: media.map((item, i) => i === position && item.type === "Video" ? { ...item, videoUrl } : item) });
  };

  const addVideo = () => {
    if (!isDraft || media.length >= MAX_QUESTION_MEDIA) return;
    setUploadError(null);
    update({ media: [...media, { key: draftKey("media"), type: "Video", videoUrl: "" }] });
  };

  async function handleFilesSelected(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length || !isDraft || uploading || surveyId === undefined) return;
    if (media.length + files.length > MAX_QUESTION_MEDIA) {
      setUploadError(`Mỗi câu hỏi có tối đa ${MAX_QUESTION_MEDIA} ảnh hoặc video.`);
      return;
    }
    setUploadError(null);
    setUploading(true);
    let nextMedia: QuestionMediaDraft[] = [...media];
    try {
      for (const file of files) {
        const fileErr = validateImageFile(file);
        if (fileErr) {
          setUploadError(fileErr);
          break;
        }
        const uploaded = await uploadQuestionImage(surveyId, file);
        nextMedia = [...nextMedia, { key: draftKey("media"), type: "Image", imageId: uploaded.id, url: uploaded.url }];
        update({ media: nextMedia });
      }
    } catch (reason) {
      setUploadError(reason instanceof ApiError ? reason.message : "Chưa tải ảnh lên được. Thử lại sau.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <fieldset className="rounded-lg border border-border bg-card p-4 sm:p-6" aria-describedby={errors.options ? `${id}-options-error` : undefined}>
      <legend className="sr-only">Câu {index + 1}</legend>
      <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-2", !compact && "border-b border-border pb-4")}>
        <span className="rounded-sm border border-gold px-2 py-1 font-label text-sm uppercase tracking-wider text-gold-strong">Câu {number}</span>
        <label htmlFor={`${id}-type`} className="sr-only">Loại câu hỏi</label>
        <select id={`${id}-type`} value={question.type} onChange={(event) => changeType(event.target.value as QuestionType)} className={cn(fieldClass, "w-auto min-w-0 flex-1 sm:flex-none")}>
          {(Object.keys(questionTypeLabels) as QuestionType[]).map((type) => <option key={type} value={type}>{questionTypeLabels[type]}</option>)}
        </select>
        <div className="flex w-full items-center justify-between gap-1 sm:ml-auto sm:w-auto">
          <label className="inline-flex min-h-12 items-center gap-2 pr-2 font-label text-sm uppercase tracking-wider">
            <input type="checkbox" checked={question.isRequired} onChange={(event) => update({ isRequired: event.target.checked })} className="size-5 accent-gold-strong" />
            Bắt buộc
          </label>
          <span className="flex gap-1">
            <Button type="button" variant="ghost" size="icon-lg" className="size-12" disabled={index === 0} onClick={() => onMove(-1)} aria-label={`Đưa câu ${index + 1} lên`}><ArrowUp aria-hidden="true" /></Button>
            <Button type="button" variant="ghost" size="icon-lg" className="size-12" disabled={index === total - 1} onClick={() => onMove(1)} aria-label={`Đưa câu ${index + 1} xuống`}><ArrowDown aria-hidden="true" /></Button>
            <Button type="button" variant="ghost" size="icon-lg" className="size-12 text-destructive" onClick={onRemove} aria-label={`Xóa câu ${index + 1}`}><Trash2 aria-hidden="true" /></Button>
          </span>
        </div>
      </div>

      {compact ? (
        <p className="mt-2 truncate font-heading text-base">
          {question.text.trim() || <span className="text-muted-foreground">Chưa nhập nội dung câu hỏi</span>}
          {isChoice(question.type) && <span className="font-sans text-sm text-muted-foreground"> · {question.options.length} lựa chọn</span>}
        </p>
      ) : <>
      <div className="mt-4 space-y-2">
        <label htmlFor={`${id}-text`} className={labelClass}>Nội dung câu hỏi</label>
        <input id={`${id}-text`} value={question.text} onChange={(event) => update({ text: event.target.value })} maxLength={500}
          aria-invalid={!!errors.text} aria-describedby={errors.text ? `${id}-text-error` : undefined} className={cn(fieldClass, "font-heading text-base")} />
        {errors.text && <p id={`${id}-text-error`} className="text-sm text-destructive">{errors.text}</p>}
      </div>

      <div className="mt-5 space-y-3 rounded-md border border-border bg-muted/40 p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={labelClass}>Ảnh/video (không bắt buộc)</p>
          <span className="text-xs tabular-nums text-muted-foreground">{media.length}/{MAX_QUESTION_MEDIA} mục</span>
        </div>

        {media.length > 0 && (
          <ul className="space-y-3">
            {media.map((item, position) => {
              const videoError = errors[`media.${position}.videoUrl`];
              const videoId = item.type === "Video" ? youtubeVideoId(item.videoUrl) : null;
              return (
                <li key={item.key} className="rounded-md border border-border bg-background p-3">
                  <div className="flex flex-wrap items-start gap-3">
                    {item.type === "Image" ? (
                      <>
                        {/* Same-origin authenticated proxy image */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.url} alt={`Ảnh minh họa ${position + 1} của câu ${index + 1}`} className="size-16 shrink-0 rounded border border-border bg-muted object-cover" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">Ảnh minh họa #{position + 1}</p>
                          <p className="text-xs text-muted-foreground">Hiển thị theo thứ tự phía dưới tiêu đề câu hỏi.</p>
                        </div>
                      </>
                    ) : (
                      <div className="min-w-0 flex-1 space-y-2">
                        <label htmlFor={`${id}-media-video-${position}`} className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          <Video className="size-3.5" aria-hidden="true" />Link video YouTube #{position + 1}
                        </label>
                        <input
                          id={`${id}-media-video-${position}`}
                          type="url"
                          value={item.videoUrl}
                          readOnly={!isDraft}
                          onChange={(event) => updateMediaVideo(position, event.target.value)}
                          maxLength={500}
                          placeholder="https://www.youtube.com/watch?v=… hoặc youtu.be/…"
                          aria-invalid={!!videoError}
                          aria-describedby={videoError ? `${id}-media-video-${position}-error` : undefined}
                          className={fieldClass}
                        />
                        {videoError && <p id={`${id}-media-video-${position}-error`} className="text-sm text-destructive">{videoError}</p>}
                        {videoId && (
                          <div className="aspect-video w-full max-w-sm overflow-hidden rounded border border-border bg-black">
                            <iframe
                              src={youtubeEmbedUrl(videoId)}
                              title={`Xem trước video ${position + 1} của câu ${index + 1}`}
                              className="h-full w-full border-0"
                              allow="encrypted-media; picture-in-picture"
                              allowFullScreen
                              loading="lazy"
                            />
                          </div>
                        )}
                      </div>
                    )}
                    {isDraft && (
                      <span className="flex shrink-0 gap-1">
                        <Button type="button" variant="ghost" size="icon" className="size-10" disabled={position === 0} onClick={() => moveMedia(position, -1)} aria-label={`Đưa mục ${position + 1} của câu ${index + 1} lên`}>
                          <ArrowUp className="size-4" aria-hidden="true" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="size-10" disabled={position === media.length - 1} onClick={() => moveMedia(position, 1)} aria-label={`Đưa mục ${position + 1} của câu ${index + 1} xuống`}>
                          <ArrowDown className="size-4" aria-hidden="true" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="size-10 text-destructive" onClick={() => removeMedia(position)} aria-label={`Xóa mục ${position + 1} của câu ${index + 1}`}>
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {isDraft && (
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              id={`${id}-media-files`}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              aria-label={`Thêm ảnh cho câu ${index + 1}`}
              className="sr-only"
              onChange={handleFilesSelected}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={surveyId === undefined || uploading || media.length >= MAX_QUESTION_MEDIA}
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus aria-hidden="true" />{uploading ? "Đang tải ảnh…" : "Thêm ảnh"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={media.length >= MAX_QUESTION_MEDIA}
                onClick={addVideo}
              >
                <Video aria-hidden="true" />Thêm video YouTube
              </Button>
            </div>
            {surveyId === undefined ? (
              <p className="text-xs text-muted-foreground">Khảo sát mới cần bấm <strong>Lưu bản nháp</strong> trước để có thể tải ảnh lên câu hỏi.</p>
            ) : (
              <p className="text-xs text-muted-foreground">Chọn tối đa {MAX_QUESTION_MEDIA} ảnh/video · ảnh JPG, PNG hoặc WebP ≤ 2 MB.</p>
            )}
          </div>
        )}

        {errors.media && <p role="alert" className="text-sm text-destructive">{errors.media}</p>}
        {uploadError && <p role="alert" className="text-sm text-destructive">{uploadError}</p>}
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
                    <label htmlFor={`${id}-preference-${position}`} className="sr-only">Gắn nhu cầu cho lựa chọn {position + 1}</label>
                    <select id={`${id}-preference-${position}`} value={option.preferenceId ?? ""} onChange={(event) => updateOption(position, { preferenceId: event.target.value ? Number(event.target.value) : null })}
                      className={cn(fieldClass, "col-start-2 sm:col-start-3 sm:row-start-1", option.preferenceId !== null && "border-gold bg-status-beige-bg text-status-beige-fg")}>
                      <option value="">Không gắn nhu cầu</option>
                      {preferences.map((preference) => <option key={preference.id} value={preference.id}># {preference.name}</option>)}
                    </select>
                    <Button type="button" variant="ghost" size="icon-lg" className="col-start-3 row-start-1 size-12 sm:col-start-4" onClick={() => update({ options: question.options.filter((_, i) => i !== position) })} aria-label={`Xóa lựa chọn ${position + 1}`}><X aria-hidden="true" /></Button>
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
          <p className="mt-3 flex justify-between gap-2 border-t border-border pt-2 text-xs text-muted-foreground">
            <span>1 sao = thấp nhất</span><span>5 sao = cao nhất</span>
          </p>
        </div>
      )}

      {question.type === "ShortText" && (
        <div className="mt-6 rounded-md border border-border bg-muted p-4">
          <p className={labelClass}>Xem trước ô trả lời</p>
          <div aria-hidden="true" className="mt-3 min-h-16 rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">Khách nhập câu trả lời ngắn…</div>
        </div>
      )}
      </>}
    </fieldset>
  );
}

const newOption = (): OptionDraft => ({ key: draftKey("option"), text: "", preferenceId: null });

export const newQuestion = (type: QuestionType = "SingleChoice"): QuestionDraft => ({
  key: draftKey("question"), text: "", type, isRequired: true,
  options: isChoice(type) ? [newOption(), newOption()] : [],
});
