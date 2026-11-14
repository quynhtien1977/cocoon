"use client";

import { useCallback, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Check, CircleCheck, MapPin, Package, ShoppingBag, Truck, UserRound } from "lucide-react";
import { ConfirmDialog } from "@/components/brand/confirm-dialog";
import { EmptyState } from "@/components/brand/empty-state";
import { PageHeader } from "@/components/brand/page-header";
import { StatusBadge } from "@/components/brand/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiData } from "@/lib/api/use-api-data";
import { cn } from "@/lib/utils";
import { ChannelChip } from "./orders-list";
import { confirmOrder, loadBackofficeOrderDetail, orderChannelLabels, type OrderDetail } from "./orders-service";

const dateTime = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Ho_Chi_Minh",
});

const shortDate = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Ho_Chi_Minh",
});

const vnd = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const caseCard = "min-w-0 rounded-lg border border-border bg-card p-4 sm:p-6";
const cardTitle = "flex items-center gap-2 border-b border-border pb-3 font-heading text-lg";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-2 text-sm last:border-0">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-semibold break-words">{children}</dd>
    </div>
  );
}

interface TimelineStep {
  key: string;
  label: string;
  time: string | null;
  active: boolean;
  done: boolean;
}

function buildSteps(order: OrderDetail): TimelineStep[] {
  const terminalStep: TimelineStep =
    order.status === "Cancelled"
      ? { key: "Cancelled", label: "Đã hủy", time: order.cancelledAt, active: false, done: true }
      : order.status === "Returned"
        ? { key: "Returned", label: "Đã trả hàng", time: order.completedAt ?? order.orderedAt, active: false, done: true }
        : {
            key: "Completed",
            label: "Hoàn thành",
            time: order.completedAt,
            active: false,
            done: Boolean(order.completedAt) || order.status === "Completed",
          };

  return [
    {
      key: "Placed",
      label: "Đặt hàng",
      time: order.orderedAt,
      active: order.status === "Placed",
      done: order.status !== "Placed",
    },
    {
      key: "Delivering",
      label: "Xác nhận & giao",
      time: order.confirmedAt,
      active: order.status === "Delivering",
      done: Boolean(order.confirmedAt) && order.status !== "Delivering",
    },
    terminalStep,
  ];
}

function OrderTimeline({ order }: { order: OrderDetail }) {
  const steps = buildSteps(order);
  return (
    <section aria-labelledby="order-timeline-title" className={caseCard}>
      <h2 id="order-timeline-title" className="mb-4 font-label text-sm uppercase tracking-wider text-muted-foreground">
        Tiến trình đơn hàng (3 bước)
      </h2>
      <ol className="grid gap-2 sm:grid-cols-3">
        {steps.map((step, index) => (
          <li
            key={step.key}
            aria-current={step.active ? "step" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md border p-3 sm:flex-col sm:items-start",
              step.active ? "border-gold bg-status-beige-bg" : "border-border bg-muted",
              !step.done && !step.active && !step.time && "opacity-70"
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                step.done
                  ? step.key === "Cancelled"
                    ? "bg-status-gray-bg text-status-gray-fg"
                    : "bg-status-sage-bg text-status-sage-fg"
                  : step.active
                    ? "bg-primary text-primary-foreground"
                    : "border border-input text-muted-foreground"
              )}
            >
              {step.done ? <Check className="size-4" /> : index + 1}
            </span>
            <span className="min-w-0 text-sm">
              <span className="block font-semibold">{step.label}</span>
              <span className="block text-xs text-muted-foreground">
                {step.time ? shortDate.format(new Date(step.time)) : "Chưa tới bước này"}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function OrderDetailView({ id, portal }: { id: number; portal: "staff" | "manager" }) {
  const listHref = `/${portal}/orders`;
  const load = useCallback((signal: AbortSignal) => loadBackofficeOrderDetail(id, signal), [id]);
  const { data, loading, error, missing, retry } = useApiData(load, "Chưa tải được chi tiết đơn hàng. Kiểm tra kết nối rồi thử lại.");
  const [optimisticOrder, setOptimisticOrder] = useState<OrderDetail | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (loading && !data) {
    return (
      <div role="status" className="space-y-4">
        <span className="sr-only">Đang tải chi tiết đơn hàng</span>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (missing) {
    return (
      <EmptyState
        icon={<Package className="size-5" />}
        title="Không tìm thấy đơn hàng"
        description="Đơn hàng không tồn tại hoặc đã bị xóa."
        action={
          <Link href={listHref} className={cn(buttonVariants(), "h-12 px-4")}>
            Về danh sách đơn hàng
          </Link>
        }
      />
    );
  }

  if (error || !data) {
    return (
      <div role="alert">
        <EmptyState
          icon={<Package className="size-5" />}
          title="Chưa tải được đơn hàng"
          description={error ?? "Hãy thử lại."}
          action={
            <Button type="button" className="h-12 px-4" onClick={retry}>
              Thử lại
            </Button>
          }
        />
      </div>
    );
  }

  const order = optimisticOrder && data.status === "Placed" ? optimisticOrder : data;
  const customerCode = `KH-${String(order.customer.id).padStart(4, "0")}`;

  async function handleConfirm() {
    await confirmOrder(id);
    setOptimisticOrder({
      ...order,
      status: "Delivering",
      confirmedAt: new Date().toISOString(),
    });
    setNotice(`Đã xác nhận và chuyển đơn #${order.code} sang trạng thái Đang giao. Khách hàng sẽ nhận được thông báo.`);
    retry();
  }

  return (
    <>
      <Link
        href={listHref}
        className="mb-3 inline-flex min-h-12 items-center gap-1 font-label text-sm uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Danh sách đơn hàng
      </Link>

      <PageHeader
        title={`Đơn hàng #${order.code}`}
        description={`${order.customer.fullName} · Kênh ${orderChannelLabels[order.channel] ?? order.channel} · Đặt lúc ${dateTime.format(new Date(order.orderedAt))}`}
        actions={<StatusBadge kind="order" status={order.status} className="self-center whitespace-nowrap" />}
      />

      {order.status === "Placed" && (
        <section
          aria-label="Thao tác điều phối"
          className={cn(caseCard, "mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between")}
        >
          <div className="space-y-1">
            <p className="font-label text-xs uppercase tracking-wider text-gold-strong">Đơn Website mới · Chờ xử lý</p>
            <p className="text-sm text-muted-foreground">
              Kiểm tra thông tin sản phẩm và địa chỉ giao hàng, sau đó xác nhận để chuyển đơn sang trạng thái{" "}
              <strong className="font-semibold text-foreground">Đang giao</strong>.
            </p>
          </div>
          <ConfirmDialog
            portal={portal}
            title={`Xác nhận và giao đơn #${order.code}?`}
            description={`Đơn hàng của ${order.customer.fullName} sẽ chuyển sang trạng thái Đang giao và gửi thông báo cho khách hàng. Thao tác này không thể hoàn tác.`}
            confirmLabel="Xác nhận và giao"
            cancelLabel="Để sau"
            trigger={
              <Button type="button" className="h-12 shrink-0 px-4">
                <Truck aria-hidden="true" />
                Xác nhận và giao
              </Button>
            }
            onConfirm={handleConfirm}
          />
        </section>
      )}

      <div aria-live="polite">
        {notice && (
          <p className="mb-6 flex items-center gap-2 rounded-md border border-border bg-status-sage-bg p-3 text-sm text-status-sage-fg">
            <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
            {notice}
          </p>
        )}
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <OrderTimeline order={order} />

          <section aria-labelledby="order-items-heading" className={caseCard}>
            <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
              <h2 id="order-items-heading" className="flex items-center gap-2 font-heading text-lg">
                <ShoppingBag className="size-5 text-gold-strong" aria-hidden="true" />
                Chi tiết sản phẩm
              </h2>
              <span className="font-label text-xs uppercase tracking-wider text-muted-foreground tabular-nums">
                {order.lines.length} mặt hàng
              </span>
            </div>

            <ul className="mt-4 divide-y divide-border sm:hidden">
              {order.lines.map((line) => (
                <li key={line.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-muted">
                    {line.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={line.imageUrl} alt={line.productName} className="size-full object-cover" />
                    ) : (
                      <Package className="size-4 text-muted-foreground" aria-hidden="true" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-semibold text-foreground">{line.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      {line.variantName} · <span className="font-mono">{line.sku}</span>
                    </p>
                    <div className="flex items-center justify-between gap-2 text-xs pt-1">
                      <span className="text-muted-foreground tabular-nums">
                        {vnd.format(line.unitPrice)} × {line.quantity}
                      </span>
                      <span className="font-semibold text-foreground tabular-nums">
                        {vnd.format(line.unitPrice * line.quantity)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-4 hidden sm:block">
              <Table>
                <TableCaption className="sr-only">Danh sách sản phẩm trong đơn hàng #{order.code}</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sản phẩm</TableHead>
                    <TableHead className="text-right">Đơn giá</TableHead>
                    <TableHead className="text-right">SL</TableHead>
                    <TableHead className="text-right">Thành tiền</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="whitespace-normal">
                        <div className="flex items-center gap-3">
                          <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-muted">
                            {line.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={line.imageUrl} alt={line.productName} className="size-full object-cover" />
                            ) : (
                              <Package className="size-4 text-muted-foreground" aria-hidden="true" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground">{line.productName}</p>
                            <p className="text-xs text-muted-foreground">
                              {line.variantName} · <span className="font-mono">{line.sku}</span>
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums whitespace-nowrap">{vnd.format(line.unitPrice)}</TableCell>
                      <TableCell className="text-right tabular-nums whitespace-nowrap">x{line.quantity}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums whitespace-nowrap">
                        {vnd.format(line.unitPrice * line.quantity)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
              <span className="text-sm font-semibold text-foreground">Tổng giá trị đơn hàng</span>
              <span className="font-heading text-xl font-bold tabular-nums text-gold-strong whitespace-nowrap">
                {vnd.format(order.totalAmount)}
              </span>
            </div>
          </section>
        </div>

        <div className="min-w-0 space-y-6">
          <section aria-labelledby="customer-info-heading" className={caseCard}>
            <h2 id="customer-info-heading" className={cardTitle}>
              <UserRound className="size-5 text-gold-strong" aria-hidden="true" />
              Tóm tắt khách hàng
            </h2>
            <dl className="mt-2">
              <Row label="Họ tên">{order.customer.fullName}</Row>
              <Row label="Mã hồ sơ">
                <span className="font-mono text-xs">{customerCode}</span>
              </Row>
              <Row label="Điện thoại">{order.customer.phone ?? "Chưa cung cấp"}</Row>
              <Row label="Email">{order.customer.email || "Chưa cung cấp"}</Row>
            </dl>
            {portal === "manager" && (
              <div className="mt-4 border-t border-border pt-3">
                <Link
                  href={`/manager/customers/${order.customer.id}`}
                  className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-gold-strong underline-offset-4 hover:underline"
                >
                  Mở hồ sơ khách hàng →
                </Link>
              </div>
            )}
          </section>

          <section aria-labelledby="shipping-info-heading" className={caseCard}>
            <h2 id="shipping-info-heading" className={cardTitle}>
              <MapPin className="size-5 text-gold-strong" aria-hidden="true" />
              Thông tin giao nhận
            </h2>
            <dl className="mt-2">
              <Row label="Kênh bán">
                <ChannelChip channel={order.channel} />
              </Row>
              <Row label="Địa chỉ nhận hàng">{order.shippingAddress ?? "Mua trực tiếp tại cửa hàng"}</Row>
              <Row label="Người xác nhận">{order.confirmedByName ?? "Chưa xác nhận"}</Row>
              <Row label="Đặt lúc">
                <time dateTime={order.orderedAt} className="whitespace-nowrap">
                  {dateTime.format(new Date(order.orderedAt))}
                </time>
              </Row>
              <Row label="Xác nhận lúc">
                {order.confirmedAt ? (
                  <time dateTime={order.confirmedAt} className="whitespace-nowrap">
                    {dateTime.format(new Date(order.confirmedAt))}
                  </time>
                ) : (
                  "Chưa có"
                )}
              </Row>
              {order.status === "Cancelled" ? (
                <Row label="Hủy lúc">
                  {order.cancelledAt ? (
                    <time dateTime={order.cancelledAt} className="whitespace-nowrap">
                      {dateTime.format(new Date(order.cancelledAt))}
                    </time>
                  ) : (
                    "Đã hủy"
                  )}
                </Row>
              ) : (
                <Row label="Hoàn thành lúc">
                  {order.completedAt ? (
                    <time dateTime={order.completedAt} className="whitespace-nowrap">
                      {dateTime.format(new Date(order.completedAt))}
                    </time>
                  ) : (
                    "Chưa hoàn thành"
                  )}
                </Row>
              )}
            </dl>
          </section>
        </div>
      </div>
    </>
  );
}
