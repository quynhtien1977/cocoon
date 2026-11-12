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

const renewedCookies = ["access_token=new-access; expires=Thu, 13 Nov 2026 10:15:00 GMT; path=/; samesite=lax; httponly", "refresh_token=new-refresh; expires=Thu, 20 Nov 2026 10:00:00 GMT; path=/; samesite=lax; httponly"];
const refreshApi = (refreshResponse, profileRole) => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push([url, options.method, options.headers.Cookie]);
    if (url.endsWith("/api/v1/auth/refresh")) return refreshResponse();
    if (options.headers.Cookie === "access_token=new-access") return Response.json({ role: profileRole });
    return new Response(null, { status: 401 });
  };
  return calls;
};

test("an expired access cookie is renewed with the refresh token and the new pair reaches the browser", async () => {
  process.env.API_URL = "http://backend.test:5080";
  const ok = () => new Response(null, { status: 204, headers: renewedCookies.map((value) => ["set-cookie", value]) });
  for (const cookie of ["refresh_token=old-refresh", "access_token=expired; refresh_token=old-refresh"]) {
    const calls = refreshApi(ok, "Manager");
    const response = await proxy(request("/manager/feedback/9", cookie));
    assert.equal(response.headers.get("x-middleware-next"), "1");
    assert.deepEqual(response.headers.getSetCookie(), renewedCookies);
    assert.match(response.headers.get("cache-control"), /no-store/);
    assert.deepEqual(calls.filter(([url]) => url.endsWith("/auth/refresh")), [["http://backend.test:5080/api/v1/auth/refresh", "POST", "refresh_token=old-refresh"]]);
    assert.deepEqual(calls.at(-1), ["http://backend.test:5080/api/v1/me", "GET", "access_token=new-access"]);
  }
});

test("a failed refresh redirects to login and forwards the API's cookie deletions", async () => {
  const deletions = ["access_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; httponly", "refresh_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; httponly"];
  refreshApi(() => new Response(null, { status: 401, headers: deletions.map((value) => ["set-cookie", value]) }), "Manager");
  const response = await proxy(request("/manager", "refresh_token=stolen-or-expired"));
  denied(response, "/manager");
  assert.deepEqual(response.headers.getSetCookie(), deletions);
  // A 204 without a new access cookie is not a session either.
  refreshApi(() => new Response(null, { status: 204 }), "Manager");
  denied(await proxy(request("/manager", "refresh_token=odd")), "/manager");
});

test("a renewed session still needs the portal's role, but keeps its new cookies", async () => {
  refreshApi(() => new Response(null, { status: 204, headers: renewedCookies.map((value) => ["set-cookie", value]) }), "Customer");
  const response = await proxy(request("/manager", "refresh_token=customer-refresh"));
  denied(response, "/manager");
  assert.deepEqual(response.headers.getSetCookie(), renewedCookies);
});
