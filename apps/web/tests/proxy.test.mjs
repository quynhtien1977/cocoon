import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { NextRequest } from "next/server";
import { proxy, config } from "../proxy.ts";

const originalFetch = globalThis.fetch;
const originalApi = process.env.API_URL;
afterEach(() => { globalThis.fetch = originalFetch; if (originalApi === undefined) delete process.env.API_URL; else process.env.API_URL = originalApi; });
const request = (path, cookie) => new NextRequest(`http://localhost:3000${path}`, { headers: cookie ? { cookie } : {} });
const routes = [["/account", "Customer", 3], ["/staff", "Staff", 2], ["/manager", "Manager", 1], ["/admin", "Admin", 0]];
const denied = (response, path) => {
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), `http://localhost:3000${path.startsWith('/admin') ? '/admin/login' : '/login'}`);
  assert.match(response.headers.get("cache-control"), /no-store/);
};

test("public login routes, unrelated prefixes and assets bypass proxy", async () => {
  globalThis.fetch = () => { throw new Error("Public routes must not call API"); };
  for (const path of ["/", "/login", "/register", "/admin/login", "/admin/login/", "/accounting", "/staffing", "/api/v1/me", "/_next/static/app.js"]) assert.equal((await proxy(request(path))).headers.get("x-middleware-next"), "1");
  assert.deepEqual(config.matcher, ["/account/:path*", "/staff/:path*", "/manager/:path*", "/admin/:path*"]);
});

test("missing session and forged role cookies redirect without an API call", async () => {
  globalThis.fetch = () => { throw new Error("Missing token must not call API"); };
  for (const [path] of routes) {
    denied(await proxy(request(path)), path);
    denied(await proxy(request(`${path}/deep/path?next=https://evil.example`, 'role=Admin; user=1')), path);
  }
});

test("each portal accepts only its verified role, including numeric API roles", async () => {
  process.env.API_URL = "http://backend.test:5080/";
  for (const [path, role, numeric] of routes) {
    for (const returnedRole of [role, numeric]) {
      globalThis.fetch = async (url, options) => {
        assert.equal(url, "http://backend.test:5080/api/v1/me");
        assert.equal(options.headers.Cookie, "access_token=opaque-token");
        assert.equal(options.cache, "no-store");
        assert.equal(options.redirect, "manual");
        assert.ok(options.signal instanceof AbortSignal);
        return Response.json({ role: returnedRole });
      };
      for (const suffix of ["", "/", "/deep/path"]) assert.equal((await proxy(request(path + suffix, 'access_token=opaque-token; role=Admin; unrelated=private'))).headers.get("x-middleware-next"), "1");
    }
    for (const [, otherRole] of routes.filter((entry) => entry[1] !== role)) {
      globalThis.fetch = async () => Response.json({ role: otherRole });
      denied(await proxy(request(path, "access_token=opaque-token")), path);
    }
  }
});

test("expired/tampered tokens, unavailable API and malformed profiles fail closed", async () => {
  for (const status of [401, 403, 404, 429, 500, 501, 302]) {
    globalThis.fetch = async () => new Response(null, { status });
    denied(await proxy(request('/account/orders', 'access_token=invalid')), '/account');
  }
  for (const profile of [null, {}, { role: 'SuperAdmin' }, { role: '3' }, { role: 1.5 }]) {
    globalThis.fetch = async () => Response.json(profile);
    denied(await proxy(request('/admin/activity', 'access_token=invalid')), '/admin');
  }
  globalThis.fetch = async () => new Response('not json');
  denied(await proxy(request('/account', 'access_token=invalid')), '/account');
  globalThis.fetch = async () => { throw new DOMException('Timeout', 'TimeoutError'); };
  denied(await proxy(request('/staff/feedback', 'access_token=invalid')), '/staff');
});

test("prefetch/RSC headers and admin login subpaths cannot bypass guards", async () => {
  globalThis.fetch = async () => Response.json({ role: 'Customer' });
  denied(await proxy(new NextRequest('http://localhost:3000/admin/activity?_rsc=123', { headers: { cookie: 'access_token=test', rsc: '1', 'next-router-prefetch': '1', 'x-role': 'Admin' } })), '/admin');
  denied(await proxy(request('/admin/login/hidden', 'access_token=test')), '/admin');
});
