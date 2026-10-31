"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Archive, BadgeInfo, CircleCheck, ClipboardCheck, Lock, LockOpen, ReceiptText, Star, UserRound } from "lucide-react";
import { ConfirmDialog } from "@/components/brand/confirm-dialog";
import { EmptyState } from "@/components/brand/empty-state";
import { PageHeader } from "@/components/brand/page-header";
import { RatingStars } from "@/components/brand/rating-stars";
import { StatTile } from "@/components/brand/stat-tile";
import { StatusBadge } from "@/components/brand/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { screen } from "@/lib/screens";
import { cn } from "@/lib/utils";
import type { CustomerDetail as Customer, RecommendationState } from "../types";

const date = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" });
const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });
const score = new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rating = new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const tabTrigger = "min-h-12 flex-none rounded-none px-4 font-label text-sm uppercase tracking-wider";
const panel = "min-w-0 rounded-lg border border-border bg-card p-4 sm:p-6";
const stateLabels: Record<RecommendationState, [string, string]> = {
  Clicked: ["Đã bấm xem", "bg-status-sage-bg text-status-sage-fg"],
  Dismissed: ["Đã bỏ qua", "bg-status-lotus-bg text-status-lotus-fg"],
  None: ["Chưa tương tác", "bg-status-gray-bg text-status-gray-fg"],
};

function Info({ label, children }: { label: string; children: ReactNode }) {
  return <div className="border-b border-border py-3 last:border-0 sm:grid sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-4"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-semibold break-words sm:mt-0">{children}</dd></div>;
}

/** scoreBreakdown is passed in by the route: features/customers must not import features/recommendations. */
export function CustomerDetail({ initial, scoreBreakdown }: { initial: Customer; scoreBreakdown?: ReactNode }) {
  const s = screen("M4");
  const [customer, setCustomer] = useState(initial);
  const [deleted, setDeleted] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const locked = customer.status === "Locked";
  const avgRating = customer.feedback.length ? customer.feedback.reduce((sum, item) => sum + item.rating, 0) / customer.feedback.length : null;
  const doneSurveys = customer.surveys.filter((item) => item.status === "Done").length;
  const lastOrder = customer.orders[0];

  // Static phase: changes live in this page's state only, until customers/{id}/lock, unlock and DELETE are wired up.
  function toggleLock() {
    setCustomer((current) => ({ ...current, status: locked ? "Active" : "Locked" }));
    setNotice(`${locked ? "Đã mở khóa" : "Đã khóa"} tài khoản ${customer.fullName} (dữ liệu mẫu, chưa gửi máy chủ).`);
  }

  if (deleted) {
    return (
      <>
        <PageHeader eyebrow={s.code} title="Đã xóa khách hàng" description={`Hồ sơ ${customer.fullName} (${customer.code}) đã được xóa mềm (dữ liệu mẫu, chưa gửi máy chủ).`} />
        <Link href="/manager/customers" className={cn(buttonVariants(), "h-12 px-4")}>Về danh sách khách hàng</Link>
      </>
    );
  }

  return (
    <>
      <Link href="/manager/customers" className="mb-3 inline-flex min-h-12 items-center gap-1 font-label text-sm uppercase tracking-wider text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden="true" />Danh sách khách hàng</Link>
      <PageHeader eyebrow={`${s.code} · ${customer.code}`} title={`Hồ sơ khách hàng: ${customer.fullName}`} actions={<>
        <StatusBadge kind="account" status={customer.status} className="self-center whitespace-nowrap" />
        <ConfirmDialog portal="manager" title={locked ? "Mở khóa tài khoản?" : "Khóa tài khoản?"} confirmLabel={locked ? "Mở khóa" : "Khóa tài khoản"}
          description={locked ? `${customer.fullName} sẽ đăng nhập lại được.` : `${customer.fullName} sẽ không đăng nhập được cho đến khi được mở khóa. Dữ liệu vẫn được giữ.`}
          trigger={<Button type="button" variant="outline" className="h-12 px-4">{locked ? <LockOpen aria-hidden="true" /> : <Lock aria-hidden="true" />}{locked ? "Mở khóa" : "Khóa tài khoản"}</Button>} onConfirm={toggleLock} />
        <ConfirmDialog portal="manager" title="Xóa khách hàng?" description={`Hồ sơ ${customer.fullName} chuyển sang không hoạt động và không đăng nhập được nữa. Lịch sử đơn hàng và phản hồi vẫn được giữ lại.`} confirmLabel="Xóa khách hàng"
          trigger={<Button type="button" variant="outline" className="h-12 px-4 text-destructive"><Archive aria-hidden="true" />Xóa khách hàng</Button>} onConfirm={() => setDeleted(true)} />
      </>} />
      <p className="mb-6 flex gap-2 rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground"><BadgeInfo className="mt-0.5 size-4 shrink-0 text-gold-strong" aria-hidden="true" /><span><strong className="font-semibold text-foreground">Xóa mềm:</strong> giữ nguyên lịch sử đơn hàng và phản hồi, chỉ chuyển tài khoản sang không hoạt động.</span></p>
      <div aria-live="polite">{notice && <p className="mb-6 flex items-center gap-2 rounded-md border border-border bg-status-sage-bg p-3 text-sm text-status-sage-fg"><CircleCheck className="size-4 shrink-0" aria-hidden="true" />{notice}</p>}</div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatTile label="Tham gia" value={date.format(new Date(customer.joinedAt))} icon={<UserRound />} hint={customer.email} className="[&_dd]:text-xl sm:[&_dd]:text-2xl [&_p]:break-all" />
        <StatTile label="Giao dịch" value={customer.orderCount} unit="đơn" icon={<ReceiptText />} hint={`Tổng ${money.format(customer.totalSpent)}${lastOrder ? ` · gần nhất ${date.format(new Date(lastOrder.placedAt))}` : ""}`} />
        <StatTile label="Hài lòng" value={avgRating === null ? "—" : rating.format(avgRating)} unit={avgRating === null ? undefined : "/5"} icon={<Star />} hint={`${customer.feedback.length} phản hồi`} />
        <StatTile label="Khảo sát" value={doneSurveys} unit={`/${customer.surveys.length}`} icon={<ClipboardCheck />} hint={`${customer.surveys.length - doneSurveys} khảo sát chưa làm`} />
      </div>

      <Tabs defaultValue="profile" className="gap-6">
        <TabsList variant="line" className="h-auto w-full justify-start overflow-x-auto border-b border-border">
          <TabsTrigger value="profile" className={tabTrigger}>Hồ sơ & sở thích</TabsTrigger>
          <TabsTrigger value="orders" className={tabTrigger}>Đơn hàng ({customer.orders.length})</TabsTrigger>
          <TabsTrigger value="feedback" className={tabTrigger}>Phản hồi ({customer.feedback.length})</TabsTrigger>
          <TabsTrigger value="surveys" className={tabTrigger}>Khảo sát ({customer.surveys.length})</TabsTrigger>
          <TabsTrigger value="recommendations" className={tabTrigger}>Gợi ý</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <section aria-label="Thông tin cá nhân" className={panel}>
            <dl>
              <Info label="Họ tên">{customer.fullName}</Info>
              <Info label="Email">{customer.email}</Info>
              <Info label="Điện thoại">{customer.phone ?? "—"}</Info>
              <Info label="Ngày sinh">{customer.dateOfBirth ? date.format(new Date(customer.dateOfBirth)) : "—"}</Info>
              <Info label="Giới tính">{customer.gender ?? "—"}</Info>
              <Info label="Địa chỉ">{customer.address ?? "—"}</Info>
            </dl>
          </section>
          <section aria-labelledby="preferences-title" className={panel}>
            <h2 id="preferences-title" className="font-heading text-xl">Sở thích</h2>
            {customer.preferences.length ? <ul className="mt-3 flex flex-wrap gap-2">{customer.preferences.map((item) => <li key={item} className="rounded-sm bg-status-beige-bg px-2 py-1 font-label text-sm text-status-beige-fg">{item}</li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">Chưa có sở thích.</p>}
          </section>
        </TabsContent>

        <TabsContent value="orders">
          {customer.orders.length ? (
            <section className={panel}>
              <Table>
                <TableCaption className="sr-only">Đơn hàng của {customer.fullName}</TableCaption>
                <TableHeader><TableRow><TableHead>Mã đơn</TableHead><TableHead>Ngày đặt</TableHead><TableHead className="text-right">Số sản phẩm</TableHead><TableHead className="text-right">Tổng tiền</TableHead><TableHead>Trạng thái</TableHead></TableRow></TableHeader>
                <TableBody>{customer.orders.map((order) => (
                  <TableRow key={order.id}><TableCell className="font-mono text-xs">#{order.code}</TableCell><TableCell>{date.format(new Date(order.placedAt))}</TableCell><TableCell className="text-right tabular-nums">{order.itemCount}</TableCell><TableCell className="text-right tabular-nums">{money.format(order.total)}</TableCell><TableCell><StatusBadge kind="order" status={order.status} className="whitespace-nowrap" /></TableCell></TableRow>
                ))}</TableBody>
              </Table>
            </section>
          ) : <EmptyState title="Chưa có đơn hàng" description="Khách hàng này chưa mua sản phẩm nào." />}
        </TabsContent>

        <TabsContent value="feedback">
          {customer.feedback.length ? (
            <ul className="grid gap-3 lg:grid-cols-2">{customer.feedback.map((item) => (
              <li key={item.id} className="grid">
                <Link href={`/manager/feedback/${item.id}`} className={cn(panel, "block space-y-2 hover:border-gold focus-visible:outline-2 focus-visible:outline-ring")}>
                  <span className="flex items-start justify-between gap-3"><span className="min-w-0 font-semibold">{item.productName}</span><StatusBadge kind="feedback" status={item.status} className="shrink-0 whitespace-nowrap" /></span>
                  <RatingStars value={item.rating} />
                  <span className="block text-sm text-muted-foreground">{item.content}</span>
                  <time dateTime={item.createdAt} className="block text-xs text-muted-foreground">{date.format(new Date(item.createdAt))}</time>
                </Link>
              </li>
            ))}</ul>
          ) : <EmptyState title="Chưa có phản hồi" description="Khách hàng này chưa gửi phản hồi." />}
        </TabsContent>

        <TabsContent value="surveys">
          <ul className={cn(panel, "divide-y divide-border py-2 sm:py-2")}>{customer.surveys.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span className="min-w-0"><span className="block font-semibold">{item.title}</span><span className="block text-xs text-muted-foreground">Gửi ngày {date.format(new Date(item.sentAt))}</span></span>
              <StatusBadge kind="recipient" status={item.status} className="whitespace-nowrap" />
            </li>
          ))}</ul>
        </TabsContent>

        <TabsContent value="recommendations" className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          {scoreBreakdown}
          <section aria-labelledby="suggested-title" className={panel}>
            <h2 id="suggested-title" className="font-heading text-xl">Sản phẩm đang gợi ý</h2>
            <ul className="mt-3 divide-y divide-border">{customer.recommendations.map((item) => (
              <li key={item.id} className="space-y-1 py-3">
                <span className="flex items-start justify-between gap-3"><span className="min-w-0 font-semibold">{item.productName}</span><span className="shrink-0 font-mono text-sm font-bold tabular-nums text-gold-strong">{score.format(item.score)}</span></span>
                <span className="block text-sm text-muted-foreground">{item.reason}</span>
                <span className={cn("inline-block rounded-sm px-2 py-0.5 font-label text-xs uppercase tracking-wider", stateLabels[item.state][1])}>{stateLabels[item.state][0]}</span>
              </li>
            ))}</ul>
          </section>
        </TabsContent>
      </Tabs>
    </>
  );
}
