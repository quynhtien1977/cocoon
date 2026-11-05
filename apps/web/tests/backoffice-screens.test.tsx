import "./dom-setup.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import type { ReactNode } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { CustomerList } from "../features/customers/components/customer-list";
import type { CustomerListItem } from "../features/customers/types";
import { customersToCsv } from "../features/customers/customers-csv";
import { FeedbackInbox } from "../features/feedback/components/feedback-inbox";

beforeEach(() => window.history.replaceState(null, "", "/"));
afterEach(cleanup);

const customer = (id: number, fullName: string, gender: string | null): CustomerListItem => ({ id, code: `KH-${String(id).padStart(4, "0")}`, fullName, email: `kh${id}@example.com`, phone: null, age: 30, gender, preferences: ["Da dầu mụn"], orderCount: 1, lastOrderAt: "2026-10-20T03:00:00Z", joinedAt: "2025-01-10T02:00:00Z", status: "Active" });
const customers = [customer(5, "Trúc Nguyễn", "Nữ"), customer(6, "Lê Minh Quân", "Nam"), customer(7, "Hồ Gia Bảo", "Nam")];
/** Serves M2's GET customers; restore with the returned function. */
function serveCustomers() {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ items: customers, totalCount: customers.length, page: 1, pageSize: 100 }), { headers: { "content-type": "application/json" } })) as typeof fetch;
  return () => { globalThis.fetch = realFetch; };
}

// DataTable reads filters from the URL; tests seed it directly instead of driving the router.
const withParams = (search: string, node: ReactNode) => <SearchParamsContext.Provider value={new URLSearchParams(search)}>{node}</SearchParamsContext.Provider>;

test("M2 renders a mobile card per row with a link name distinct from the table", async () => {
  const restore = serveCustomers();
  try {
    render(withParams("size=10", <CustomerList />));
    const first = customers[0];
    assert.equal((await screen.findByRole("link", { name: `Hồ sơ ${first.fullName}, ${first.code}` })).getAttribute("href"), `/manager/customers/${first.id}`);
    assert.ok(screen.getByLabelText("Sắp xếp"));
    assert.ok(screen.getByRole("button", { name: "Xuất file CSV" }));
  } finally {
    restore();
  }
});

test("customer CSV keeps diacritics and neutralises formula cells", () => {
  const csv = customersToCsv([{ ...customers[0], fullName: "=HYPERLINK(\"x\")", preferences: ["Da dầu mụn", "Dưỡng ẩm"] }]);
  assert.ok(csv.startsWith("﻿\"Mã KH\""));
  const [, row] = csv.slice(1).split("\r\n");
  assert.ok(row.includes(`"'=HYPERLINK(""x"")"`));
  assert.ok(row.includes('"Da dầu mụn; Dưỡng ẩm"'));
});

test("M2 lists customers from GET customers with links to M4 and filters by gender from the URL", async () => {
  const restore = serveCustomers();
  try {
    render(withParams("filter.gender=Nam&size=50", <CustomerList />));
    const link = await screen.findByRole("link", { name: "Xem hồ sơ Lê Minh Quân" });
    const table = screen.getByRole("table", { name: /Khách hàng/ });
    assert.equal(within(table).getAllByRole("row").length - 1, 2);
    assert.equal(link.getAttribute("href"), "/manager/customers/6");
    assert.equal(screen.getByRole("link", { name: "Thêm khách hàng" }).getAttribute("href"), "/manager/customers/new");
  } finally {
    restore();
  }
});

test("M5 filters low ratings and links each row to M6", async () => {
  const feedback = (id: number, rating: number) => ({ id, customerName: `Khách ${id}`, customerCode: `KH-${id}`, orderCode: null, productName: "Gel bí đao", categoryName: "Làm sạch", rating, content: "Nội dung", status: "New", assigneeId: null, assigneeName: null, verifiedPurchase: false, createdAt: "2026-10-20T03:00:00Z" });
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ items: [feedback(41, 2), feedback(40, 5)], totalCount: 2, page: 1, pageSize: 100 }), { headers: { "content-type": "application/json" } })) as typeof fetch;
  try {
    render(withParams("feedback.filter.rating=low&feedback.size=50", <FeedbackInbox />));
    const table = await screen.findByRole("table", { name: /Phản hồi/ });
    assert.equal(within(table).getAllByRole("row").length - 1, 1);
    assert.equal(screen.getByRole("link", { name: "Xử lý phản hồi #41" }).getAttribute("href"), "/manager/feedback/41");
  } finally {
    globalThis.fetch = realFetch;
  }
});
