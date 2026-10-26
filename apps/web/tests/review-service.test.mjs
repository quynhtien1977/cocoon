import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { parseOrderItemId, parseReviewableItems, submitReview, validateReview, reviewErrorMessage } from "../features/customer/review-service.ts";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const item = { orderItemId: 91, name: "Nước dưỡng tóc", variant: "140ml", imageUrl: null, orderCode: "ORDER-81" };

test("review validates integer 1–5 stars, nonblank comment and 1000-character limit", () => {
  for (const rating of [null, 0, 6, 1.5, NaN]) assert.ok(validateReview({ rating, content: "Tốt" }).rating);
  assert.ok(validateReview({ rating: 5, content: "  \n " }).content);
  assert.ok(validateReview({ rating: 5, content: "a".repeat(1001) }).content);
  assert.deepEqual(validateReview({ rating: 5, content: "a".repeat(1000) }), { rating: "", content: "" });
  for (const id of [undefined, "0", "-1", "1.5", "01", "foo", "2147483648"]) assert.equal(parseOrderItemId(id), null);
  assert.equal(parseOrderItemId("91"), 91);
});

test("eligibility adapter rejects missing metadata and duplicate order items", () => {
  assert.deepEqual(parseReviewableItems({ items: [item] }), [item]);
  assert.throws(() => parseReviewableItems([item, item]));
  assert.throws(() => parseReviewableItems([{ orderItemId: 91 }]));
  assert.throws(() => parseReviewableItems({}));
});

test("submission rechecks eligibility and posts only the backend feedback contract", async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return url.endsWith('reviewable-items') ? Response.json([item]) : new Response(null, { status: 204 });
  };
  await submitReview(91, { rating: 4, content: "  Cảm nhận của tôi  " });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, "/api/v1/me/reviewable-items");
  assert.equal(calls[1].url, "/api/v1/me/feedback");
  assert.equal(calls[1].options.method, "POST");
  assert.deepEqual(JSON.parse(calls[1].options.body), { orderItemId: 91, rating: 4, content: "Cảm nhận của tôi" });
});

test("ineligible or already reviewed items never post; stub errors remain failures", async () => {
  const calls = [];
  globalThis.fetch = async (url) => { calls.push(url); return Response.json([]); };
  await assert.rejects(submitReview(91, { rating: 5, content: "Tốt" }));
  assert.deepEqual(calls, ["/api/v1/me/reviewable-items"]);
  globalThis.fetch = async (url) => url.endsWith('reviewable-items') ? Response.json([item]) : Response.json({}, { status: 501 });
  await assert.rejects(submitReview(91, { rating: 5, content: "Tốt" }), error => /chưa khả dụng/.test(reviewErrorMessage(error)));
});
