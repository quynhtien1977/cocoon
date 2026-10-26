import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { loadProfile, loadPreferences, saveProfile, savePreferences, validateProfile } from "../features/customer/profile-service.ts";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const profile = { fullName: "Nguyễn An", email: "an@example.com", phone: null, dateOfBirth: null, gender: null, address: null, consentPersonalData: true };

test("profile loads registration values without inventing missing account data", async () => {
  globalThis.fetch = async () => Response.json(profile);
  const result = await loadProfile();
  assert.equal(result.fullName, "Nguyễn An");
  assert.equal(result.email, "an@example.com");
  assert.equal(result.phone, "");
  assert.equal(result.consentPersonalData, true);
  globalThis.fetch = async () => Response.json({ role: "Customer" });
  await assert.rejects(loadProfile());
});

test("profile validation rejects invalid dates, phones and blank names before writing", async () => {
  const values = { ...profile, phone: "", dateOfBirth: "", gender: "", address: "" };
  assert.deepEqual(validateProfile(values), {});
  assert.ok(validateProfile({ ...values, dateOfBirth: "2025-02-30" }).dateOfBirth);
  assert.ok(validateProfile({ ...values, dateOfBirth: "2999-01-01" }).dateOfBirth);
  assert.ok(validateProfile({ ...values, phone: "abc" }).phone);
  assert.ok(validateProfile({ ...values, fullName: " " }).fullName);
  assert.ok(validateProfile({ ...values, address: "a".repeat(1001) }).address);
  let writes = 0;
  globalThis.fetch = async () => { writes++; return new Response(null, { status: 204 }); };
  await assert.rejects(saveProfile({ ...values, fullName: " " }));
  assert.equal(writes, 0);
});

test("profile updates only the supported fields, preserving explicit consent", async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/v1/me");
    assert.equal(options.method, "PUT");
    assert.equal(options.credentials, "include");
    assert.deepEqual(JSON.parse(options.body), { fullName: "Nguyễn An", phone: "+84 912345678", dateOfBirth: "2000-01-02", gender: "Nữ", address: null, consentPersonalData: false });
    return new Response(null, { status: 204 });
  };
  await saveProfile({ ...profile, fullName: " Nguyễn An ", phone: "+84 912345678", dateOfBirth: "2000-01-02", gender: "Nữ", address: " ", consentPersonalData: false, role: "Admin", password: "never-send" });
});

test("preferences use registration groups and preserve unknown or inactive saved IDs", async () => {
  globalThis.fetch = async (url) => Response.json(url === "/api/v1/preferences"
    ? [{ id: 42, name: "Dry Skin" }, { id: 50, name: "Facial Care" }, { id: 77, name: "Old choice", isActive: false }]
    : { preferenceIds: [42, 77, 99] });
  const result = await loadPreferences();
  assert.deepEqual(result.selected, [42, 77, 99]);
  assert.equal(result.options.find(option => option.id === 42).group, "skin");
  assert.equal(result.options.find(option => option.id === 50).group, "products");
  assert.ok(result.options.find(option => option.id === 77).inactive);
  assert.ok(result.options.find(option => option.id === 99));
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/v1/me/preferences");
    assert.deepEqual(JSON.parse(options.body), { preferenceIds: [42, 77, 99] });
    return new Response(null, { status: 204 });
  };
  await savePreferences([42, 77, 99, 42]);
});

test("empty preferences can be saved, malformed or unavailable responses cannot masquerade as empty", async () => {
  globalThis.fetch = async (_url, options) => {
    assert.deepEqual(JSON.parse(options.body), { preferenceIds: [] });
    return new Response(null, { status: 204 });
  };
  await savePreferences([]);
  await assert.rejects(savePreferences([-1]));
  globalThis.fetch = async () => Response.json({ unexpected: true });
  await assert.rejects(loadPreferences());
  globalThis.fetch = async () => Response.json({}, { status: 501 });
  await assert.rejects(savePreferences([42]));
  await assert.rejects(loadProfile());
});
