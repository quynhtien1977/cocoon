import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { loadManagerProducts, parseManagerProducts, productsCsv, changeProductStatus } from "../features/manager/products-service.ts";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const product = { id: 1, name: "Gel bí đao", sku: "BD-01", categoryId: 1, categoryName: "Chăm sóc da", status: "Active", preferences: ["Da dầu"], averageRating: 4.8, feedbackCount: 12 };

test("manager can PATCH each existing product status; invalid values never reach the API", async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push(JSON.parse(options.body).status);
    assert.equal(url, "/api/v1/products/1/status");
    assert.equal(options.method, "PATCH");
    assert.equal(options.credentials, "include");
    return new Response(null, { status: 204 });
  };
  for (const status of ["Active", "Upcoming", "Inactive"]) await changeProductStatus(1, status);
  await assert.rejects(changeProductStatus(0, "Active"));
  await assert.rejects(changeProductStatus(1, "Draft"));
  assert.deepEqual(calls, ["Active", "Upcoming", "Inactive"]);
  globalThis.fetch = async () => Response.json({}, { status: 501 });
  await assert.rejects(changeProductStatus(1, "Inactive"), error => error.status === 501);
});

test("manager product list loads every API page before client filtering", async () => {
  const urls = [];
  globalThis.fetch = async (url, options) => {
    urls.push(url);
    assert.equal(options.method, "GET");
    return Response.json({ items: [{ ...product, id: urls.length }], totalCount: 2 });
  };
  assert.equal((await loadManagerProducts()).length, 2);
  assert.deepEqual(urls, ["/api/v1/products?page=1&pageSize=50", "/api/v1/products?page=2&pageSize=50"]);
});

test("unknown status, missing tags, malformed metrics and duplicate pages fail honestly", async () => {
  for (const change of [{ status: "Broken" }, { preferences: undefined }, { averageRating: 6 }, { feedbackCount: -1 }])
    assert.throws(() => parseManagerProducts([{ ...product, ...change }]));
  assert.equal(parseManagerProducts([{ ...product, status: 2 }]).items[0].status, "Upcoming");
  globalThis.fetch = async () => Response.json({ items: [product], totalCount: 2 });
  await assert.rejects(loadManagerProducts(), /trùng/);
  globalThis.fetch = async () => Response.json({}, { status: 501 });
  await assert.rejects(loadManagerProducts(), error => error.status === 501);
});

test("CSV keeps Vietnamese, escapes quotes and neutralizes spreadsheet formulas", () => {
  const row = parseManagerProducts([{ ...product, name: '=HYPERLINK("evil")' }]).items[0];
  const csv = productsCsv([row]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"\'=HYPERLINK(""evil"")"'));
  assert.ok(csv.includes('"Da dầu"'));
});
