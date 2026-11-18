import "./dom-setup.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { OrdersList } from "../features/orders/orders-list";
import { OrderDetailView } from "../features/orders/order-detail-view";
import {
  confirmOrder,
  loadAllBackofficeOrders,
  loadBackofficeOrders,
  ordersToCsv,
  type OrderRow,
} from "../features/orders/orders-service";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});

const withParams = (search: string, node: ReactNode) => (
  <SearchParamsContext.Provider value={new URLSearchParams(search)}>{node}</SearchParamsContext.Provider>
);

const sampleOrders: OrderRow[] = [
  {
    id: 101,
    code: "CO-W-000101",
    customerId: 5,
    customerName: "Nguyễn Văn A",
    channel: "Website",
    status: "Placed",
    orderedAt: "2026-11-13T10:00:00Z",
    itemCount: 2,
    totalAmount: 320000,
  },
  {
    id: 102,
    code: "CO-S-000102",
    customerId: 6,
    customerName: "Trần Thị B",
    channel: "Store",
    status: "Completed",
    orderedAt: "2026-11-12T08:00:00Z",
    itemCount: 1,
    totalAmount: 185000,
  },
  {
    id: 103,
    code: "CO-M-000103",
    customerId: 7,
    customerName: "Lê Hoàng C",
    channel: "Marketplace",
    status: "Delivering",
    orderedAt: "2026-11-11T15:30:00Z",
    itemCount: 3,
    totalAmount: 790000,
  },
];

const sampleDetail = {
  id: 101,
  code: "CO-W-000101",
  channel: "Website" as const,
  status: "Placed" as const,
  orderedAt: "2026-11-13T10:00:00Z",
  totalAmount: 320000,
  shippingAddress: "140 Hai Bà Trưng, Quận 1, TP. HCM",
  confirmedAt: null,
  confirmedByName: null,
  completedAt: null,
  cancelledAt: null,
  customer: {
    id: 5,
    fullName: "Nguyễn Văn A",
    email: "customer-a@example.com",
    phone: "0901234567",
  },
  lines: [
    {
      id: 1,
      productId: 12,
      productName: "Nước dưỡng tóc bưởi",
      variantName: "140ml",
      sku: "NDTB-140",
      imageUrl: null,
      quantity: 2,
      unitPrice: 160000,
    },
  ],
};

test("loadBackofficeOrders formats query parameters and calls GET /orders", async () => {
  let calledUrl = "";
  globalThis.fetch = (async (url) => {
    calledUrl = String(url);
    return Response.json({ items: [sampleOrders[0]], totalCount: 1, page: 1, pageSize: 20 });
  }) as typeof fetch;

  const res = await loadBackofficeOrders({ page: 2, pageSize: 10, search: "CO-W", status: "Placed" });
  assert.equal(res.items.length, 1);
  assert.equal(res.items[0].code, "CO-W-000101");
  assert.equal(calledUrl, "/api/v1/orders?page=2&pageSize=10&search=CO-W&status=Placed");
});

test("loadAllBackofficeOrders loads paged results for DataTable", async () => {
  let pageCalls = 0;
  globalThis.fetch = (async (url) => {
    pageCalls++;
    if (String(url).includes("page=1")) {
      return Response.json({ items: [sampleOrders[0], sampleOrders[1]], totalCount: 3, page: 1, pageSize: 100 });
    }
    return Response.json({ items: [sampleOrders[2]], totalCount: 3, page: 2, pageSize: 100 });
  }) as typeof fetch;

  const rows = await loadAllBackofficeOrders();
  assert.equal(pageCalls, 2);
  assert.equal(rows.length, 3);
  assert.equal(rows[2].channel, "Marketplace");
});

test("ordersToCsv preserves Vietnamese headers and neutralizes formula cells", () => {
  const csv = ordersToCsv([
    {
      ...sampleOrders[0],
      customerName: '=CMD("calc")',
    },
  ]);
  assert.ok(csv.startsWith('\uFEFF"Mã đơn"'));
  const [, row] = csv.slice(1).split("\r\n");
  assert.ok(row.includes(`"'=CMD(""calc"")"`));
  assert.ok(row.includes('"KH-0005"'));
  assert.ok(row.includes('"Website"'));
  assert.ok(row.includes('"Chờ xác nhận"'));
});

test("confirmOrder sends POST /orders/{id}/confirm", async () => {
  let calledUrl = "";
  let calledMethod = "";
  globalThis.fetch = (async (url, options) => {
    calledUrl = String(url);
    calledMethod = options?.method ?? "GET";
    return new Response(null, { status: 204 });
  }) as typeof fetch;

  await confirmOrder(101);
  assert.equal(calledUrl, "/api/v1/orders/101/confirm");
  assert.equal(calledMethod, "POST");
});

test("OrdersList renders StatTiles, StatusTabs, CSV button, DataTable and filters by status and channel", async () => {
  globalThis.fetch = (async () =>
    Response.json({ items: sampleOrders, totalCount: sampleOrders.length, page: 1, pageSize: 100 })) as typeof fetch;

  render(withParams("orders.filter.status=Placed&orders.size=50", <OrdersList portal="manager" />));

  const table = await screen.findByRole("table", { name: /Đơn hàng/ });
  assert.equal(within(table).getAllByRole("row").length - 1, 1);
  assert.ok(screen.getByRole("button", { name: /Xuất file CSV/ }));
  assert.ok(screen.getByRole("navigation", { name: "Lọc nhanh theo trạng thái đơn hàng" }));
  assert.ok(screen.getByText("Tổng đơn hàng"));
  assert.ok(screen.getAllByText("Chờ xác nhận").length >= 1);

  const actionLink = within(table).getByRole("link", { name: "Xử lý đơn #CO-W-000101" });
  assert.equal(actionLink.getAttribute("href"), "/manager/orders/101");
  assert.equal(screen.getAllByRole("link", { name: "Xử lý đơn #CO-W-000101" }).length, 2);
});

test("OrdersList supports multi-channel filter via URL params", async () => {
  globalThis.fetch = (async () =>
    Response.json({ items: sampleOrders, totalCount: sampleOrders.length, page: 1, pageSize: 100 })) as typeof fetch;

  render(withParams("orders.filter.channel=Marketplace&orders.size=50", <OrdersList portal="staff" />));

  const table = await screen.findByRole("table", { name: /Đơn hàng/ });
  assert.equal(within(table).getAllByRole("row").length - 1, 1);
  assert.ok(within(table).getByText("Lê Hoàng C"));
  const detailLink = within(table).getByRole("link", { name: "Xem đơn #CO-M-000103" });
  assert.equal(detailLink.getAttribute("href"), "/staff/orders/103");
});

test("OrderDetailView displays timeline, customer card link for manager, and confirms placed order", async () => {
  let confirmed = false;

  globalThis.fetch = (async (url, options) => {
    if (options?.method === "POST" && String(url) === "/api/v1/orders/101/confirm") {
      confirmed = true;
      return new Response(null, { status: 204 });
    }
    return Response.json(
      confirmed
        ? {
            ...sampleDetail,
            status: "Delivering",
            confirmedAt: "2026-11-13T10:30:00Z",
            confirmedByName: "Manager Demo",
          }
        : sampleDetail
    );
  }) as typeof fetch;

  render(<OrderDetailView id={101} portal="manager" />);

  await screen.findByText("Đơn hàng #CO-W-000101");
  assert.ok(screen.getByText("Tiến trình đơn hàng (3 bước)"));
  assert.ok(screen.getByText("140 Hai Bà Trưng, Quận 1, TP. HCM"));
  assert.equal(screen.getAllByText("Nước dưỡng tóc bưởi").length, 2);
  assert.equal(screen.getByRole("link", { name: /Mở hồ sơ khách hàng/ }).getAttribute("href"), "/manager/customers/5");

  const confirmBtn = screen.getByRole("button", { name: /Xác nhận và giao/ });
  fireEvent.click(confirmBtn);

  const dialogConfirmAction = await screen.findByRole("button", { name: "Xác nhận và giao" });
  fireEvent.click(dialogConfirmAction);

  await waitFor(() => {
    assert.equal(confirmed, true);
  });
  await screen.findByText(/Đã xác nhận và chuyển đơn #CO-W-000101 sang trạng thái Đang giao/);
});
