import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { apiRequest, ApiError } from "../../apps/web/lib/api/client.ts";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test("a 401 refreshes once and retries the original JSON body", async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (calls.length === 1) return new Response(null, { status: 401 });
    if (url.endsWith("/auth/refresh")) return new Response(null, { status: 204 });
    return Response.json({ id: 1 });
  };
  assert.deepEqual(await apiRequest("/customers", { method: "POST", json: { name: "Thử nghiệm" } }), { id: 1 });
  assert.equal(calls.length, 3);
  assert.equal(calls[0].options.body, calls[2].options.body);
  assert.equal(calls[2].options.credentials, "include");
});

test("simultaneous 401 responses share one refresh request", async () => {
  let refreshed = false;
  let refreshCalls = 0;
  globalThis.fetch = async (url) => {
    if (url.endsWith("/auth/refresh")) {
      refreshCalls++;
      await new Promise((resolve) => setTimeout(resolve, 10));
      refreshed = true;
      return new Response(null, { status: 204 });
    }
    return refreshed ? Response.json({ ok: true }) : new Response(null, { status: 401 });
  };
  await Promise.all([apiRequest("/me/profile"), apiRequest("/me/preferences")]);
  assert.equal(refreshCalls, 1);
});

test("a failed refresh does not loop", async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response(null, { status: 401 }); };
  await assert.rejects(apiRequest("/me/profile"), (error) => error instanceof ApiError && error.status === 401);
  assert.equal(calls, 2);
});

test("login validation errors retain their field messages without refresh", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json({ status: 400, code: "VALIDATION_ERROR", errors: { email: ["Email không hợp lệ"] } }, { status: 400 });
  };
  await assert.rejects(apiRequest("/auth/login", { method: "POST", json: {} }), (error) =>
    error instanceof ApiError && error.errors.email[0] === "Email không hợp lệ");
  assert.equal(calls, 1);
});

test("a successful 204 has no JSON body", async () => {
  globalThis.fetch = async () => new Response(null, { status: 204 });
  assert.equal(await apiRequest("/auth/logout", { method: "POST" }), undefined);
});

test("a second 401 after successful refresh stops after one retry", async () => {
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls++;
    return new Response(null, { status: url.endsWith("/auth/refresh") ? 204 : 401 });
  };
  await assert.rejects(apiRequest("/me/profile"), (error) => error.status === 401);
  assert.equal(calls, 3);
});

test("malformed error fields are ignored", async () => {
  globalThis.fetch = async () => Response.json({ title: {}, errors: { email: "invalid", name: ["Tên không hợp lệ"] } }, { status: 400 });
  await assert.rejects(apiRequest("/me/profile"), (error) => error instanceof ApiError
    && error.errors.email === undefined && error.errors.name[0] === "Tên không hợp lệ");
});
