import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { preferenceGroups, validateRegistration, resolvePreferenceIds, registerCustomer, registrationErrorMessage } from "../features/auth/register-service.ts";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const valid = { fullName: " Nguyễn An ", email: " an@example.com ", password: "Password1", confirmation: "Password1" };

test("registration validates every required field and confirmation", () => {
  assert.deepEqual(validateRegistration(valid), {});
  assert.deepEqual(Object.keys(validateRegistration({ fullName: " ", email: "wrong", password: "short", confirmation: "other" })), ["fullName", "email", "password", "confirmation"]);
  assert.ok(validateRegistration({ ...valid, password: "password1" }).password);
  assert.ok(validateRegistration({ ...valid, password: "PASSWORD1" }).password);
  assert.ok(validateRegistration({ ...valid, password: "Password" }).password);
  assert.ok(validateRegistration({ ...valid, confirmation: "" }).confirmation);
  assert.deepEqual(preferenceGroups.map((group) => group.options.length), [6, 5, 4]);
});

test("optional preferences resolve only to real active catalog IDs", () => {
  const rows = [{ id: 81, name: "Da khô / Mất nước", isActive: true }, { id: 95, name: "Facial Care" }];
  assert.deepEqual(resolvePreferenceIds(["dry", "face", "dry"], rows), [81, 95]);
  assert.throws(() => resolvePreferenceIds(["dry"], []));
  assert.throws(() => resolvePreferenceIds(["dry"], [{ ...rows[0], isActive: false }]));
  assert.throws(() => resolvePreferenceIds(["dry"], [rows[0], { ...rows[0], id: 82 }]));
  assert.throws(() => resolvePreferenceIds(["fake"], rows));
});

test("register without preferences sends only the public customer contract", async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push(url);
    const body = JSON.parse(options.body);
    assert.deepEqual(body, { fullName: "Nguyễn An", email: "an@example.com", password: "Password1", phone: null, dateOfBirth: null, gender: null, preferenceIds: [] });
    assert.equal(options.credentials, "include");
    return new Response(null, { status: 204 });
  };
  await registerCustomer(valid, []);
  assert.deepEqual(calls, ["/api/v1/auth/register"]);
});

test("registration establishes the session before reading and saving protected preferences", async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push(url);
    if (url === "/api/v1/preferences") return Response.json([{ id: 42, name: "Da khô" }]);
    assert.deepEqual(JSON.parse(options.body).preferenceIds, url.endsWith("/auth/register") ? [] : [42]);
    return new Response(null, { status: 204 });
  };
  assert.deepEqual(await registerCustomer(valid, ["dry"]), { preferencesError: null });
  assert.deepEqual(calls, ["/api/v1/auth/register", "/api/v1/preferences", "/api/v1/me/preferences"]);
});

test("a preference failure after account creation is reported separately, never as registration failure", async () => {
  const calls = [];
  globalThis.fetch = async (url) => { calls.push(url); return url.endsWith("/register") ? new Response(null, { status: 204 }) : Response.json({}, { status: 501 }); };
  assert.ok((await registerCustomer(valid, ["dry"])).preferencesError);
  assert.deepEqual(calls, ["/api/v1/auth/register", "/api/v1/preferences"]);
});

test("registration enforces API length limits before creating an account", async () => {
  assert.ok(validateRegistration({ ...valid, fullName: "a".repeat(151) }).fullName);
  assert.ok(validateRegistration({ ...valid, password: "Aa1".repeat(43) }).password);
  assert.ok(validateRegistration({ ...valid, email: "a".repeat(250) + "@example.com" }).email);
});

test("unmapped preferences never become invented IDs or a silent partial save", async () => {
  const calls = [];
  globalThis.fetch = async (url) => { calls.push(url); return url.endsWith("/register") ? new Response(null, { status: 204 }) : Response.json([{ id: 42, name: "Da khô" }]); };
  assert.ok((await registerCustomer(valid, ["dry", "gifts"])).preferencesError);
  assert.deepEqual(calls, ["/api/v1/auth/register", "/api/v1/preferences"]);
});

test("stub registration never reports success", async () => {
  globalThis.fetch = async () => Response.json({}, { status: 501 });
  await assert.rejects(registerCustomer(valid, []), error => { assert.match(registrationErrorMessage(error), /chưa được kích hoạt/); return true; });
});
