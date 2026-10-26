import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { getAccountRole, loginErrorMessage, signIn, validateLogin } from "../features/auth/login-service.ts";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test("login accepts existing passwords and rejects invalid email or empty password", () => {
  assert.deepEqual(validateLogin(" customer@example.com ", "old-pass"), { email: "", password: "" });
  assert.ok(validateLogin("0901234567", "pass").email);
  assert.ok(validateLogin("person@example.com", "").password);
  assert.equal(getAccountRole({ role: "superuser" }), null);
  assert.equal(getAccountRole({ role: 100 }), null);
  assert.equal(getAccountRole({ role: "ADMIN" }), "Admin");
});

for (const [role, portal, destination] of [["Customer", "shared", "/account"], ["Customer", "customer", "/account"], ["Staff", "shared", "/staff/feedback"], ["Manager", "shared", "/manager"], [0, "admin", "/admin"]]) {
  test(`login routes ${role} using the authenticated profile`, async () => {
    const calls = [];
    globalThis.fetch = async (url, options) => {
      calls.push(url);
      assert.equal(options.credentials, "include");
      if (url === "/api/v1/auth/login") {
        assert.deepEqual(JSON.parse(options.body), { email: "person@example.com", password: "test-password" });
        return new Response(null, { status: 204 });
      }
      assert.equal(url, "/api/v1/me");
      return Response.json({ role });
    };
    assert.equal(await signIn(" person@example.com ", "test-password", portal), destination);
    assert.deepEqual(calls, ["/api/v1/auth/login", "/api/v1/me"]);
  });
}

for (const [role, portal] of [["Admin", "shared"], ["Customer", "admin"], ["Unknown", "shared"], ["Staff", "customer"], ["Manager", "customer"], ["Admin", "customer"]]) {
  test(`wrong or unknown role ${role} is rejected and its session is cleared`, async () => {
    const calls = [];
    globalThis.fetch = async (url) => {
      calls.push(url);
      return url === "/api/v1/me" ? Response.json({ role }) : new Response(null, { status: 204 });
    };
    await assert.rejects(signIn("person@example.com", "test-password", portal));
    assert.deepEqual(calls, ["/api/v1/auth/login", "/api/v1/me", "/api/v1/auth/logout"]);
  });
}

test("the existing 501 stub displays unavailable without fabricating a session", async () => {
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    return Response.json({ title: "Not implemented" }, { status: 501 });
  };
  await assert.rejects(signIn("person@example.com", "test-password", "shared"), (error) => {
    assert.match(loginErrorMessage(error), /chưa được kích hoạt/);
    return true;
  });
  assert.deepEqual(calls, ["/api/v1/auth/login"]);
});
