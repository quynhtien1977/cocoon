import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { requestPasswordCode, resetPassword, validateResetDraft } from "../features/auth/password-reset-service.ts";
import { resendInvitation } from "../features/customers/api.ts";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test("the reset form checks email, the 6-digit code and the password rule before calling the API", () => {
  assert.deepEqual(validateResetDraft({ email: "lan@example.com", code: "012345", newPassword: "MatKhau2026", confirmPassword: "MatKhau2026" }), {});
  const errors = validateResetDraft({ email: "lan@", code: "12a45", newPassword: "ngan", confirmPassword: "khac" });
  assert.deepEqual(Object.keys(errors).sort(), ["code", "confirmPassword", "email", "newPassword"]);
  assert.match(errors.newPassword, /8–128 ký tự/);
  assert.equal(validateResetDraft({ email: "lan@example.com", code: "123456", newPassword: "chỉcóchữthôi", confirmPassword: "chỉcóchữthôi" }).newPassword !== undefined, true);
});

test("forgot and reset call the anonymous endpoints without refreshing or redirecting", async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return url.endsWith("/forgot") ? Response.json({ message: "Nếu email này có tài khoản Cocoon, mã xác nhận đã được gửi tới hộp thư." }, { status: 202 }) : new Response(null, { status: 204 });
  };
  assert.match(await requestPasswordCode("  lan@example.com "), /mã xác nhận/);
  await resetPassword({ email: " lan@example.com", code: " 012345 ", newPassword: "MatKhau2026", confirmPassword: "MatKhau2026" });
  assert.deepEqual(calls.map(c => [c.url, c.options.method]), [["/api/v1/auth/password/forgot", "POST"], ["/api/v1/auth/password/reset", "POST"]]);
  assert.deepEqual(JSON.parse(calls[0].options.body), { email: "lan@example.com" });
  assert.deepEqual(JSON.parse(calls[1].options.body), { email: "lan@example.com", code: "012345", newPassword: "MatKhau2026" });
  assert.equal(calls.length, 2);  // no refresh attempt for anonymous calls
});

test("a wrong code surfaces INVALID_CODE on the code field", async () => {
  globalThis.fetch = async () => Response.json({ status: 400, code: "INVALID_CODE", errors: { code: ["Mã xác nhận không đúng hoặc đã hết hạn. Hãy yêu cầu mã mới."] } }, { status: 400 });
  await assert.rejects(resetPassword({ email: "lan@example.com", code: "000000", newPassword: "MatKhau2026", confirmPassword: "MatKhau2026" }),
    error => error.status === 400 && error.code === "INVALID_CODE");
});

test("managers can resend the invitation email", async () => {
  let call;
  globalThis.fetch = async (url, options) => { call = { url, method: options.method }; return Response.json({ sent: true }, { status: 202 }); };
  assert.deepEqual(await resendInvitation(42), { sent: true });
  assert.deepEqual(call, { url: "/api/v1/customers/42/invitation", method: "POST" });
});
