"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ClipboardList, Leaf } from "lucide-react";
import { ApiError, apiRequest } from "../../lib/api/client";
import { getAccountRole } from "../../lib/auth/roles";
import { SurveyStepper } from "../surveys/survey-stepper";
import { loadCustomerSurvey, submitSurveyResponse, surveyDraftKey, type CustomerSurveyDetail } from "./survey-response-service";
import { previewCustomerSurvey } from "./survey-response.fixture";

export function SurveyResponsePage({ id, preview = false }: { id: string; preview?: boolean }) {
  const router = useRouter();
  const [data, setData] = useState<{ survey: CustomerSurveyDetail; accountId: number | "preview" } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]);
    async function load() {
      if (preview) {
        const survey = previewCustomerSurvey(id);
        if (!survey) throw new Error("Không tìm thấy khảo sát mẫu này.");
        return { survey, accountId: "preview" as const };
      }
      const [survey, account] = await Promise.all([loadCustomerSurvey(id, signal), apiRequest<{ id: number; role: unknown }>("/me", { signal })]);
      if (!account || !Number.isSafeInteger(account.id) || account.id <= 0 || getAccountRole(account) !== "Customer") throw new Error("Chưa xác định được tài khoản khách hàng.");
      return { survey, accountId: account.id };
    }
    load().then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof ApiError ? reason.status === 501 ? "Khảo sát hiện chưa khả dụng. Bạn hãy quay lại sau nhé." : reason.status === 404 ? "Không tìm thấy khảo sát này hoặc bạn chưa được mời tham gia." : "Chưa thể mở khảo sát. Bạn hãy thử lại nhé." : "Chưa thể tải khảo sát. Vui lòng kiểm tra lại kết nối hoặc thử lại."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, preview, attempt]);
  const exit = () => router.push("/account/surveys");
  return <div className="mx-auto w-full max-w-[760px] pb-6 text-[#302d25]">
    <Link href="/account/surveys" className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm text-[#827453] underline-offset-4 hover:underline"><ArrowLeft size={15} />Hộp khảo sát</Link>
    <header className="mb-7"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p className="flex items-center gap-2 font-label text-xs uppercase tracking-[0.14em] text-[#8a713e]"><span className="size-1.5 rounded-full bg-[#9d8142]" />Khảo sát ý kiến khách hàng Cocoon</p><span className="inline-flex items-center gap-1.5 rounded bg-[#edf1e7] px-2 py-1 font-label text-[11px] tracking-wider text-[#687553] uppercase"><Leaf size={12} />Cùng bạn chăm chút</span></div><h1 className="font-heading text-3xl leading-tight sm:text-[36px]">{data?.survey.title ?? "Mỗi chia sẻ đều được lắng nghe"}</h1><p className="mt-4 text-sm leading-7 text-[#817767]">{data?.survey.description || "Cùng Cocoon hoàn thiện những trải nghiệm thuần chay dành cho bạn."}</p></header>
    {preview && <p role="status" className="mb-6 rounded-md border border-[#e5d9bc] bg-[#faf5e8] px-4 py-3 text-xs leading-6 text-[#8b7241]"><strong>Giao diện mẫu</strong> · Nội dung minh họa. Câu trả lời không được gửi đến hệ thống.</p>}
    {loading ? <div role="status" className="space-y-4 rounded-lg border border-[#e6e1d5] bg-[#fffefb] p-8"><p className="text-sm text-[#827763]">Đang chuẩn bị khảo sát của bạn…</p>{[1, 2, 3].map(key => <div key={key} className="h-14 rounded-md bg-[#f1eee5] motion-safe:animate-pulse" />)}</div> : error ? <div className="rounded-lg border border-[#e6e1d5] bg-[#fffefb] px-6 py-12 text-center"><ClipboardList size={34} strokeWidth={1.2} className="mx-auto text-[#a08d62]" /><h2 className="mt-5 font-heading text-2xl">Hẹn bạn với những chia sẻ mới</h2><p role="alert" className="mt-3 text-sm leading-7 text-[#827763]">{error}</p><div className="mt-6 flex flex-wrap justify-center gap-3"><button type="button" onClick={() => { setLoading(true); setError(""); setAttempt(value => value + 1); }} className="min-h-12 rounded-md border border-[#d9cfba] px-5 text-sm text-[#77684a] hover:bg-[#f6f0e5]">Thử lại</button>{!preview && <Link href="/account/surveys/1?preview=1" className="inline-flex min-h-12 items-center rounded-md bg-[#29271f] px-5 text-sm text-white hover:bg-[#4f5845]">Xem giao diện mẫu</Link>}</div></div> : data && <SurveyStepper key={`${data.accountId}:${data.survey.id}`} survey={data.survey} storageKey={surveyDraftKey(data.accountId, data.survey.id)} preview={preview} onExit={exit} onSubmit={async answers => {
      try { await submitSurveyResponse(data.survey, answers, AbortSignal.timeout(12000)); }
      catch (reason) { throw new Error(reason instanceof ApiError && reason.status === 501 ? "Khảo sát chưa hỗ trợ gửi câu trả lời. Bản nháp vẫn được giữ để bạn thử lại sau." : reason instanceof ApiError && reason.status === 409 ? "Khảo sát đã được gửi hoặc không còn nhận câu trả lời. Hãy quay lại hộp khảo sát để kiểm tra." : "Chưa gửi được câu trả lời. Bản nháp vẫn được giữ, bạn hãy thử lại nhé."); }
    }} />}
  </div>;
}
