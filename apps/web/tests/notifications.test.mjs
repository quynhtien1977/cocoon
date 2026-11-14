import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { loadNotifications, markNotificationRead, notificationHref, newFeedbackNotifications } from "../features/customer/notification-service.ts";
const fetchOriginal = globalThis.fetch;
afterEach(() => { globalThis.fetch = fetchOriginal; });
const row = { id: 9, type: "FeedbackReplied", title: "Cocoon đã trả lời bạn", refType: "Feedback", refId: 12, isRead: false, createdAt: "2026-10-27T10:00:00Z" };

test("background notifications refresh an expired session without redirecting on failure", async () => {
  const calls = [];
  globalThis.fetch = async url => {
    calls.push(url);
    if (url === "/api/v1/auth/refresh") return new Response(null, { status: 204 });
    return calls.length === 1 ? Response.json({}, { status: 401 }) : Response.json([row]);
  };
  assert.deepEqual(await loadNotifications(), [row]);
  assert.deepEqual(calls, ["/api/v1/me/notifications", "/api/v1/auth/refresh", "/api/v1/me/notifications"]);
  const originalWindow = globalThis.window;
  let redirected = false;
  globalThis.window = { location: { origin: "http://localhost:3000", assign() { redirected = true; } } };
  try {
    globalThis.fetch = async () => Response.json({}, { status: 401 });
    await assert.rejects(loadNotifications(), error => error.status === 401);
    assert.equal(redirected, false);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("notifications use existing customer endpoints and safe internal destinations", async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/v1/me/notifications");
    assert.equal(options.method, "GET");
    return Response.json([row]);
  };
  const [item] = await loadNotifications();
  assert.equal(notificationHref(item), "/account/feedback/12");
  assert.equal(notificationHref({ ...item, refType: "https://evil.example" }), null);
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/v1/me/notifications/9/read");
    assert.equal(options.method, "POST");
    return new Response(null, { status: 204 });
  };
  await markNotificationRead(9);
  await assert.rejects(markNotificationRead(-1));
});

test("initial history, repeats and already-read replies never produce new toasts", () => {
  assert.deepEqual(newFeedbackNotifications([row], null), []);
  assert.deepEqual(newFeedbackNotifications([row], new Set([9])), []);
  assert.deepEqual(newFeedbackNotifications([{ ...row, isRead: true }], new Set()), []);
  assert.deepEqual(newFeedbackNotifications([{ ...row, refType: "Survey" }], new Set()), []);
  assert.deepEqual(newFeedbackNotifications([row], new Set()), [row]);
});

test("malformed data and unavailable endpoints are not an empty notification inbox", async () => {
  for (const payload of [{}, [{ ...row, isRead: undefined }], [row, row], [{ ...row, refId: -1 }]]) {
    globalThis.fetch = async () => Response.json(payload);
    await assert.rejects(loadNotifications());
  }
  globalThis.fetch = async () => Response.json({}, { status: 501 });
  await assert.rejects(loadNotifications(), error => error.status === 501);
  await assert.rejects(markNotificationRead(9), error => error.status === 501);
});
