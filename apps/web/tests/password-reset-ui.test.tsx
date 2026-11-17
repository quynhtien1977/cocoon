import "./dom-setup.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import type { ContextType, ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { LoginPage } from "../features/auth/login-page";
import { ResetPasswordForm } from "../features/auth/reset-password-page";
import { CustomerCreateForm } from "../features/customers/components/customer-create-form";

const realFetch = globalThis.fetch;

beforeEach(() => {
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  cleanup();
  globalThis.fetch = realFetch;
});

function withRouter(node: ReactNode, onReplace?: (url: string) => void) {
  const router = {
    back() {},
    forward() {},
    refresh() {},
    push() {},
    replace(url: string) { onReplace?.(url); },
    prefetch() {},
  } as unknown as NonNullable<ContextType<typeof AppRouterContext>>;
  return <AppRouterContext.Provider value={router}>{node}</AppRouterContext.Provider>;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("LoginPage shows ?reset=1 banner on public portal and hides forgot button on admin portal", () => {
  window.history.replaceState(null, "", "/login?reset=1&email=customer01%40cocoon.demo");
  const { unmount } = render(withRouter(<LoginPage portal="shared" />));
  assert.ok(screen.getByText("Đã đặt mật khẩu, hãy đăng nhập."));
  assert.equal((screen.getByLabelText("Email") as HTMLInputElement).value, "customer01@cocoon.demo");
  assert.ok(screen.getByRole("button", { name: "Quên mật khẩu?" }).hasAttribute("disabled") === false);
  unmount();

  render(withRouter(<LoginPage portal="admin" />));
  assert.equal(screen.queryByRole("button", { name: "Quên mật khẩu?" }), null);
  assert.equal(screen.queryByText("Đã đặt mật khẩu, hãy đăng nhập."), null);
});

type Call = { url: string; body: Record<string, string> };

/** Fake API for the three recovery endpoints; `answers` decides each reply. */
function recoveryApi(answers: { verify?: () => Response; reset?: () => Response } = {}) {
  const calls: Call[] = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body ? JSON.parse(init.body as string) : {} });
    if (url.endsWith("/forgot")) return json({ message: "Nếu email này có tài khoản Cocoon, mã xác nhận đã được gửi tới hộp thư." }, 202);
    if (url.endsWith("/verify")) return answers.verify?.() ?? json({ ticket: "7.1.ABC", expiresAt: "2026-11-15T10:10:00Z" });
    return answers.reset?.() ?? new Response(null, { status: 204 });
  }) as typeof fetch;
  return calls;
}

test("Quên mật khẩu in the login panel goes email → code → new password, and back to login", async () => {
  const user = userEvent.setup();
  const calls = recoveryApi({
    verify: () => calls.filter((c) => c.url.endsWith("/verify")).length === 1
      ? json({ status: 400, code: "INVALID_CODE", detail: "Mã xác nhận không đúng hoặc đã hết hạn. Hãy yêu cầu mã mới.", errors: { code: ["Mã xác nhận không đúng hoặc đã hết hạn. Hãy yêu cầu mã mới."] } }, 400)
      : json({ ticket: "7.1.ABC", expiresAt: "2026-11-15T10:10:00Z" }),
  });

  render(withRouter(<LoginPage portal="shared" />));
  await user.type(screen.getByLabelText("Email"), "customer01@cocoon.demo");
  await user.click(screen.getByRole("button", { name: "Quên mật khẩu?" }));

  // Step 1: the typed email comes along; a bad address never reaches the API.
  const emailInput = screen.getByLabelText("Email") as HTMLInputElement;
  assert.equal(emailInput.value, "customer01@cocoon.demo");
  await user.clear(emailInput);
  await user.type(emailInput, "khong-hop-le");
  await user.click(screen.getByRole("button", { name: "GỬI MÃ XÁC NHẬN" }));
  assert.ok(screen.getByText("Email không hợp lệ."));
  assert.equal(calls.length, 0);
  await user.clear(emailInput);
  await user.type(emailInput, "customer01@cocoon.demo");
  await user.click(screen.getByRole("button", { name: "GỬI MÃ XÁC NHẬN" }));

  // Step 2: only the code; a wrong code stays on this step.
  assert.ok(await screen.findByRole("heading", { name: "Nhập mã xác nhận" }));
  assert.ok(screen.getByText(/mã xác nhận đã được gửi tới hộp thư/));
  assert.equal(screen.queryByLabelText("Mật khẩu mới"), null);
  const codeInput = screen.getByLabelText("Mã xác nhận (6 chữ số)") as HTMLInputElement;
  assert.equal(codeInput.getAttribute("autocomplete"), "one-time-code");
  await user.type(codeInput, "12ab3");
  assert.equal(codeInput.value, "123");
  await user.click(screen.getByRole("button", { name: "XÁC NHẬN MÃ" }));
  assert.ok(screen.getByText("Mã xác nhận gồm 6 chữ số."));
  await user.type(codeInput, "456");
  await user.click(screen.getByRole("button", { name: "XÁC NHẬN MÃ" }));
  assert.ok(await screen.findByText("Mã xác nhận không đúng hoặc đã hết hạn. Hãy yêu cầu mã mới."));
  assert.equal(screen.queryByLabelText("Mật khẩu mới"), null);
  await user.click(screen.getByRole("button", { name: "Gửi lại mã" }));
  await user.clear(codeInput);
  await user.type(codeInput, "654321");
  await user.click(screen.getByRole("button", { name: "XÁC NHẬN MÃ" }));

  // Step 3: just the two password fields, no email or code.
  assert.ok(await screen.findByRole("heading", { name: "Đặt mật khẩu mới" }));
  assert.equal(screen.queryByLabelText("Email"), null);
  assert.equal(screen.queryByLabelText("Mã xác nhận (6 chữ số)"), null);
  assert.ok(screen.getByLabelText("Mật khẩu mới"));
  assert.ok(screen.getByLabelText("Nhập lại mật khẩu mới"));

  assert.deepEqual(calls.map((c) => [c.url, c.body]), [
    ["/api/v1/auth/password/forgot", { email: "customer01@cocoon.demo" }],
    ["/api/v1/auth/password/verify", { email: "customer01@cocoon.demo", code: "123456" }],
    ["/api/v1/auth/password/forgot", { email: "customer01@cocoon.demo" }],
    ["/api/v1/auth/password/verify", { email: "customer01@cocoon.demo", code: "654321" }],
  ]);

  await user.click(screen.getByRole("button", { name: "Quay lại đăng nhập" }));
  assert.ok(screen.getByRole("heading", { name: "Cocoon chào bạn trở lại." }));
});

test("The email link opens on the code step, and the new password is set with the ticket", async () => {
  const user = userEvent.setup();
  const loaded: string[] = [];
  let resets = 0;
  const calls = recoveryApi({
    reset: () => ++resets === 1
      ? json({ status: 400, code: "VALIDATION_ERROR", detail: "Dữ liệu không hợp lệ.", errors: { newPassword: ["Mật khẩu phải có ít nhất 8 ký tự, gồm chữ và số."] } }, 400)
      : new Response(null, { status: 204 }),
  });

  render(withRouter(<ResetPasswordForm initialEmail="customer01@cocoon.demo" navigate={(url) => loaded.push(url)} onClose={() => {}} />));
  assert.ok(screen.getByRole("heading", { name: "Nhập mã xác nhận" }));
  assert.ok(screen.getByText("customer01@cocoon.demo"));
  await user.type(screen.getByLabelText("Mã xác nhận (6 chữ số)"), "123456");
  await user.click(screen.getByRole("button", { name: "XÁC NHẬN MÃ" }));

  const newInput = await screen.findByLabelText("Mật khẩu mới");
  const confirmInput = screen.getByLabelText("Nhập lại mật khẩu mới");
  await user.type(newInput, "abc123");
  await user.type(confirmInput, "khacnhau123");
  await user.click(screen.getByRole("button", { name: "ĐẶT MẬT KHẨU MỚI" }));
  assert.ok(screen.getByText("Mật khẩu cần 8–128 ký tự, có chữ và số."));
  assert.ok(screen.getByText("Mật khẩu nhập lại chưa khớp."));

  await user.clear(newInput);
  await user.type(newInput, "MatKhauMoi9");
  await user.clear(confirmInput);
  await user.type(confirmInput, "MatKhauMoi9");
  await user.click(screen.getByRole("button", { name: "ĐẶT MẬT KHẨU MỚI" }));
  assert.ok(await screen.findByText("Mật khẩu phải có ít nhất 8 ký tự, gồm chữ và số."));

  await user.click(screen.getByRole("button", { name: "ĐẶT MẬT KHẨU MỚI" }));
  assert.ok(await screen.findByText(/Đã đặt mật khẩu/));
  assert.deepEqual(calls.filter((c) => c.url.endsWith("/reset")).map((c) => c.body), [
    { ticket: "7.1.ABC", newPassword: "MatKhauMoi9" }, { ticket: "7.1.ABC", newPassword: "MatKhauMoi9" }]);
  assert.deepEqual(loaded, ["/login?reset=1&email=customer01%40cocoon.demo"]);
});

test("An expired ticket sends the user back to the code step with the reason", async () => {
  const user = userEvent.setup();
  recoveryApi({ reset: () => json({ status: 400, code: "RESET_EXPIRED", detail: "Phiên đặt mật khẩu đã hết hạn. Hãy nhập lại mã xác nhận hoặc yêu cầu mã mới." }, 400) });
  render(withRouter(<ResetPasswordForm initialEmail="customer01@cocoon.demo" onClose={() => {}} navigate={() => {}} />));
  await user.type(screen.getByLabelText("Mã xác nhận (6 chữ số)"), "123456");
  await user.click(screen.getByRole("button", { name: "XÁC NHẬN MÃ" }));
  await user.type(await screen.findByLabelText("Mật khẩu mới"), "MatKhauMoi9");
  await user.type(screen.getByLabelText("Nhập lại mật khẩu mới"), "MatKhauMoi9");
  await user.click(screen.getByRole("button", { name: "ĐẶT MẬT KHẨU MỚI" }));
  assert.ok(await screen.findByRole("heading", { name: "Nhập mã xác nhận" }));
  assert.ok(screen.getByText(/Phiên đặt mật khẩu đã hết hạn/));
  assert.equal((screen.getByLabelText("Mã xác nhận (6 chữ số)") as HTMLInputElement).value, "");
});

test("Without an email in the link the reset dialog starts by asking for it", () => {
  render(withRouter(<ResetPasswordForm onClose={() => {}} />));
  assert.ok(screen.getByRole("heading", { name: "Quên mật khẩu" }));
  assert.ok(screen.getByRole("button", { name: "GỬI MÃ XÁC NHẬN" }));
});

test("M3 warns and allows resending activation email when invitationSent is false", async () => {
  const user = userEvent.setup();
  let resendAttempt = 0;
  const requests: { url: string; method: string }[] = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    requests.push({ url, method: init?.method ?? "GET" });
    if (url.endsWith("/customers")) {
      return json({ id: 77, email: "chua-gui@cocoon.demo", mustChangePassword: true, invitationSent: false }, 201);
    }
    resendAttempt += 1;
    if (resendAttempt === 1) {
      return json({ status: 503, code: "EMAIL_SEND_FAILED", detail: "Không gửi được email lúc này." }, 503);
    }
    return json({ sent: true }, 202);
  }) as typeof fetch;

  render(<CustomerCreateForm />);
  await user.type(screen.getByLabelText(/Họ và tên/), "Trần Minh Anh");
  await user.type(screen.getByLabelText(/Email/), "chua-gui@cocoon.demo");
  await user.type(screen.getByLabelText(/Số điện thoại/), "0912345679");
  await user.type(screen.getByLabelText(/Địa chỉ nhận hàng và liên hệ/), "12 Lê Lợi, Q.1, TP. HCM");
  await user.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));

  assert.ok(await screen.findByText(/Đã tạo hồ sơ khách hàng Trần Minh Anh, nhưng chưa gửi được email mật khẩu tạm tới chua-gui@cocoon\.demo\./));
  await user.click(screen.getByRole("button", { name: "Gửi lại email" }));
  assert.ok(await screen.findByText("Không gửi được email lúc này."));

  await user.click(screen.getByRole("button", { name: "Gửi lại email" }));
  assert.ok(await screen.findByText(/Đã tạo hồ sơ khách hàng Trần Minh Anh\. Đã gửi email mật khẩu tạm tới chua-gui@cocoon\.demo\./));
  assert.deepEqual(
    requests.map((r) => `${r.method} ${r.url}`),
    ["POST /api/v1/customers", "POST /api/v1/customers/77/invitation", "POST /api/v1/customers/77/invitation"],
  );
});
