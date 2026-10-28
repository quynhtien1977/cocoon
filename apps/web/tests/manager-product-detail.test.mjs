import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { loadManagerProduct, saveProductPreferences, loadProductInsights } from "../features/manager/product-detail-service.ts";
import { resolveProductImage } from "../features/manager/product-media.ts";
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const detail = { id: 1, name: "Gel rửa mặt bí đao", categoryId: 1, categoryName: "Làm sạch", status: "Active", preferences: ["Da dầu"], preferenceIds: [42], variants: [{ id: 2, name: "310ml", sku: "BD310", price: 299000, imageUrl: "/images/product.jpg" }], ingredients: "Bí đao", benefits: "Làm sạch", usage: "Rửa sạch với nước." };

test("detail reads existing API and preserves variant prices and actual preference IDs", async () => {
  globalThis.fetch = async url => { assert.equal(url, "/api/v1/products/1"); return Response.json(detail); };
  const product = await loadManagerProduct("1");
  assert.equal(product.variants[0].price, 299000);
  assert.deepEqual(product.preferenceIds, [42]);
  assert.equal(product.imageUrl, "/images/product.jpg");
  globalThis.fetch = async () => Response.json({ ...detail, id: 2 });
  await assert.rejects(loadManagerProduct("1"));
});

test("preview details never request or mutate real products; unavailable API stays an error", async () => {
  globalThis.fetch = async () => { throw Error("Unexpected request"); };
  assert.equal((await loadManagerProduct("1", true)).name, "Gel rửa mặt bí đao");
  await assert.rejects(loadManagerProduct("999", true));
  await assert.rejects(loadManagerProduct("../1"));
  globalThis.fetch = async () => Response.json({}, { status: 501 });
  await assert.rejects(loadManagerProduct("1"), error => error.status === 501);
  await assert.rejects(loadProductInsights(1), error => error.status === 501);
});

test("preference save sends IDs only to existing PUT endpoint and propagates failure", async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/v1/products/1/preferences");
    assert.equal(options.method, "PUT");
    assert.deepEqual(JSON.parse(options.body), { preferenceIds: [42] });
    return new Response(null, { status: 204 });
  };
  await saveProductPreferences(1, [42]);
  await assert.rejects(saveProductPreferences(1, [-1]));
  globalThis.fetch = async () => Response.json({}, { status: 501 });
  await assert.rejects(saveProductPreferences(1, [42]), error => error.status === 501);
});

test("photo mapping uses verified names, prioritizes supplied images, never guesses product IDs", () => {
  assert.equal(resolveProductImage("Gel rửa mặt bí đao", null), "/images/manager-products/winter-melon.jpg");
  assert.equal(resolveProductImage("Unknown", "/images/actual.jpg"), "/images/actual.jpg");
  assert.equal(resolveProductImage("Unknown", "javascript:alert(1)"), null);
  assert.equal(resolveProductImage("Unknown", null), null);
});
