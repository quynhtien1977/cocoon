"use client";

import Link from "next/link";
import { ArrowLeft, CalendarDays, CircleCheck, Download, PieChart, Send, Star } from "lucide-react";
import { EmptyState } from "@/components/brand/empty-state";
import { PageHeader } from "@/components/brand/page-header";
import { StatTile } from "@/components/brand/stat-tile";
import { StatusBadge } from "@/components/brand/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { screen } from "@/lib/screens";
import { cn } from "@/lib/utils";
import { purposeLabels, questionTypeLabels, surveyResultsToCsv } from "../schemas";
import type { ChoiceResult, QuestionResult, RatingResult, SurveyListItem, TextResult } from "../types";

const date = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" });
const percent = new Intl.NumberFormat("vi-VN", { style: "percent", maximumFractionDigits: 1 });
const average = new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const ratio = (part: number, total: number) => total ? part / total : 0;

function Bar({ value, tone }: { value: number; tone: string }) {
  return <span aria-hidden="true" className="block h-3 w-full bg-muted"><span className={cn("block h-full", tone)} style={{ width: `${value * 100}%` }} /></span>;
}

function ChoiceBody({ question }: { question: ChoiceResult }) {
  const options = [...question.options].sort((a, b) => b.count - a.count);
  const top = options[0];
  return (
    <>
      <ul className="space-y-3">
        {options.map((option, index) => (
          <li key={option.text} className="space-y-1">
            <span className="flex flex-wrap justify-between gap-x-3 text-sm"><span className="font-semibold">{option.text}</span><span className="tabular-nums">{option.count} lượt ({percent.format(ratio(option.count, question.answerCount))})</span></span>
            <Bar value={ratio(option.count, question.answerCount)} tone={index === 0 ? "bg-status-sage-fg" : "bg-gold"} />
          </li>
        ))}
      </ul>
      {top && top.count > 0 && <p className="mt-4 border-t border-border pt-3 text-sm text-muted-foreground">Chọn nhiều nhất: <strong className="font-semibold text-foreground">{top.text}</strong></p>}
    </>
  );
}

function RatingBody({ question }: { question: RatingResult }) {
  const high = question.distribution[5] + question.distribution[4];
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-4 rounded-md bg-muted p-4">
        <span className="font-heading text-4xl lining-nums tabular-nums">{average.format(question.average)}<span className="text-base text-muted-foreground">/5</span></span>
        <span className="text-sm text-muted-foreground">{percent.format(ratio(high, question.answerCount))} khách chấm 4–5 sao</span>
      </div>
      <ul className="space-y-2">
        {([5, 4, 3, 2, 1] as const).map((star) => {
          const count = question.distribution[star];
          return (
            <li key={star} className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-2 text-sm">
              <span className="flex items-center gap-1 font-semibold">{star}<Star className="size-3.5 fill-gold text-gold" aria-label="sao" /></span>
              <Bar value={ratio(count, question.answerCount)} tone="bg-gold" />
              <span className="text-right tabular-nums">{count} lượt ({percent.format(ratio(count, question.answerCount))})</span>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function TextBody({ question }: { question: TextResult }) {
  if (question.answers.length === 0) return <p className="text-sm text-muted-foreground">Chưa có câu trả lời.</p>;
  return (
    <ul className="space-y-3">
      {question.answers.map((answer) => (
        <li key={answer.customerName} className="rounded-md border-l-2 border-gold bg-muted p-3">
          <p className="text-sm italic">“{answer.content}”</p>
          <p className="mt-2 font-label text-xs uppercase tracking-wider text-muted-foreground">{answer.customerName}</p>
        </li>
      ))}
    </ul>
  );
}

function QuestionCard({ question, index }: { question: QuestionResult; index: number }) {
  return (
    <article className="min-w-0 rounded-lg border border-border bg-card p-4 sm:p-6">
      <header className="mb-4">
        <p className="flex flex-wrap justify-between gap-x-3 gap-y-1"><span className="font-label text-xs uppercase tracking-wider text-gold-strong">Câu {index + 1} · {questionTypeLabels[question.kind]}</span><span className="text-sm text-muted-foreground tabular-nums">{question.answerCount} câu trả lời</span></p>
        <h3 className="mt-2 font-heading text-lg">{question.text}</h3>
      </header>
      {question.kind === "Rating" ? <RatingBody question={question} /> : question.kind === "ShortText" ? <TextBody question={question} /> : <ChoiceBody question={question} />}
    </article>
  );
}

function downloadCsv(survey: SurveyListItem, results: readonly QuestionResult[]) {
  const url = URL.createObjectURL(new Blob([surveyResultsToCsv(results)], { type: "text/csv;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: `ket-qua-khao-sat-${survey.id}.csv` });
  link.click();
  URL.revokeObjectURL(url);
}

export function SurveyResults({ survey, results }: { survey: SurveyListItem; results: readonly QuestionResult[] }) {
  const s = screen("M10");
  const code = `KS-${String(survey.id).padStart(4, "0")}`;
  const back = <Link href="/manager/surveys" className="mb-3 inline-flex min-h-12 items-center gap-1 font-label text-sm uppercase tracking-wider text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden="true" />Danh sách khảo sát</Link>;

  if (survey.status === "Draft") {
    return <>{back}<PageHeader eyebrow={`${s.code} · ${code}`} title={survey.title} /><EmptyState title="Chưa có kết quả" description="Khảo sát còn là bản nháp. Gửi khảo sát cho khách để bắt đầu thu câu trả lời." action={<Link href={`/manager/surveys/${survey.id}/send`} className={cn(buttonVariants(), "h-12 px-4")}>Gửi khảo sát</Link>} /></>;
  }

  const rate = ratio(survey.responseCount, survey.recipientCount);
  const period = `${survey.openAt ? date.format(new Date(survey.openAt)) : "…"} – ${survey.closeAt ? date.format(new Date(survey.closeAt)) : "…"}`;

  return (
    <>
      {back}
      <PageHeader eyebrow={`${s.code} · ${code}`} title={`Kết quả khảo sát: ${survey.title}`} actions={
        <Button type="button" variant="outline" className="h-12 px-4" onClick={() => downloadCsv(survey, results)}><Download aria-hidden="true" />Xuất CSV</Button>
      } />
      <p className="-mt-3 mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4 text-gold-strong" aria-hidden="true" />{period}</span>
        <span>Mục đích: {purposeLabels[survey.purpose]}</span>
        <StatusBadge kind="survey" status={survey.status} />
      </p>
      <div className="mb-6 grid gap-3 sm:grid-cols-3 sm:gap-4">
        <StatTile label="Đã gửi" value={survey.recipientCount} unit="khách" icon={<Send />} />
        <StatTile label="Đã hoàn thành" value={survey.responseCount} unit="phiếu" icon={<CircleCheck />} />
        <StatTile label="Tỷ lệ hoàn thành" value={percent.format(rate)} icon={<PieChart />} progress={rate} hint={`${survey.responseCount}/${survey.recipientCount} khách`} />
      </div>
      {survey.status === "Open" && <p className="mb-6 rounded-md bg-muted p-3 text-sm text-muted-foreground">Khảo sát đang mở nên số liệu có thể còn thay đổi.</p>}
      <section aria-labelledby="question-results">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-2">
          <h2 id="question-results" className="font-heading text-xl">Kết quả từng câu hỏi</h2>
          <span className="font-label text-xs uppercase tracking-wider text-muted-foreground">Tổng mẫu: N = {survey.responseCount}</span>
        </div>
        {results.length === 0 ? <EmptyState title="Chưa có câu trả lời" description="Kết quả sẽ hiện khi khách bắt đầu trả lời khảo sát." />
          : <div className="grid gap-4 lg:grid-cols-2">{results.map((question, index) => <QuestionCard key={question.text} question={question} index={index} />)}</div>}
      </section>
    </>
  );
}
