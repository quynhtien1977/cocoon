import "./dom-setup.mjs";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountProfile } from "../features/profile/components/account-profile";
import { toUpdateProfileRequest, validatePasswordDraft, validateProfileDraft } from "../features/profile/schemas";
import { navFor } from "../lib/screens";

const realFetch = globalThis.fetch;
let requests: { url: string; method: string; body: unknown }[] = [];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const me = (patch: Record<string, unknown> = {}) => ({ id: 3, email: "staff1@cocoon.demo", role: "Staff", fullName: "Nguyễn Tiến An", phone: null, dateOfBirth: null, gender: null, address: null, consentPersonalData: false, mustChangePassword: false, ...patch });

function stubFetch(respond: (url: string, method: string) => Response) {
  requests = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    requests.push({ url, method, body: init?.body ? JSON.parse(init.body as string) : undefined });
    return respond(url, method);
  }) as typeof fetch;
}

afterEach(() => { cleanup(); globalThis.fetch = realFetch; });

test("profile shows the account, saves name and phone through PUT me", async () => {
  stubFetch((_, method) => method === "PUT" ? new Response(null, { status: 204 }) : json(me()));
  const user = userEvent.setup();
  render(<AccountProfile code="S3" loginHref="/login" />);
  assert.ok(await screen.findByText("staff1@cocoon.demo"));
  assert.equal((screen.getByLabelText("Vai trò") as HTMLInputElement).value, "Nhân viên");
  assert.equal(screen.getByLabelText("Email đăng nhập").hasAttribute("readonly"), true);
  await user.clear(screen.getByLabelText("Họ và tên"));
  await user.type(screen.getByLabelText("Họ và tên"), "  Nguyễn An  ");
  await user.type(screen.getByLabelText("Số điện thoại"), "0912 345 678");
  await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  assert.ok(await screen.findByText("Đã lưu thông tin cá nhân."));
  const put = requests.find((item) => item.method === "PUT")!;
  assert.equal(put.url, "/api/v1/me");
  assert.deepEqual(put.body, { fullName: "Nguyễn An", phone: "0912 345 678", dateOfBirth: null, gender: null, address: null, consentPersonalData: false });
  assert.ok(screen.getAllByText("Nguyễn An").length > 0, "header name follows the saved value");
});

test("profile reports invalid fields and an unchanged form without calling the API", async () => {
  stubFetch(() => json(me()));
  const user = userEvent.setup();
  render(<AccountProfile code="S3" loginHref="/login" />);
  await screen.findByText("staff1@cocoon.demo");
  await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  assert.match(screen.getByRole("alert").textContent ?? "", /Chưa có thay đổi/);
  await user.clear(screen.getByLabelText("Họ và tên"));
  await user.type(screen.getByLabelText("Số điện thoại"), "12");
  await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  assert.ok(screen.getByText("Nhập họ và tên."));
  assert.ok(screen.getByText("Nhập số điện thoại hợp lệ (8–15 chữ số)."));
  assert.equal(requests.filter((item) => item.method === "PUT").length, 0);
});

test("password change shows the API's field error, then asks to sign in again on success", async () => {
  let attempt = 0;
  stubFetch((url) => {
    if (!url.endsWith("/change-password")) return json(me({ role: "Admin", mustChangePassword: true }));
    attempt++;
    return attempt === 1
      ? json({ detail: "Mật khẩu hiện tại không đúng.", code: "INVALID_CURRENT_PASSWORD", errors: { currentPassword: ["Mật khẩu hiện tại không đúng."] } }, 400)
      : new Response(null, { status: 204 });
  });
  const user = userEvent.setup();
  render(<AccountProfile code="A4" loginHref="/admin/login" />);
  assert.ok(await screen.findByText(/mật khẩu tạm/));
  await user.type(screen.getByLabelText("Mật khẩu hiện tại"), "Sai@12345");
  await user.type(screen.getByLabelText("Mật khẩu mới"), "MoiHon2026");
  await user.type(screen.getByLabelText("Nhập lại mật khẩu mới"), "MoiHon2026");
  await user.click(screen.getByRole("button", { name: "Đổi mật khẩu" }));
  assert.ok(await screen.findByText("Mật khẩu hiện tại không đúng."));
  await user.click(screen.getByRole("button", { name: "Đổi mật khẩu" }));
  assert.equal((await screen.findByRole("link", { name: "Đăng nhập lại" })).getAttribute("href"), "/admin/login");
  assert.deepEqual(requests.find((item) => item.url.endsWith("/change-password"))!.body, { currentPassword: "Sai@12345", newPassword: "MoiHon2026" });
});

test("profile load failure offers a retry", async () => {
  stubFetch(() => json({}, 500));
  const user = userEvent.setup();
  render(<AccountProfile code="M15" loginHref="/login" />);
  assert.ok(await screen.findByText("Chưa tải được hồ sơ."));
  stubFetch(() => json(me({ role: "Manager" })));
  await user.click(screen.getByRole("button", { name: "Thử lại" }));
  assert.equal((await screen.findByLabelText("Vai trò") as HTMLInputElement).value, "Quản lý");
});

test("validation mirrors the API's password and profile rules", () => {
  const ok = { currentPassword: "Cu@12345", newPassword: "MoiHon2026", confirmPassword: "MoiHon2026" };
  assert.deepEqual(validatePasswordDraft(ok), {});
  assert.equal(validatePasswordDraft({ ...ok, newPassword: "chicochu", confirmPassword: "chicochu" }).newPassword, "Mật khẩu cần 8–128 ký tự, có chữ và số.");
  assert.equal(validatePasswordDraft({ ...ok, newPassword: ok.currentPassword, confirmPassword: ok.currentPassword }).newPassword, "Mật khẩu mới phải khác mật khẩu hiện tại.");
  assert.equal(validatePasswordDraft({ ...ok, confirmPassword: "khac1234" }).confirmPassword, "Mật khẩu nhập lại không khớp.");
  assert.deepEqual(validateProfileDraft({ fullName: "An", phone: "" }), {});
  assert.equal(toUpdateProfileRequest({ fullName: " An ", phone: "  " }).phone, null);
});

test("each internal portal links its profile in the navigation", () => {
  for (const [portal, href] of [["admin", "/admin/profile"], ["manager", "/manager/profile"], ["staff", "/staff/profile"]] as const)
    assert.ok(navFor(portal).some((item) => item.href === href), portal);
});
