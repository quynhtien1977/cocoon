import type { ReactNode } from "react";
import { BadgeCheck, Check, PackageCheck, Sprout, UserRound } from "lucide-react";
import { statusMap } from "@/components/brand/status-badge";
import { cn } from "@/lib/utils";
import type { FeedbackDetail, FeedbackStatus } from "../types";

const steps: FeedbackStatus[] = ["New", "Accepted", "Assigned", "Replied", "Closed"];
const shortDate = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
const fullDate = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" });
const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });

export const caseCard = "min-w-0 rounded-lg border border-border bg-card p-4 sm:p-6";
const cardTitle = "flex items-center gap-2 border-b border-border pb-3 font-heading text-lg";

/** Five-step progress shared by M6 and S2; an ordered list so screen readers keep the sequence. */
export function FeedbackTimeline({ status, times }: { status: FeedbackStatus; times: FeedbackDetail["statusTimes"] }) {
  const current = steps.indexOf(status);
  return (
    <section aria-labelledby="timeline-title" className={caseCard}>
      <h2 id="timeline-title" className="mb-4 font-label text-sm uppercase tracking-wider text-muted-foreground">Tiến trình xử lý (5 bước)</h2>
      <ol className="grid gap-2 sm:grid-cols-5">
        {steps.map((step, index) => {
          const done = index < current || status === "Closed";
          const active = index === current && status !== "Closed";
          const time = times[step];
          return (
            <li key={step} aria-current={active ? "step" : undefined} className={cn("flex items-center gap-3 rounded-md border p-3 sm:flex-col sm:items-start", active ? "border-gold bg-status-beige-bg" : "border-border bg-muted", index > current && "opacity-70")}>
              <span aria-hidden="true" className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold", done ? "bg-status-sage-bg text-status-sage-fg" : active ? "bg-primary text-primary-foreground" : "border border-input text-muted-foreground")}>{done ? <Check className="size-4" /> : index + 1}</span>
              <span className="min-w-0 text-sm">
                <span className="block font-semibold">{statusMap.feedback[step][0]}</span>
                <span className="block text-xs text-muted-foreground">{time ? shortDate.format(new Date(time)) : "Chưa tới bước này"}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex justify-between gap-4 border-b border-border py-2 text-sm last:border-0"><dt className="shrink-0 text-muted-foreground">{label}</dt><dd className="min-w-0 text-right font-semibold break-words">{children}</dd></div>;
}

export function CustomerSummary({ feedback }: { feedback: FeedbackDetail }) {
  return (
    <section aria-labelledby="customer-title" className={caseCard}>
      <h2 id="customer-title" className={cardTitle}><UserRound className="size-5 text-gold-strong" aria-hidden="true" />Tóm tắt khách hàng</h2>
      <dl className="mt-2">
        <Row label="Họ tên">{feedback.customerName}</Row>
        <Row label="Mã hồ sơ">{feedback.customerCode}</Row>
        <Row label="Điện thoại">{feedback.customerPhone ?? "—"}</Row>
        <Row label="Email">{feedback.customerEmail}</Row>
        <Row label="Số đơn hoàn tất">{feedback.customerOrderCount}</Row>
      </dl>
      <ul aria-label="Sở thích" className="mt-3 flex flex-wrap gap-1">{feedback.customerPreferences.map((item) => <li key={item} className="rounded-sm bg-status-beige-bg px-2 py-0.5 font-label text-xs text-status-beige-fg">{item}</li>)}</ul>
    </section>
  );
}

export function OrderProductSummary({ feedback }: { feedback: FeedbackDetail }) {
  return (
    <section aria-labelledby="product-title" className={caseCard}>
      <h2 id="product-title" className={cardTitle}><Sprout className="size-5 text-gold-strong" aria-hidden="true" />Sản phẩm & đơn hàng</h2>
      <dl className="mt-2">
        <Row label="Sản phẩm">{feedback.productName}</Row>
        <Row label="Danh mục">{feedback.categoryName}</Row>
        <Row label="Mã SKU">{feedback.sku}</Row>
        <Row label="Giá niêm yết">{money.format(feedback.price)}</Row>
        <Row label="Mã đơn">{feedback.orderCode ? `#${feedback.orderCode}` : "Không gắn đơn"}</Row>
        {feedback.orderCompletedAt && <Row label="Hoàn tất"><span className="inline-flex items-center gap-1 text-status-sage-fg"><PackageCheck className="size-4" aria-hidden="true" />{fullDate.format(new Date(feedback.orderCompletedAt))}</span></Row>}
      </dl>
      {feedback.verifiedPurchase && <p className="mt-3 flex items-center gap-1 text-sm text-status-sage-fg"><BadgeCheck className="size-4" aria-hidden="true" />Đã mua hàng</p>}
    </section>
  );
}
