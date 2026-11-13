"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CircleCheck, Info, ListChecks, Search, Send, SlidersHorizontal } from "lucide-react";
import { ConfirmDialog } from "@/components/brand/confirm-dialog";
import { EmptyState } from "@/components/brand/empty-state";
import { PageHeader } from "@/components/brand/page-header";
import { StatusBadge } from "@/components/brand/status-badge";
import { emptySegmentFilter, SegmentFilterBuilder, segmentAgeError, type SegmentFilterValue } from "@/components/data/segment-filter-builder";
import { Button, buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError } from "@/lib/api/client";
import { useApiData } from "@/lib/api/use-api-data";
import { cn } from "@/lib/utils";
import { addRecipients, loadSend, previewSegment, publishSurvey } from "../api";
import type { PreferenceOption, RecipientCustomer, SegmentPreview, SurveyInfo } from "../types";
import { fieldClass } from "./form-styles";
import { LoadState } from "./load-state";

const date = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" });
const tabTrigger = "min-h-12 flex-none rounded-none px-4 font-label text-sm uppercase tracking-wider";

const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();
const demographic = (row: RecipientCustomer) => [row.age === null ? null : `${row.age} tuổi`, row.gender].filter(Boolean).join(" · ") || "—";

/** The API returns at most five sample customers per preview. */
function SampleTable({ rows, total, loading, error }: { rows: readonly RecipientCustomer[]; total: number; loading: boolean; error: string | null }) {
  return (
    <section aria-labelledby="segment-sample" className="rounded-lg border border-border bg-card">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border p-4 sm:p-6">
        <h2 id="segment-sample" className="font-heading text-xl">Khách hàng mẫu</h2>
        <span className="font-label text-xs uppercase tracking-wider text-muted-foreground">Hiển thị {rows.length} / {total} người nhận</span>
      </header>
      {error ? <p role="alert" className="p-4 text-sm text-destructive sm:p-6">{error}</p>
        : loading ? <p role="status" className="p-4 text-sm text-muted-foreground sm:p-6">Đang đếm khách phù hợp…</p>
        : rows.length === 0 ? <EmptyState title="Không có khách phù hợp" description="Bỏ bớt tiêu chí để mở rộng phân khúc." className="border-0" /> : <>
        <ul className="divide-y divide-border md:hidden">
          {rows.map((row) => <li key={row.id} className="p-4"><p className="font-semibold">{row.fullName} <span className="font-mono text-xs font-normal text-muted-foreground">{row.code}</span></p><p className="text-sm break-words text-muted-foreground">{row.email}</p><p className="mt-1 text-sm">{demographic(row)}</p></li>)}
        </ul>
        <div className="hidden md:block">
          <Table>
            <TableCaption className="sr-only">Khách hàng mẫu trong phân khúc</TableCaption>
            <TableHeader><TableRow><TableHead>Khách hàng</TableHead><TableHead>Mã khách</TableHead><TableHead>Nhân khẩu</TableHead></TableRow></TableHeader>
            <TableBody>{rows.map((row) => <TableRow key={row.id}><TableCell><span className="block font-semibold">{row.fullName}</span><span className="block text-xs text-muted-foreground">{row.email}</span></TableCell><TableCell className="font-mono text-xs">{row.code}</TableCell><TableCell>{demographic(row)}</TableCell></TableRow>)}</TableBody>
          </Table>
        </div>
      </>}
    </section>
  );
}

function ManualPicker({ customers, selected, onChange }: { customers: readonly RecipientCustomer[]; selected: readonly number[]; onChange: (ids: number[]) => void }) {
  const [query, setQuery] = useState("");
  const needle = normalize(query.trim());
  const rows = customers.filter((row) => normalize(`${row.fullName} ${row.code} ${row.email}`).includes(needle));
  const allShown = rows.length > 0 && rows.every((row) => selected.includes(row.id));
  const toggleShown = () => onChange(allShown ? selected.filter((id) => !rows.some((row) => row.id === id)) : [...new Set([...selected, ...rows.map((row) => row.id)])]);
  const toggle = (id: number) => onChange(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);

  return (
    <section aria-labelledby="manual-title" className="rounded-lg border border-border bg-card p-4 sm:p-6">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="manual-title" className="font-heading text-xl">Chọn khách hàng</h2>
        <span aria-live="polite" className="font-label text-xs uppercase tracking-wider text-muted-foreground">Đã chọn {selected.length} khách</span>
      </header>
      <div className="relative mb-4">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Tìm khách theo tên, mã hoặc email" placeholder="Tìm theo tên, mã hoặc email" className={cn(fieldClass, "pl-9")} />
      </div>
      {rows.length === 0 ? <EmptyState title="Không tìm thấy khách hàng" description="Thử từ khóa khác." className="border-0" /> : <>
        <label className="flex min-h-12 items-center gap-3 border-b border-border font-semibold"><input type="checkbox" checked={allShown} onChange={toggleShown} className="size-5 accent-primary" />Chọn tất cả {rows.length} khách đang hiển thị</label>
        <ul className="max-h-[32rem] divide-y divide-border overflow-y-auto">
          {rows.map((row) => <li key={row.id}><label className="flex min-h-12 items-center gap-3 py-2"><input type="checkbox" checked={selected.includes(row.id)} onChange={() => toggle(row.id)} className="size-5 shrink-0 accent-primary" /><span className="min-w-0"><span className="block font-semibold">{row.fullName} <span className="font-mono text-xs font-normal text-muted-foreground">{row.code}</span></span><span className="block text-sm text-muted-foreground">{demographic(row)} · {row.email}</span></span></label></li>)}
        </ul>
      </>}
    </section>
  );
}

/** M9 route body. */
export function SurveySendPage({ id }: { id: number }) {
  const load = useCallback((signal: AbortSignal) => loadSend(id, signal), [id]);
  const { data, loading, error, missing, retry } = useApiData(load, "Chưa tải được khảo sát. Kiểm tra kết nối rồi thử lại.");
  if (!data) return <LoadState loading={loading} missing={missing} error={error} retry={retry} label="khảo sát" />;
  return <SurveySend survey={data.survey} preferences={data.preferences} categories={data.categories} customers={data.customers} />;
}

/** Live POST segments/preview for the current filter, debounced so typing an age sends one request. */
function useSegmentPreview(filter: SegmentFilterValue) {
  // Remembers which filter the answer is for, so a newer filter reads as loading without a setState in the effect.
  const [state, setState] = useState<{ filter: SegmentFilterValue | null; preview: SegmentPreview | null; error: string | null }>({ filter: null, preview: null, error: null });
  const invalid = !!segmentAgeError(filter);
  useEffect(() => {
    if (invalid) return;
    const controller = new AbortController();
    const timer = setTimeout(() => previewSegment(filter, controller.signal)
      .then((preview) => setState({ filter, preview, error: null }))
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setState({ filter, preview: null, error: reason instanceof ApiError ? reason.message : "Chưa đếm được khách phù hợp. Kiểm tra kết nối rồi thử lại." });
      }), 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [filter, invalid]);
  if (invalid) return { preview: null, loading: false, error: null };
  return state.filter === filter ? { preview: state.preview, loading: false, error: state.error } : { preview: state.preview, loading: true, error: null };
}

export interface SurveySendProps {
  survey: SurveyInfo;
  preferences: readonly PreferenceOption[];
  categories: readonly PreferenceOption[];
  /** Active customers for manual selection. */
  customers: readonly RecipientCustomer[];
}

export function SurveySend({ survey: loaded, preferences, categories, customers }: SurveySendProps) {
  // A published draft becomes Open here, so retrying a failed recipients call does not publish twice.
  const [survey, setSurvey] = useState(loaded);
  const [mode, setMode] = useState<"segment" | "manual">("segment");
  const [filter, setFilter] = useState(emptySegmentFilter);
  const [picked, setPicked] = useState<number[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [sent, setSent] = useState<{ added: number; total: number } | null>(null);
  const segment = useSegmentPreview(filter);
  const code = `KS-${String(survey.id).padStart(4, "0")}`;
  const back = <Link href="/manager/surveys" className="mb-3 inline-flex min-h-12 items-center gap-1 font-label text-sm uppercase tracking-wider text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden="true" />Danh sách khảo sát</Link>;

  if (survey.status === "Closed") {
    return <>{back}<PageHeader eyebrow={code} title={survey.title} /><EmptyState title="Khảo sát đã đóng" description="Khảo sát đã đóng nên không gửi thêm được. Bạn vẫn xem được kết quả đã thu." action={<Link href={`/manager/surveys/${survey.id}/results`} className={cn(buttonVariants(), "h-12 px-4")}>Xem kết quả</Link>} /></>;
  }

  if (sent !== null) {
    return (
      <>
        {back}
        <PageHeader eyebrow={code} title="Đã gửi khảo sát" description={survey.title} actions={<StatusBadge kind="survey" status="Open" />} />
        <section role="status" className="rounded-lg border border-border bg-card p-4 sm:p-6">
          <p className="flex gap-2 text-status-sage-fg"><CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />Đã gửi cho {sent.added} khách hàng. Khảo sát hiện có {sent.total} người nhận.</p>
          <p className="mt-2 text-sm text-muted-foreground">Khảo sát xuất hiện trong Hộp khảo sát của khách và tạo một thông báo trong ứng dụng.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href={`/manager/surveys/${survey.id}/results`} className={cn(buttonVariants(), "h-12 px-4")}>Xem kết quả</Link>
            <Link href="/manager/surveys" className={cn(buttonVariants({ variant: "outline" }), "h-12 px-4")}>Về danh sách khảo sát</Link>
          </div>
        </section>
      </>
    );
  }

  const matched = segment.preview?.count ?? 0;
  const recipients = mode === "segment" ? matched : picked.length;

  function review() {
    if (mode === "segment" && segmentAgeError(filter)) return setProblem("Chưa gửi được: khoảng tuổi không hợp lệ. Sửa khoảng tuổi rồi thử lại.");
    if (mode === "segment" && (segment.loading || segment.error)) return setProblem("Chưa gửi được: chưa đếm xong khách phù hợp. Chờ một chút rồi thử lại.");
    if (recipients === 0) return setProblem(mode === "segment" ? "Chưa gửi được: không có khách phù hợp. Bỏ bớt tiêu chí rồi thử lại." : "Chưa gửi được: chưa chọn khách nào. Chọn ít nhất một khách rồi thử lại.");
    setProblem(null);
    setConfirming(true);
  }

  /** Recipients can only be added to an Open survey, so a draft is published first. Errors stay in the dialog. */
  async function send() {
    if (survey.status === "Draft") {
      await publishSurvey(survey.id);
      setSurvey((current) => ({ ...current, status: "Open" }));
    }
    setSent(await addRecipients(survey.id, mode === "segment" ? { segment: filter } : { customerIds: picked }));
  }

  return (
    <>
      {back}
      <PageHeader eyebrow={code} title="Gửi khảo sát" description="Chọn khách nhận khảo sát theo phân khúc hoặc chọn tay. Khảo sát được gửi trong ứng dụng." actions={<StatusBadge kind="survey" status={survey.status} />} />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <Tabs value={mode} onValueChange={(next) => { setMode(next as "segment" | "manual"); setProblem(null); }} className="min-w-0 gap-6">
          <TabsList variant="line" className="w-full justify-start overflow-x-auto border-b border-border">
            <TabsTrigger value="segment" className={tabTrigger}><SlidersHorizontal aria-hidden="true" />Theo phân khúc</TabsTrigger>
            <TabsTrigger value="manual" className={tabTrigger}><ListChecks aria-hidden="true" />Chọn thủ công</TabsTrigger>
          </TabsList>
          <TabsContent value="segment" className="space-y-6">
            <SegmentFilterBuilder value={filter} onChange={(next) => { setFilter(next); setProblem(null); }} preferences={preferences} categories={categories} matchCount={matched} />
            <SampleTable rows={segment.preview?.sample ?? []} total={matched} loading={segment.loading} error={segment.error} />
          </TabsContent>
          <TabsContent value="manual"><ManualPicker customers={customers} selected={picked} onChange={(ids) => { setPicked(ids); setProblem(null); }} /></TabsContent>
        </Tabs>

        <aside aria-labelledby="send-summary" className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-6 xl:sticky xl:top-22">
          <div className="border-b border-border pb-4">
            <p className="font-label text-sm uppercase tracking-wider text-gold-strong">Hồ sơ phát hành</p>
            <h2 id="send-summary" className="mt-1 font-heading text-xl">{survey.title}</h2>
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Mã khảo sát</dt><dd className="font-mono font-semibold">{code}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Hạn trả lời</dt><dd className="font-semibold">{survey.closeAt ? date.format(new Date(survey.closeAt)) : "Chưa đặt"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Kênh</dt><dd className="text-right font-semibold">Thông báo trong ứng dụng</dd></div>
            {survey.recipientCount > 0 && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Đã gửi trước đó</dt><dd className="font-semibold tabular-nums">{survey.recipientCount} khách</dd></div>}
            <div className="flex items-baseline justify-between gap-3 border-t border-border pt-3"><dt className="text-muted-foreground">Số khách sẽ nhận</dt><dd className="font-heading text-2xl lining-nums tabular-nums">{recipients}</dd></div>
          </dl>
          {survey.status === "Draft" && <p className="flex gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground"><Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />Gửi sẽ mở khảo sát; từ đó câu hỏi bị khóa, không sửa được nữa.</p>}
          {problem && <p role="alert" className="text-sm text-destructive">{problem}</p>}
          <Button type="button" className="h-12 w-full" onClick={review}><Send aria-hidden="true" />Gửi khảo sát</Button>
          <p className="text-xs text-muted-foreground">Khảo sát hiện trong Hộp khảo sát của khách ngay sau khi gửi. Không gửi qua email hay SMS.</p>
        </aside>
      </div>
      <ConfirmDialog portal="manager" appearance="soft" open={confirming} onOpenChange={setConfirming} icon={<Send className="size-4" />} eyebrow={`Xác nhận gửi ${code}`} title="Gửi khảo sát cho khách hàng?" confirmLabel="Gửi khảo sát"
        description={`“${survey.title}” sẽ được gửi cho ${recipients} khách hàng và hiện trong Hộp khảo sát của họ.`} onConfirm={send} />
    </>
  );
}
