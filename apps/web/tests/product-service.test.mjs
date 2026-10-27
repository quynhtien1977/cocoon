import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { loadProduct, productId } from "../features/customer/product-service.ts";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test("product API accepts only real numeric IDs, never reference slugs", async () => {
  assert.equal(productId("12"), 12);
  for (const value of ["0", "-1", "1.5", "2147483648", "product-slug", "1/other", "1e2"]) assert.equal(productId(value), null);
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({}); };
  await assert.rejects(loadProduct("reference-slug"));
  assert.equal(calls, 0);
});

test("product details load from the existing endpoint and validate the requested ID", async () => {
  const payload = { id: 12, name: "Gel bí đao", description: "Làm sạch", ingredients: "Bí đao", benefits: "Dịu nhẹ", usage: "Dùng mỗi ngày", categoryName: "Làm sạch", variants: [{ name: "100 ml", price: 120000, imageUrl: "/images/product.png" }] };
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/v1/products/12");
    assert.equal(options.method, "GET");
    assert.equal(options.credentials, "include");
    return Response.json(payload);
  };
  const item = await loadProduct("12");
  assert.equal(item.name, "Gel bí đao");
  assert.equal(item.variants[0].price, 120000);
  assert.equal(item.description, "Làm sạch");
  globalThis.fetch = async () => Response.json({ ...payload, id: 13 });
  await assert.rejects(loadProduct("12"));
});

test("API errors never silently replace a real product with reference data", async () => {
  for (const status of [404, 500, 501]) {
    globalThis.fetch = async () => Response.json({}, { status });
    await assert.rejects(loadProduct("12"), error => error.status === status);
  }
  globalThis.fetch = async () => Response.json({ id: 12 });
  await assert.rejects(loadProduct("12"));
});
