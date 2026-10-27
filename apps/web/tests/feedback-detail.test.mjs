import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { loadFeedbackDetail, parseFeedbackDetail } from "../features/customer/feedback-detail-service.ts";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const detail = { id: 12, rating: 5, content: "Dịu nhẹ", status: "Replied", createdAt: "2026-10-20T09:00:00Z", orderCode: "ORDER-1", product: { name: "Gel bí đao", variant: "100ml", imageUrl: null }, replies: [{ id: 2, staffName: "Lan", content: "Cảm ơn bạn", createdAt: "2026-10-22T09:00:00Z" }, { id: 1, staffName: "An", content: "Đã tiếp nhận", createdAt: "2026-10-21T09:00:00Z" }] };

test("feedback detail reads only the customer endpoint and orders staff replies by time", async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/v1/me/feedback/12");
    assert.equal(options.method, "GET");
    return Response.json(detail);
  };
  const result = await loadFeedbackDetail("12");
  assert.equal(result.content, "Dịu nhẹ");
  assert.deepEqual(result.replies.map(reply => reply.id), [1, 2]);
  assert.equal(parseFeedbackDetail({ ...detail, status: 3 }, 12).status, "Replied");
});

test("missing replies, wrong IDs and malformed details never masquerade as an unanswered review", () => {
  for (const invalid of [{ ...detail, id: 13 }, { ...detail, replies: undefined }, { ...detail, rating: 6 }, { ...detail, status: "Unknown" }, { ...detail, replies: [{ ...detail.replies[0], createdAt: "bad-date" }] }]) assert.throws(() => parseFeedbackDetail(invalid, 12));
  assert.deepEqual(parseFeedbackDetail({ ...detail, status: "New", replies: [] }, 12).replies, []);
});

test("invalid IDs and demo feedback never call the API; real errors never fall back to demo data", async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({}, { status: 501 }); };
  await assert.rejects(loadFeedbackDetail("bad-id"));
  assert.equal(calls, 0);
  const demo = await loadFeedbackDetail("2", true);
  assert.equal(demo.product.name, "Nước tẩy trang bí đao");
  assert.equal(demo.rating, 5);
  assert.ok(demo.replies.length);
  assert.equal(calls, 0);
  await assert.rejects(loadFeedbackDetail("999", true));
  assert.equal(calls, 0);
  await assert.rejects(loadFeedbackDetail("2"), error => error.status === 501);
  assert.equal(calls, 1);
});
