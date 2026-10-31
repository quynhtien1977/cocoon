import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { logout } from "../features/auth/logout-service.ts";

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
});

test("logout sends cookies to the existing endpoint before replacing the page", async () => {
  const events = [];
  globalThis.window = { location: { replace: path => events.push(path) } };
  globalThis.fetch = async (url, options) => {
    events.push(url);
    assert.equal(options.method, "POST");
    assert.equal(options.credentials, "include");
    return new Response(null, { status: 204 });
  };
  await logout();
  assert.deepEqual(events, ["/api/v1/auth/logout", "/"]);
});

test("failed logout stays on the profile and never refreshes or reports success", async () => {
  let navigated = false;
  globalThis.window = { location: { replace() { navigated = true; } } };
  const urls = [];
  globalThis.fetch = async url => { urls.push(url); return Response.json({}, { status: 500 }); };
  await assert.rejects(logout());
  assert.equal(navigated, false);
  assert.deepEqual(urls, ["/api/v1/auth/logout"]);
});
