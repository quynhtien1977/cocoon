import "./dom-setup.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import type { ContextType, ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { LoginPage } from "../features/auth/login-page";
import { ResetPasswordPage } from "../features/auth/reset-password-page";
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

test("LoginPage switches in place to Quên mật khẩu, validates email, sends OTP request, and links to /reset-password", async () => {
  const user = userEvent.setup();
  const requests: { url: string; method: string; body: unknown }[] = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    requests.push({ url, method: init?.method ?? "GET", body: init?.body ? JSON.parse(init.body as string) : undefined });
    return json({ message: "Nếu email tồn tại, mã xác nhận đã được gửi tới hộp thư của bạn." }, 202);
  }) as typeof fetch;

  render(withRouter(<LoginPage portal="shared" />));
  await user.type(screen.getByLabelText("Email"), "customer01@cocoon.demo");
  await user.click(screen.getByRole("button", { name: "Quên mật khẩu?" }));

  const emailInput = screen.getByLabelText("Email") as HTMLInputElement;
  assert.equal(emailInput.value, "customer01@cocoon.demo");

  await user.clear(emailInput);
  await user.type(emailInput, "khong-hop-le");
  await user.click(screen.getByRole("button", { name: "GỬI MÃ XÁC NHẬN" }));
  assert.ok(screen.getByText("Email không hợp lệ."));
  assert.equal(requests.length, 0);

  await user.clear(emailInput);
  await user.type(emailInput, "customer01@cocoon.demo");
  await user.click(screen.getByRole("button", { name: "GỬI MÃ XÁC NHẬN" }));

  assert.ok(await screen.findByText(/Nếu email tồn tại, mã xác nhận đã được gửi/));
  const link = screen.getByRole("link", { name: /Nhập mã đặt lại mật khẩu/ });
  assert.equal(link.getAttribute("href"), "/reset-password?email=customer01%40cocoon.demo");
  assert.deepEqual(requests[0], {
    url: "/api/v1/auth/password/forgot",
    method: "POST",
    body: { email: "customer01@cocoon.demo" },
  });

  await user.click(screen.getByRole("button", { name: "Gửi lại mã" }));
  assert.equal(requests.length, 2);

  await user.click(screen.getByRole("button", { name: "Quay lại đăng nhập" }));
  assert.ok(screen.getByRole("heading", { name: "Cocoon chào bạn trở lại." }));
});

test("ResetPasswordPage pre-fills email, validates fields, maps API errors, and redirects to /login?reset=1", async () => {
  const user = userEvent.setup();
  const replaced: string[] = [];
  let mode: "invalid_code" | "weak_password" | "ok" = "invalid_code";
  globalThis.fetch = (async (url: string) => {
    if (url.endsWith("/auth/password/forgot")) {
      return json({ message: "Đã gửi lại mã xác nhận nếu email hợp lệ." }, 202);
    }
    if (mode === "invalid_code") {
      return json({ status: 400, code: "INVALID_CODE", detail: "Mã xác nhận không đúng hoặc đã hết hạn." }, 400);
    }
    if (mode === "weak_password") {
      return json({
        status: 400,
        code: "VALIDATION_ERROR",
        detail: "Dữ liệu không hợp lệ.",
        errors: { newPassword: ["Mật khẩu phải có ít nhất 8 ký tự, gồm chữ và số."] },
      }, 400);
    }
    return new Response(null, { status: 204 });
  }) as typeof fetch;

  render(withRouter(<ResetPasswordPage initialEmail="customer01@cocoon.demo" navigate={(url) => replaced.push(url)} />));
  const emailInput = screen.getByLabelText("Email") as HTMLInputElement;
  const codeInput = screen.getByLabelText("Mã xác nhận (6 chữ số)") as HTMLInputElement;
  const newInput = screen.getByLabelText("Mật khẩu mới") as HTMLInputElement;
  const confirmInput = screen.getByLabelText("Nhập lại mật khẩu mới") as HTMLInputElement;

  assert.equal(emailInput.value, "customer01@cocoon.demo");
  assert.equal(codeInput.getAttribute("inputmode"), "numeric");
  assert.equal(codeInput.getAttribute("autocomplete"), "one-time-code");

  // Client validation
  await user.type(codeInput, "123");
  await user.type(newInput, "abc123");
  await user.type(confirmInput, "khacnhau123");
  await user.click(screen.getByRole("button", { name: "ĐẶT MẬT KHẨU MỚI" }));
  assert.ok(screen.getByText("Mã xác nhận gồm 6 chữ số."));
  assert.ok(screen.getByText(/Mật khẩu nhập lại chưa khớp/));

  // Resend code
  await user.click(screen.getByRole("button", { name: "Gửi lại mã" }));
  assert.ok(await screen.findByText(/Đã gửi lại mã xác nhận nếu email hợp lệ/));

  // Server INVALID_CODE mapped to code field
  await user.clear(codeInput);
  await user.type(codeInput, "654321");
  await user.clear(newInput);
  await user.type(newInput, "MatKhauMoi9");
  await user.clear(confirmInput);
  await user.type(confirmInput, "MatKhauMoi9");
  await user.click(screen.getByRole("button", { name: "ĐẶT MẬT KHẨU MỚI" }));
  assert.ok(await screen.findByText("Mã xác nhận không đúng hoặc đã hết hạn."));

  // Server VALIDATION_ERROR mapped to newPassword field
  mode = "weak_password";
  await user.click(screen.getByRole("button", { name: "ĐẶT MẬT KHẨU MỚI" }));
  assert.ok(await screen.findByText("Mật khẩu phải có ít nhất 8 ký tự, gồm chữ và số."));

  // Success -> full load of /login?reset=1 carrying the email for the login form
  mode = "ok";
  await user.click(screen.getByRole("button", { name: "ĐẶT MẬT KHẨU MỚI" }));
  assert.ok(await screen.findByText("Đã đặt mật khẩu, hãy đăng nhập."));
  assert.deepEqual(replaced, ["/login?reset=1&email=customer01%40cocoon.demo"]);
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

  assert.ok(await screen.findByText(/Đã tạo hồ sơ khách hàng Trần Minh Anh, nhưng chưa gửi được email kích hoạt tới chua-gui@cocoon\.demo\./));
  await user.click(screen.getByRole("button", { name: "Gửi lại email" }));
  assert.ok(await screen.findByText("Không gửi được email lúc này."));

  await user.click(screen.getByRole("button", { name: "Gửi lại email" }));
  assert.ok(await screen.findByText(/Đã tạo hồ sơ khách hàng Trần Minh Anh\. Đã gửi email kích hoạt tới chua-gui@cocoon\.demo\./));
  assert.deepEqual(
    requests.map((r) => `${r.method} ${r.url}`),
    ["POST /api/v1/customers", "POST /api/v1/customers/77/invitation", "POST /api/v1/customers/77/invitation"],
  );
});
