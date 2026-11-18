import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { requestPasswordCode, resetPassword, validateCode, validateEmail, validateNewPassword, verifyPasswordCode } from "../features/auth/password-reset-service.ts";
import { resendInvitation } from "../features/customers/api.ts";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test("each step checks its own field before calling the API", () => {
  assert.equal(validateEmail(" lan@example.com "), undefined);
  assert.equal(validateEmail("lan@"), "Email không hợp lệ.");
  assert.equal(validateCode(" 012345 "), undefined);
  assert.equal(validateCode("12a45"), "Mã xác nhận gồm 6 chữ số.");
  assert.deepEqual(validateNewPassword({ newPassword: "MatKhau2026", confirmPassword: "MatKhau2026" }), {});
  const errors = validateNewPassword({ newPassword: "ngan", confirmPassword: "khac" });
  assert.deepEqual(Object.keys(errors).sort(), ["confirmPassword", "newPassword"]);
  assert.match(errors.newPassword, /8–128 ký tự/);
  assert.notEqual(validateNewPassword({ newPassword: "chỉcóchữthôi", confirmPassword: "chỉcóchữthôi" }).newPassword, undefined);
});

test("forgot, verify and reset call the anonymous endpoints without refreshing or redirecting", async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/forgot")) return Response.json({ message: "Nếu email này có tài khoản Cocoon, mã xác nhận đã được gửi tới hộp thư." }, { status: 202 });
    if (url.endsWith("/verify")) return Response.json({ ticket: "7.1.ABC", expiresAt: "2026-11-15T10:10:00Z" });
    return new Response(null, { status: 204 });
  };
  assert.match(await requestPasswordCode("  lan@example.com "), /mã xác nhận/);
  assert.deepEqual(await verifyPasswordCode(" lan@example.com", " 012345 "), { ticket: "7.1.ABC", expiresAt: "2026-11-15T10:10:00Z" });
  await resetPassword("7.1.ABC", "MatKhau2026");
  assert.deepEqual(calls.map(c => [c.url, c.options.method, JSON.parse(c.options.body)]), [
    ["/api/v1/auth/password/forgot", "POST", { email: "lan@example.com" }],
    ["/api/v1/auth/password/verify", "POST", { email: "lan@example.com", code: "012345" }],
    ["/api/v1/auth/password/reset", "POST", { ticket: "7.1.ABC", newPassword: "MatKhau2026" }],
  ]);  // three calls: no refresh attempt for anonymous calls
});

test("a wrong code surfaces INVALID_CODE, an old ticket RESET_EXPIRED", async () => {
  globalThis.fetch = async () => Response.json({ status: 400, code: "INVALID_CODE", errors: { code: ["Mã xác nhận không đúng hoặc đã hết hạn. Hãy yêu cầu mã mới."] } }, { status: 400 });
  await assert.rejects(verifyPasswordCode("lan@example.com", "000000"), error => error.status === 400 && error.code === "INVALID_CODE");
  globalThis.fetch = async () => Response.json({ status: 400, code: "RESET_EXPIRED", detail: "Phiên đặt mật khẩu đã hết hạn." }, { status: 400 });
  await assert.rejects(resetPassword("7.1.ABC", "MatKhau2026"), error => error.code === "RESET_EXPIRED");
});

test("managers can resend the invitation email", async () => {
  let call;
  globalThis.fetch = async (url, options) => { call = { url, method: options.method }; return Response.json({ sent: true }, { status: 202 }); };
  assert.deepEqual(await resendInvitation(42), { sent: true });
  assert.deepEqual(call, { url: "/api/v1/customers/42/invitation", method: "POST" });
});
