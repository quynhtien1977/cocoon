import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { parseOrderItemId, parseReviewableItems, submitReview, validateReview, reviewErrorMessage } from "../features/customer/review-service.ts";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const item = { orderItemId: 91, name: "Nước dưỡng tóc", variant: "140ml", imageUrl: null, orderCode: "ORDER-81" };

test("review validates integer 1–5 stars, nonblank comment and 1000-character limit", () => {
  for (const rating of [null, 0, 6, 1.5, NaN]) assert.ok(validateReview({ rating, content: "Tốt" }).rating);
  assert.ok(validateReview({ rating: 5, content: "  \n " }).content);
  assert.equal(validateReview({ rating: 5, content: "a".repeat(19) }).content, "Nhận xét cần ít nhất 20 ký tự.");
  assert.equal(validateReview({ rating: 5, content: ` ${"a".repeat(19)} ` }).content, "Nhận xét cần ít nhất 20 ký tự.", "spaces do not count, as on the API");
  assert.equal(validateReview({ rating: 5, content: "a".repeat(20) }).content, "");
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
  await submitReview(91, { rating: 4, content: "  Cảm nhận của tôi sau một tuần  " });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, "/api/v1/me/reviewable-items");
  assert.equal(calls[1].url, "/api/v1/me/feedback");
  assert.equal(calls[1].options.method, "POST");
  assert.deepEqual(JSON.parse(calls[1].options.body), { orderItemId: 91, rating: 4, content: "Cảm nhận của tôi sau một tuần" });
});

test("each photo uploads in its own multipart request to the created feedback; a failure keeps the review sent", async () => {
  const calls = [];
  let failName = "";
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("reviewable-items")) return Response.json([item]);
    if (url === "/api/v1/me/feedback") return Response.json({ id: 7 }, { status: 201 });
    const name = options.body.get("photos").name;
    return Response.json([], { status: name === failName ? 400 : 201 });
  };
  const photos = [new File([new Uint8Array([0xff, 0xd8, 0xff])], "a.jpg", { type: "image/jpeg" }), new File([new Uint8Array([0x89, 0x50])], "b.png", { type: "image/png" })];
  assert.deepEqual(await submitReview(91, { rating: 4, content: "Cảm nhận của tôi sau một tuần" }, photos), { photosFailed: false });
  const uploads = calls.slice(2);
  assert.deepEqual(uploads.map((call) => [call.url, call.options.method]), [["/api/v1/me/feedback/7/photos", "POST"], ["/api/v1/me/feedback/7/photos", "POST"]]);
  assert.deepEqual(uploads.map((call) => call.options.body.getAll("photos").map((file) => file.name)), [["a.jpg"], ["b.png"]]);
  assert.equal(new Headers(uploads[0].options.headers).get("Content-Type"), null, "the browser must set the multipart boundary");

  calls.length = 0; failName = "a.jpg";
  assert.deepEqual(await submitReview(91, { rating: 4, content: "Cảm nhận của tôi sau một tuần" }, photos), { photosFailed: true });
  assert.equal(calls.length, 4, "a failed photo does not stop the others");
});

test("ineligible or already reviewed items never post; stub errors remain failures", async () => {
  const calls = [];
  globalThis.fetch = async (url) => { calls.push(url); return Response.json([]); };
  await assert.rejects(submitReview(91, { rating: 5, content: "Tốt, da mềm hơn sau một tuần" }));
  assert.deepEqual(calls, ["/api/v1/me/reviewable-items"]);
  globalThis.fetch = async (url) => url.endsWith('reviewable-items') ? Response.json([item]) : Response.json({}, { status: 501 });
  await assert.rejects(submitReview(91, { rating: 5, content: "Tốt, da mềm hơn sau một tuần" }), error => /chưa khả dụng/.test(reviewErrorMessage(error)));
});
