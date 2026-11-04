"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, CloudOff, Leaf, LoaderCircle, Pencil, Save, Send, ShieldCheck } from "lucide-react";
import { RatingInput } from "../../components/brand/rating-input";
import { answerError, readSurveyDraft, surveyUnavailable, writeSurveyDraft, type CustomerSurveyDetail, type SurveyAnswer, type SurveyAnswers, type SurveyQuestion } from "../customer/survey-response-service";

const button = "inline-flex min-h-12 items-center justify-center gap-2 rounded-md px-5 py-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8a6a2b] disabled:cursor-not-allowed disabled:opacity-45";
const primary = `${button} bg-[#29271f] text-[#fffdf7] hover:bg-[#4f5845]`;
const secondary = `${button} border border-[#ded8ca] bg-[#fffdf8] text-[#655d4c] hover:border-[#b3a27c] hover:bg-[#f6f2e9]`;
const emptyAnswer = (): SurveyAnswer => ({ optionIds: [], numericValue: null, textValue: null });

function answerLabel(question: SurveyQuestion, answer?: SurveyAnswer) {
  if (!answer) return "Chưa trả lời (không bắt buộc)";
  if (question.type === "Rating") return answer.numericValue === null ? "Chưa trả lời (không bắt buộc)" : `${answer.numericValue} / 5 sao`;
  if (question.type === "ShortText") return answer.textValue?.trim() || "Chưa trả lời (không bắt buộc)";
  return question.options.filter(option => answer.optionIds.includes(option.id)).map(option => option.text).join(", ") || "Chưa trả lời (không bắt buộc)";
}

function QuestionField({ question, value, error, onChange, titleRef }: { question: SurveyQuestion; value?: SurveyAnswer; error: string; onChange: (answer: SurveyAnswer) => void; titleRef: React.RefObject<HTMLHeadingElement | null> }) {
  const answer = value ?? emptyAnswer();
  const descriptionId = `question-${question.id}-description`;
  const errorId = `question-${question.id}-error`;
  const choice = question.type === "SingleChoice" || question.type === "MultiChoice";
  return <section key={question.id} className="animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none">
    <div className="mb-4 flex flex-wrap items-center gap-3 text-xs"><span className="rounded bg-[#f2ecdf] px-2 py-1 font-label tracking-wider text-[#826735] uppercase">{question.section || "Lắng nghe bạn"}</span><span className={question.isRequired ? "text-[#a05d4f]" : "text-[#827b6c]"}>{question.isRequired ? "* Bắt buộc" : "Không bắt buộc"}</span></div>
    <h2 ref={titleRef} tabIndex={-1} id={`question-${question.id}-title`} className="font-heading text-[26px] leading-snug text-[#302d25] outline-none sm:text-[30px]">{question.text}</h2>
    <p id={descriptionId} className="mt-3 text-sm leading-6 text-[#7c7566]">{question.description || (question.type === "MultiChoice" ? "Bạn có thể chọn nhiều câu trả lời." : choice ? "Chọn một câu trả lời phù hợp với bạn." : "Chia sẻ cảm nhận của riêng bạn.")}</p>
    <fieldset className="mt-6 min-w-0" aria-labelledby={`question-${question.id}-title`} aria-describedby={`${descriptionId}${error ? ` ${errorId}` : ""}`} aria-invalid={!!error}>
      <legend className="sr-only">{question.text}</legend>
      {choice ? <div className="grid gap-3">{question.options.map(option => {
        const selected = answer.optionIds.includes(option.id);
        return <label key={option.id} className={`group flex min-h-14 cursor-pointer items-start gap-3 rounded-md border px-4 py-4 transition-[background-color,border-color,box-shadow] duration-200 motion-reduce:transition-none ${selected ? "border-[#b59a5e] bg-[#f8f5ed] shadow-[0_0_0_1px_#b59a5e14]" : "border-[#e6e2d8] bg-white hover:border-[#c8bfa9] hover:bg-[#fcfaf5]"}`}>
          <input type={question.type === "SingleChoice" ? "radio" : "checkbox"} name={`question-${question.id}`} value={option.id} checked={selected} onChange={() => onChange({ optionIds: question.type === "SingleChoice" ? [option.id] : selected ? answer.optionIds.filter(id => id !== option.id) : [...answer.optionIds, option.id], numericValue: null, textValue: null })} className="mt-0.5 size-4 shrink-0 accent-[#927435] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8a6a2b]" />
          <span className="min-w-0 text-sm leading-6"><span className={selected ? "font-semibold text-[#65512e]" : "text-[#413c31]"}>{option.text}</span>{option.description && <span className="ml-1 text-[#827a69]"> — {option.description}</span>}</span>
        </label>;
      })}</div> : question.type === "Rating" ? <div className="rounded-lg bg-[#f8f6ef] p-5 sm:p-6"><RatingInput label="Mức độ của bạn" value={answer.numericValue} onValueChange={numericValue => onChange({ optionIds: [], numericValue, textValue: null })} /><p className="mt-3 text-sm text-[#82765d]">{answer.numericValue ? `Bạn đã chọn ${answer.numericValue} / 5 sao` : "Chọn từ 1 đến 5 sao"}</p></div> : <div><label className="sr-only" htmlFor={`answer-${question.id}`}>{question.text}</label><textarea id={`answer-${question.id}`} value={answer.textValue ?? ""} onChange={event => onChange({ optionIds: [], numericValue: null, textValue: event.target.value })} rows={5} maxLength={1000} aria-describedby={`${descriptionId}${error ? ` ${errorId}` : ""}`} aria-invalid={!!error} placeholder="Cocoon đang lắng nghe bạn…" className="w-full resize-y rounded-md border border-[#ded8ca] bg-[#fffefb] p-4 text-base leading-7 placeholder:text-[#aaa08e] focus:border-[#b59a5e] focus:outline-2 focus:outline-offset-2 focus:outline-[#b59a5e]/25" /><p className="mt-2 text-right text-xs text-[#898170]">{answer.textValue?.length ?? 0} / 1.000 ký tự</p></div>}
    </fieldset>
    {error && <p id={errorId} role="alert" className="mt-4 text-sm text-[#a14b3d]">{error}</p>}
    <p className="mt-6 flex items-start gap-2 border-t border-[#eee9dd] pt-4 text-xs leading-6 text-[#87795e]"><Leaf aria-hidden="true" size={15} className="mt-1 shrink-0 text-[#82906b]" />Mỗi chia sẻ của bạn giúp Cocoon chăm chút những công thức phù hợp hơn.</p>
  </section>;
}

export function SurveyStepper({ survey, storageKey, preview = false, onExit, onSubmit }: { survey: CustomerSurveyDetail; storageKey: string; preview?: boolean; onExit: () => void; onSubmit: (answers: SurveyAnswers) => Promise<void> }) {
  const [draft] = useState(() => { try { return readSurveyDraft(window.localStorage, storageKey, survey); } catch { return null; } });
  const [answers, setAnswers] = useState<SurveyAnswers>(draft?.answers ?? {});
  const [step, setStep] = useState(draft?.step ?? 0);
  const [review, setReview] = useState(draft?.review ?? false);
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState<"saving" | "saved" | "failed">("saving");
  const [pending, setPending] = useState(false);
  const [complete, setComplete] = useState(false);
  const [unavailable, setUnavailable] = useState(() => surveyUnavailable(survey));
  const busy = useRef(false);
  const finished = useRef(false);
  const title = useRef<HTMLHeadingElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const firstRender = useRef(true);
  const question = survey.questions[step];
  const progress = review ? 100 : (step + 1) / survey.questions.length * 100;
  useEffect(() => {
    const timer = setInterval(() => setUnavailable(surveyUnavailable(survey)), 30000);
    return () => clearInterval(timer);
  }, [survey]);
  useEffect(() => {
    if (complete || unavailable) return;
    const timer = setTimeout(() => {
      if (finished.current) return;
      try { writeSurveyDraft(window.localStorage, storageKey, survey, { answers, step, review }); setSaveState("saved"); }
      catch { setSaveState("failed"); }
    }, 350);
    return () => clearTimeout(timer);
  }, [answers, step, review, storageKey, survey, complete, unavailable]);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    title.current?.focus({ preventScroll: true });
    form.current?.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }, [step, review]);
  function persist() {
    try { writeSurveyDraft(window.localStorage, storageKey, survey, { answers, step, review }); setSaveState("saved"); return true; }
    catch { setSaveState("failed"); return false; }
  }
  function move(next: number, toReview = false) { persist(); setStep(next); setReview(toReview); setError(""); setSaveState("saving"); }
  function next() {
    const invalid = answerError(question, answers[question.id]);
    if (invalid) { setError(invalid); return; }
    if (step === survey.questions.length - 1) {
      const missing = survey.questions.findIndex(q => !!answerError(q, answers[q.id]));
      if (missing !== -1) { move(missing); setError("Bạn hãy hoàn thành câu hỏi bắt buộc này trước khi xem lại nhé."); return; }
      move(step, true);
    } else move(step + 1);
  }
  async function submit() {
    if (busy.current) return;
    const closed = surveyUnavailable(survey);
    if (closed) { setUnavailable(closed); return; }
    const missing = survey.questions.findIndex(q => !!answerError(q, answers[q.id]));
    if (missing !== -1) { move(missing); setError("Bạn hãy kiểm tra lại câu trả lời này nhé."); return; }
    busy.current = true; setPending(true); setError(""); persist();
    try {
      if (!preview) await onSubmit(answers);
      finished.current = true;
      setComplete(true);
      try { window.localStorage.removeItem(storageKey); } catch { /* Completion is server-owned even if storage is unavailable. */ }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Chưa thể gửi khảo sát. Bạn hãy thử lại nhé."); }
    finally { busy.current = false; setPending(false); }
  }
  if (complete) return <div className="rounded-xl border border-[#e4dfd1] bg-[#fffefb] px-6 py-14 text-center sm:p-16"><span className="mx-auto grid size-16 place-items-center rounded-full bg-[#edf1e6] text-[#71805b]"><CheckCircle2 size={32} strokeWidth={1.3} /></span><h2 className="mt-6 font-heading text-3xl">{preview ? "Bạn đã hoàn tất xem thử!" : "Cảm ơn bạn đã chia sẻ!"}</h2><p className="mx-auto mt-4 max-w-md text-sm leading-7 text-[#7c7566]">{preview ? "Đây là nội dung minh họa. Câu trả lời xem thử không được gửi đến Cocoon." : "Cocoon đã ghi nhận câu trả lời của bạn. Những chia sẻ này sẽ giúp chúng mình chăm chút sản phẩm tốt hơn mỗi ngày."}</p><button type="button" onClick={onExit} className={`${primary} mt-8`}><ArrowLeft size={16} />Về hộp khảo sát</button></div>;
  if (unavailable) return <div className="rounded-lg border border-[#e4dfd1] bg-[#fffefb] px-6 py-12 text-center"><Leaf size={32} className="mx-auto text-[#8d9679]" /><h2 className="mt-4 font-heading text-2xl">Hẹn bạn ở những chia sẻ tiếp theo</h2><p role="status" className="mt-4 text-sm leading-7 text-[#7c7566]">{unavailable}</p><button type="button" onClick={onExit} className={`${secondary} mt-6`}><ArrowLeft size={16} />Về hộp khảo sát</button></div>;
  return <>
    <div className="mb-5"><div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#837453]"><p className="font-label uppercase tracking-[0.12em]">Tiến độ phản hồi</p><span>{review ? "Xem lại trước khi gửi" : `Câu ${step + 1} / ${survey.questions.length}`} · {Math.round(progress)}%</span></div><div role="progressbar" aria-label="Tiến độ khảo sát" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} className="h-1 overflow-hidden rounded-full bg-[#e9e5da]"><div className="h-full rounded-full bg-[#a58848] transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${progress}%` }} /></div></div>
    <form ref={form} noValidate aria-busy={pending} onSubmit={event => { event.preventDefault(); if (review) void submit(); else next(); }}>
      <div className="rounded-lg border border-[#e6e1d5] border-t-2 border-t-[#b59a5e] bg-[#fffefb] p-5 shadow-[0_4px_24px_#51442504] sm:p-8">
        {review ? <section><p className="mb-3 font-label text-xs uppercase tracking-wider text-[#8a713e]">Một bước nữa thôi</p><h2 ref={title} tabIndex={-1} className="font-heading text-[28px] outline-none">Xem lại câu trả lời</h2><p className="mt-3 text-sm leading-6 text-[#7c7566]">Bạn có thể chỉnh sửa trước khi gửi. Những lựa chọn trước đó vẫn được giữ nguyên.</p><ol className="mt-6 divide-y divide-[#ece7db]">{survey.questions.map((q, index) => <li key={q.id} className="flex items-start justify-between gap-4 py-5"><div className="min-w-0"><h3 className="text-sm font-semibold leading-6 text-[#504a3c]">{index + 1}. {q.text}</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[#80765f]">{answerLabel(q, answers[q.id])}</p></div><button type="button" disabled={pending} aria-label={`Sửa câu ${index + 1}`} onClick={() => move(index)} className="flex min-h-11 shrink-0 items-center gap-1.5 text-xs text-[#8a713e] underline-offset-4 hover:underline focus-visible:outline-2"><Pencil size={13} />Sửa</button></li>)}</ol>{error && <p role="alert" className="mt-5 rounded-md bg-[#faf0eb] p-4 text-sm leading-6 text-[#a14b3d]">{error}</p>}</section> : <QuestionField question={question} value={answers[question.id]} error={error} titleRef={title} onChange={answer => { setAnswers(current => ({ ...current, [question.id]: answer })); setError(""); setSaveState("saving"); }} />}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><button type="button" disabled={pending || step === 0 && !review} onClick={() => move(review ? survey.questions.length - 1 : step - 1)} className={secondary}><ArrowLeft size={16} />{review ? "Quay lại chỉnh sửa" : "Quay lại câu trước"}</button><button type="submit" disabled={pending} className={primary}>{pending ? <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" /> : null}{review ? pending ? "Đang gửi…" : preview ? "Hoàn tất xem thử" : "Gửi khảo sát" : step === survey.questions.length - 1 ? "Xem lại câu trả lời" : `Tiếp tục (câu ${step + 2})`}{review ? <Send size={15} /> : <ArrowRight size={16} />}</button></div>
      <div className="mt-6 text-center"><button type="button" disabled={pending} onClick={() => { if (persist()) onExit(); }} className="inline-flex min-h-11 items-center gap-2 text-sm text-[#8b7c5d] underline underline-offset-4 hover:text-[#54472e] disabled:opacity-45"><Save size={14} />Lưu & thoát <span className="hidden sm:inline">· Bạn có thể tiếp tục sau</span></button><p role="status" className={`mt-2 flex items-center justify-center gap-1.5 text-xs leading-6 ${saveState === "failed" ? "text-[#a14b3d]" : "text-[#8b8373]"}`}>{saveState === "failed" ? <><CloudOff size={13} />Chưa lưu được trên thiết bị. Hãy giữ trang mở và thử lại.</> : saveState === "saved" ? <><Check size={13} />Đã lưu nháp trên thiết bị này</> : "Đang lưu nháp…"}</p></div>
    </form>
    <p className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-[#918978]"><ShieldCheck size={14} strokeWidth={1.4} />Chỉ gửi câu trả lời khi bạn xác nhận ở bước cuối.</p>
  </>;
}
