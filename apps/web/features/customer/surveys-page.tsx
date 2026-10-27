"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, Check, ClipboardList, Clock3, ExternalLink, Leaf, Sprout } from "lucide-react";
import { ApiError } from "../../lib/api/client";
import { loadSurveys, previewSurveys, type CustomerSurvey } from "./surveys-service";

const formatDate = (value: string) => new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value));
const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded px-5 py-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8b713e]";

function SurveyCard({ item, index, now }: { item: CustomerSurvey; index: number; now: number }) {
  const closed = item.closeAt !== null && Date.parse(item.closeAt) <= now;
  const completed = item.completedAt !== null;
  return <article className="group grid gap-5 rounded-lg border border-[#e7dfd0] bg-[#fffdf8] p-5 transition-[box-shadow,border-color] duration-300 hover:border-[#c9b990] hover:shadow-[0_8px_24px_#392d1210] sm:grid-cols-[112px_1fr] sm:gap-6 sm:p-6">
    <div aria-hidden="true" className={`flex min-h-24 items-center justify-center rounded-md sm:min-h-36 ${completed ? "bg-[#f1f0e8] text-[#8c876b]" : index % 2 ? "bg-[#f7eee6] text-[#a48663]" : "bg-[#edf1e9] text-[#7a8c6a]"}`}>
      {completed ? <Check size={40} strokeWidth={1} /> : index % 2 ? <Sprout size={48} strokeWidth={1} /> : <Leaf size={48} strokeWidth={1} />}
    </div>
    <div className="min-w-0"><div className="flex flex-wrap items-center gap-3 text-xs"><span className="rounded bg-[#efeee5] px-2 py-1 text-[#687650]">{item.category}</span><span className="text-[#9c927e]">KS-{String(item.id).padStart(3, "0")}</span></div>
      <h2 className="mt-3 font-heading text-[23px] leading-snug text-[#302b23]">{item.title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#827968]">{item.description}</p>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-[#eee7d9] pt-4">
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-[#85795f]">
          {item.questionCount && <span className="inline-flex items-center gap-1.5"><ClipboardList size={14} />{item.questionCount} câu hỏi</span>}
          {item.estimatedMinutes && <span className="inline-flex items-center gap-1.5"><Clock3 size={14} />Khoảng {item.estimatedMinutes} phút</span>}
          {completed ? <span className="inline-flex items-center gap-1.5 text-[#64754f]"><Check size={14} />Đã làm · {formatDate(item.completedAt!)}</span> : item.closeAt && <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} />{closed ? "Đã kết thúc" : `Đến ${formatDate(item.closeAt)}`}</span>}
        </div>
        {!completed && (item.googleFormUrl && !closed ? <a href={item.googleFormUrl} target="_blank" rel="noopener noreferrer" aria-label={`Làm khảo sát: ${item.title} (mở Google Form ở tab mới)`} className={`${button} w-full bg-[#27231c] text-[#fffdf7] hover:bg-[#6e5833] sm:w-auto`}>Làm khảo sát <ArrowRight size={16} /></a> : <button type="button" disabled className={`${button} w-full bg-[#f0ece3] text-[#988e7b] sm:w-auto`}>{closed ? "Khảo sát đã kết thúc" : "Chưa có liên kết khảo sát"}</button>)}
      </div>
    </div>
  </article>;
}

export function SurveysPage() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const [items, setItems] = useState<CustomerSurvey[]>([]);
  const [filter, setFilter] = useState<"pending" | "completed">("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [preview, setPreview] = useState(false);
  useEffect(() => {
    if (preview) return;
    const controller = new AbortController();
    loadSurveys(AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]))
      .then(data => { if (!controller.signal.aborted) setItems(data); })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof ApiError && reason.status === 501 ? "Khảo sát hiện chưa khả dụng. Bạn hãy quay lại sau nhé." : "Chưa thể tải khảo sát. Vui lòng thử lại."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt, preview]);
  const data = preview ? previewSurveys : items;
  const ready = preview || !loading && !error;
  const pending = data.filter(item => !item.completedAt);
  const completed = data.filter(item => item.completedAt).sort((a, b) => Date.parse(b.completedAt!) - Date.parse(a.completedAt!));
  const available = pending.filter(item => !item.closeAt || Date.parse(item.closeAt) > now);
  const visible = filter === "pending" ? pending : completed;
  const retry = () => { setLoading(true); setError(""); setAttempt(value => value + 1); };
  return <div className="pb-8 text-[#302b23]">
    <header className="relative overflow-hidden rounded-lg bg-[#f2eddf] px-6 py-8 sm:p-8">
      <Leaf aria-hidden="true" size={180} strokeWidth={0.5} className="pointer-events-none absolute -right-8 -top-8 rotate-12 text-[#ded7c3]" />
      <div className="relative flex flex-wrap items-center justify-between gap-6"><div className="max-w-[650px]"><p className="font-heading text-xs uppercase tracking-[0.18em] text-[#8a713e]">Cocoon lắng nghe bạn</p><h1 className="mt-3 font-heading text-3xl leading-tight sm:text-4xl">Một chia sẻ nhỏ.<br />Một thay đổi tốt hơn.</h1><p className="mt-4 max-w-[530px] text-sm leading-7 text-[#827763]">Cùng Cocoon hoàn thiện những sản phẩm thuần chay, bắt đầu từ trải nghiệm và mong muốn của bạn.</p></div>
        <div className="flex items-center gap-4 rounded-md border border-[#e1d8c4] bg-[#fffdf7]/80 p-4"><ClipboardList size={24} strokeWidth={1.3} className="text-[#8a713e]" /><div><span className="block text-xs text-[#8a7f68]">Dành cho bạn</span><p className="mt-1 font-heading text-xl">{ready ? available.length : "—"} khảo sát đang mở</p></div></div>
      </div>
    </header>
    {preview && <div role="status" className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded border border-[#e1d8c4] p-4 text-sm text-[#827763]"><p><strong>Giao diện mẫu</strong> · Nội dung minh họa, không phải khảo sát của bạn.</p><button type="button" className="min-h-10 underline underline-offset-4" onClick={() => { retry(); setPreview(false); }}>Thoát xem mẫu</button></div>}
    <div className="mb-6 mt-8 flex flex-wrap items-center justify-between gap-4 border-b border-[#dfd5c1]">
      <div className="flex gap-6" aria-label="Lọc khảo sát">{([ ["pending", "Chờ làm", pending.length], ["completed", "Đã làm", completed.length] ] as const).map(([value, label, count]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`flex min-h-12 items-center gap-2 border-b-2 px-1 pb-3 text-sm transition-colors ${filter === value ? "border-[#8b713e] font-semibold text-[#816532]" : "border-transparent text-[#9b917f] hover:text-[#816532]"}`}>{label}<span className={`rounded-full px-2 py-0.5 text-xs ${filter === value ? "bg-[#8b713e] text-white" : "bg-[#eeeadf]"}`}>{ready ? count : "—"}</span></button>)}</div>
      <p className="mb-3 flex items-center gap-2 text-xs text-[#968b75]"><ExternalLink size={13} />Khảo sát được mở trên Google Forms</p>
    </div>
    {!preview && loading ? <div role="status" className="space-y-4"><p className="text-sm text-[#827763]">Đang tải khảo sát của bạn…</p>{[1, 2].map(id => <div key={id} className="h-44 rounded-lg bg-[#f1ede3] motion-safe:animate-pulse" />)}</div> : !preview && error ? <div className="rounded-lg border border-[#e7dfd0] px-6 py-12 text-center"><ClipboardList className="mx-auto text-[#9b8967]" size={32} strokeWidth={1} /><h2 className="mt-4 font-heading text-2xl">Hẹn bạn với những chia sẻ mới</h2><p role="alert" className="mt-3 text-sm text-[#827763]">{error}</p><div className="mt-6 flex flex-wrap justify-center gap-3"><button type="button" onClick={retry} className={`${button} border border-[#ded2bb]`}>Thử lại</button><button type="button" onClick={() => setPreview(true)} className={`${button} bg-[#27231c] text-white`}>Xem giao diện mẫu</button></div></div> : <>
      <div className="grid gap-4" aria-live="polite">{visible.length ? visible.map((item, index) => <SurveyCard key={item.id} item={item} index={index} now={now} />) : <div className="rounded-lg border border-dashed border-[#ded5c3] px-6 py-12 text-center"><Sprout className="mx-auto text-[#8e9a7d]" size={36} strokeWidth={1} /><h2 className="mt-4 font-heading text-2xl">{filter === "pending" ? "Bạn đã xem hết khảo sát rồi" : "Chưa có khảo sát đã hoàn thành"}</h2><p className="mt-3 text-sm text-[#827763]">{filter === "pending" ? "Những lời mời mới từ Cocoon sẽ xuất hiện tại đây." : "Những chia sẻ được ghi nhận của bạn sẽ được lưu tại đây."}</p></div>}</div>
      {filter === "pending" && completed.length > 0 && <section className="mt-10"><div className="mb-4 flex items-center justify-between gap-3"><h2 className="font-heading text-xl">Những chia sẻ gần đây</h2><button type="button" onClick={() => setFilter("completed")} className="flex min-h-11 items-center gap-2 text-xs text-[#8b713e]">Xem tất cả <ArrowRight size={14} /></button></div>{completed.slice(0, 2).map(item => <div key={item.id} className="flex items-start gap-3 border-t border-[#e7dfd0] py-4"><Check size={18} className="mt-1 shrink-0 text-[#7b8c66]" /><div><p className="text-sm">{item.title}</p><p className="mt-1 text-xs text-[#9b917f]">Đã ghi nhận · {formatDate(item.completedAt!)}</p></div></div>)}</section>}
    </>}
    <p className="mt-10 text-center font-heading text-lg italic text-[#9a8b70]">Cảm ơn bạn đã cùng Cocoon tạo nên những điều tốt đẹp.</p>
  </div>;
}
