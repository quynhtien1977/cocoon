"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CircleCheck, Download, Hourglass, ShoppingBag, Truck } from "lucide-react";
import { PageHeader } from "@/components/brand/page-header";
import { StatTile } from "@/components/brand/stat-tile";
import { StatusBadge, statusMap } from "@/components/brand/status-badge";
import { DataTable, type DataColumn, type DataFilter } from "@/components/data/data-table";
import { updateTableParams } from "@/components/data/table-state";
import { Button } from "@/components/ui/button";
import type { OrderStatus } from "@/features/customer/orders-service";
import { useApiData } from "@/lib/api/use-api-data";
import { screen } from "@/lib/screens";
import { cn } from "@/lib/utils";
import {
  loadAllBackofficeOrders,
  orderChannelLabels,
  ordersToCsv,
  type OrderChannel,
  type OrderRow,
} from "./orders-service";

const dateTime = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Ho_Chi_Minh",
});

const vnd = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const PREFIX = "orders.";
const customerCode = (customerId: number) => `KH-${String(customerId).padStart(4, "0")}`;
const statuses: OrderStatus[] = ["Placed", "Delivering", "Completed", "Cancelled", "Returned"];
const channels: OrderChannel[] = ["Website", "Store", "Marketplace"];

const channelTones: Record<OrderChannel, string> = {
  Website: "bg-status-sage-bg text-status-sage-fg",
  Store: "bg-status-beige-bg text-status-beige-fg",
  Marketplace: "bg-status-turmeric-bg text-status-turmeric-fg",
};

export function ChannelChip({ channel }: { channel: OrderChannel }) {
  return (
    <span
      className={cn(
        "inline-block rounded-sm px-2 py-0.5 font-label text-xs uppercase tracking-wider whitespace-nowrap",
        channelTones[channel] ?? "bg-status-gray-bg text-status-gray-fg"
      )}
    >
      {orderChannelLabels[channel] ?? channel}
    </span>
  );
}

const actionClass =
  "inline-flex min-h-12 items-center rounded-md px-3 font-label text-sm uppercase tracking-wider whitespace-nowrap focus-visible:outline-2 focus-visible:outline-ring";

function OrderActionLink({ portal, row }: { portal: "staff" | "manager"; row: OrderRow }) {
  const needsAction = row.status === "Placed";
  return (
    <Link
      href={`/${portal}/orders/${row.id}`}
      aria-label={`${needsAction ? "Xử lý đơn" : "Xem đơn"} #${row.code}`}
      className={cn(
        actionClass,
        needsAction ? "bg-primary text-primary-foreground hover:bg-primary/80" : "border border-input hover:bg-muted"
      )}
    >
      {needsAction ? "Xử lý ngay" : "Xem chi tiết"}
    </Link>
  );
}

function buildColumns(portal: "staff" | "manager"): DataColumn<OrderRow>[] {
  return [
    {
      id: "code",
      header: "Mã đơn",
      value: (row) => row.code,
      sortable: true,
      cell: (row) => <span className="font-mono text-xs font-semibold text-gold-strong">#{row.code}</span>,
    },
    {
      // Search matches customer name, customer code and order code.
      id: "customer",
      header: "Khách hàng",
      value: (row) => `${row.customerName} ${customerCode(row.customerId)} ${row.code}`,
      sortable: true,
      cell: (row) => (
        <span className="block min-w-36">
          <span className="block font-semibold text-foreground">{row.customerName}</span>
          <span className="block font-mono text-xs text-muted-foreground">{customerCode(row.customerId)}</span>
        </span>
      ),
    },
    {
      id: "channel",
      header: "Kênh bán",
      value: (row) => orderChannelLabels[row.channel] ?? row.channel,
      sortable: true,
      cell: (row) => <ChannelChip channel={row.channel} />,
    },
    {
      id: "orderedAt",
      header: "Ngày đặt",
      value: (row) => row.orderedAt,
      sortable: true,
      searchable: false,
      cell: (row) => (
        <time dateTime={row.orderedAt} className="block w-24 whitespace-normal text-xs text-muted-foreground tabular-nums">
          {dateTime.format(new Date(row.orderedAt))}
        </time>
      ),
    },
    {
      id: "itemCount",
      header: "Số SP",
      value: (row) => row.itemCount,
      sortable: true,
      searchable: false,
      cell: (row) => <span className="whitespace-nowrap tabular-nums text-muted-foreground">{row.itemCount} SP</span>,
    },
    {
      id: "totalAmount",
      header: "Tổng tiền",
      value: (row) => row.totalAmount,
      sortable: true,
      searchable: false,
      cell: (row) => <span className="whitespace-nowrap font-semibold tabular-nums text-foreground">{vnd.format(row.totalAmount)}</span>,
    },
    {
      id: "status",
      header: "Trạng thái",
      value: (row) => statuses.indexOf(row.status),
      sortable: true,
      searchable: false,
      cell: (row) => <StatusBadge kind="order" status={row.status} className="whitespace-nowrap" />,
    },
    {
      id: "actions",
      header: "Thao tác",
      value: () => null,
      searchable: false,
      cell: (row) => <OrderActionLink portal={portal} row={row} />,
    },
  ];
}

const filters: DataFilter<OrderRow>[] = [
  {
    id: "status",
    label: "Trạng thái",
    options: statuses.map((value) => ({ value, label: statusMap.order[value][0] })),
    matches: (row, value) => row.status === value,
  },
  {
    id: "channel",
    label: "Kênh bán",
    options: channels.map((value) => ({ value, label: orderChannelLabels[value] })),
    matches: (row, value) => row.channel === value,
  },
  {
    id: "total",
    label: "Giá trị đơn",
    options: [
      { value: "under-300k", label: "Dưới 300.000 ₫" },
      { value: "300k-700k", label: "300.000 ₫ – 700.000 ₫" },
      { value: "over-700k", label: "Trên 700.000 ₫" },
    ],
    matches: (row, value) => {
      if (value === "under-300k") return row.totalAmount < 300_000;
      if (value === "300k-700k") return row.totalAmount >= 300_000 && row.totalAmount <= 700_000;
      if (value === "over-700k") return row.totalAmount > 700_000;
      return true;
    },
  },
  {
    id: "items",
    label: "Số sản phẩm",
    options: [
      { value: "single", label: "1 sản phẩm" },
      { value: "multi", label: "Từ 2 sản phẩm" },
    ],
    matches: (row, value) => (value === "single" ? row.itemCount === 1 : value === "multi" ? row.itemCount >= 2 : true),
  },
];

/** Shortcut over the status filter: writes the same URL param as DataTable so both stay in sync. */
function OrderStatusTabs({ rows }: { rows: readonly OrderRow[] }) {
  const params = useSearchParams();
  const active = params.get(`${PREFIX}filter.status`) ?? "";
  const select = (status: string) => {
    const search = updateTableParams(window.location.search, PREFIX, { "filter.status": status, page: "1" });
    window.history.pushState(null, "", `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`);
  };
  const tabs = [
    { value: "", label: "Tất cả", count: rows.length },
    ...statuses.map((value) => ({
      value,
      label: statusMap.order[value][0],
      count: rows.filter((row) => row.status === value).length,
    })),
  ];

  return (
    <nav aria-label="Lọc nhanh theo trạng thái đơn hàng" className="mb-4 flex overflow-x-auto border-b border-border">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          aria-pressed={active === tab.value}
          onClick={() => select(tab.value)}
          className={cn(
            "flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-3 font-label text-sm uppercase tracking-wider whitespace-nowrap focus-visible:outline-2 focus-visible:outline-ring",
            active === tab.value
              ? "border-gold-strong font-bold text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
          <span className="rounded-sm bg-muted px-1.5 text-xs tabular-nums">{tab.count}</span>
        </button>
      ))}
    </nav>
  );
}

function downloadOrdersCsv(rows: readonly OrderRow[]) {
  const url = URL.createObjectURL(new Blob([ordersToCsv(rows)], { type: "text/csv;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), {
    href: url,
    download: `don-hang-${new Date().toISOString().slice(0, 10)}.csv`,
  });
  link.click();
  URL.revokeObjectURL(url);
}

export function OrdersList({ portal }: { portal: "staff" | "manager" }) {
  const s = screen(portal === "staff" ? "S4" : "M16");
  const { data, loading, error, retry } = useApiData(
    loadAllBackofficeOrders,
    "Chưa tải được danh sách đơn hàng. Kiểm tra kết nối rồi thử lại."
  );
  const orders = data ?? [];
  const ready = data !== null;
  const countStatus = (...target: OrderStatus[]) => orders.filter((row) => target.includes(row.status)).length;
  const websiteCount = orders.filter((row) => row.channel === "Website").length;
  const placedCount = countStatus("Placed");
  const deliveringCount = countStatus("Delivering");
  const completedCount = countStatus("Completed");
  const cancelledCount = countStatus("Cancelled");
  const columns = buildColumns(portal);

  return (
    <>
      <PageHeader
        eyebrow={s.code}
        title="Danh sách đơn hàng"
        description={
          portal === "staff"
            ? "Hàng đợi đơn đặt từ Website và lịch sử đơn toàn hệ thống; xác nhận và giao các đơn đang chờ."
            : "Theo dõi toàn bộ đơn hàng đa kênh, lọc theo trạng thái giao nhận và điều phối các đơn đặt từ Website."
        }
        actions={
          <Button
            type="button"
            variant="outline"
            className="h-12 px-4"
            disabled={loading || orders.length === 0}
            onClick={() => downloadOrdersCsv(orders)}
          >
            <Download aria-hidden="true" />
            Xuất file CSV
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatTile
          label="Tổng đơn hàng"
          value={ready ? orders.length : "—"}
          icon={<ShoppingBag />}
          hint={ready ? `${websiteCount} đơn Website · ${orders.length - websiteCount} đơn quầy/sàn` : undefined}
        />
        <StatTile
          label="Chờ xác nhận"
          value={ready ? placedCount : "—"}
          icon={<Hourglass />}
          hint={ready ? (placedCount > 0 ? "Đơn Website mới cần xác nhận giao" : "Không có đơn chờ xác nhận") : undefined}
        />
        <StatTile
          label="Đang giao"
          value={ready ? deliveringCount : "—"}
          icon={<Truck />}
          hint="Đang vận chuyển đến khách hàng"
        />
        <StatTile
          label="Hoàn thành"
          value={ready ? completedCount : "—"}
          icon={<CircleCheck />}
          progress={ready && orders.length ? completedCount / orders.length : undefined}
          hint={ready ? `${cancelledCount} đơn đã hủy` : undefined}
        />
      </div>

      <Suspense fallback={null}>
        <OrderStatusTabs rows={orders} />
      </Suspense>

      <DataTable
        data={orders}
        columns={columns}
        getRowId={(row) => row.id}
        rowHref={(row) => `/${portal}/orders/${row.id}`}
        caption="Đơn hàng"
        filters={filters}
        loading={loading}
        error={error}
        onRetry={retry}
        paramPrefix={PREFIX}
        cardsUntil="wide"
        renderCard={(row) => (
          <article className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
            <header className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-gold-strong">#{row.code}</span>
                  <ChannelChip channel={row.channel} />
                </span>
                <span className="mt-1 block font-semibold text-foreground">{row.customerName}</span>
                <span className="block font-mono text-xs text-muted-foreground">{customerCode(row.customerId)}</span>
              </span>
              <StatusBadge kind="order" status={row.status} className="shrink-0 whitespace-nowrap" />
            </header>
            <div className="grid grid-cols-2 gap-2 rounded-md border border-border/70 bg-muted/40 px-3 py-2 text-xs">
              <div>
                <span className="block text-muted-foreground">Số lượng</span>
                <span className="font-semibold text-foreground tabular-nums">{row.itemCount} sản phẩm</span>
              </div>
              <div className="text-right">
                <span className="block text-muted-foreground">Tổng tiền</span>
                <span className="font-semibold text-foreground tabular-nums">{vnd.format(row.totalAmount)}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Đặt lúc <time dateTime={row.orderedAt}>{dateTime.format(new Date(row.orderedAt))}</time>
            </p>
            <div className="mt-auto flex justify-end">
              <OrderActionLink portal={portal} row={row} />
            </div>
          </article>
        )}
        emptyTitle="Không có đơn hàng phù hợp"
        emptyDescription="Thử thay đổi từ khóa tìm kiếm hoặc bỏ bớt bộ lọc trạng thái, kênh bán."
      />
    </>
  );
}
