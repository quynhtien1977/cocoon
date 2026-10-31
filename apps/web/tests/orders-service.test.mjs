import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { filterOrders, loadOrders, parseOrders } from "../features/customer/orders-service.ts";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const item = { id: 1, name: "Nước dưỡng tóc bưởi", variant: "140ml", imageUrl: null, quantity: 1, unitPrice: 162000, review: null };
const order = { id: 1, code: "ORDER-1", orderedAt: "2026-10-20T00:00:00Z", status: "Completed", totalAmount: 324000, items: [item, { ...item, id: 2, review: { id: 5, rating: 4 } }] };

test("review filters keep only matching items in partially reviewed completed orders", () => {
  const orders = [order, { ...order, id: 2, status: "Cancelled" }];
  assert.equal(filterOrders(orders, "all").length, 2);
  assert.equal(filterOrders(orders, "delivered").length, 1);
  const pending = filterOrders(orders, "unreviewed");
  assert.deepEqual(pending[0].items.map(item => item.id), [1]);
  assert.equal(pending[0].originalItemCount, 2);
  assert.equal(pending[0].totalAmount, 324000);
  assert.deepEqual(filterOrders(orders, "reviewed")[0].items.map(item => item.id), [2]);
  assert.equal(filterOrders(orders, "all", "buoi").length, 2);
  assert.equal(filterOrders(orders, "all", "order-1").length, 2);
  assert.equal(filterOrders(orders, "all", "unknown").length, 0);
});

test("response adapter rejects missing review state and incomplete pagination", () => {
  assert.deepEqual(parseOrders([order]).items, [order]);
  assert.equal(parseOrders([{ ...order, status: 0 }]).items[0].status, "Completed");
  assert.throws(() => parseOrders({ items: [order] }));
  assert.throws(() => parseOrders([{ ...order, items: [{ ...item, review: undefined }] }]));
  assert.throws(() => parseOrders([{ ...order, totalAmount: -1 }]));
  assert.throws(() => parseOrders([{ ...order, status: "Shipping" }]));
});

test("loading fetches all pages before local filters, uses only read requests", async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push(url);
    assert.equal(options.method, "GET");
    return Response.json({ items: [{ ...order, id: calls.length }], totalCount: 2 });
  };
  assert.equal((await loadOrders(new AbortController().signal)).length, 2);
  assert.deepEqual(calls, ["/api/v1/me/orders?page=1&pageSize=20", "/api/v1/me/orders?page=2&pageSize=20"]);
});

test("stub and repeated pages never become an empty or fabricated history", async () => {
  globalThis.fetch = async () => Response.json({}, { status: 501 });
  await assert.rejects(loadOrders(new AbortController().signal), error => error.status === 501);
  globalThis.fetch = async () => Response.json({ items: [order], totalCount: 2 });
  await assert.rejects(loadOrders(new AbortController().signal));
});
