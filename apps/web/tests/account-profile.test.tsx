import "./dom-setup.mjs";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountProfile, staffCode } from "../features/profile/components/account-profile";
import { toUpdateProfileRequest, validatePasswordDraft, validateProfileDraft } from "../features/profile/schemas";
import { navFor } from "../lib/screens";

const realFetch = globalThis.fetch;
let requests: { url: string; method: string; body: unknown }[] = [];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const page = (totalCount: number) => json({ items: [], totalCount, page: 1, pageSize: 1 });
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

test("S3 shows the Stitch layout with live stats and saves name and phone through PUT me", async () => {
  stubFetch((url, method) => {
    if (method === "PUT") return new Response(null, { status: 204 });
    if (url.includes("status=Replied")) return page(5);
    if (url.includes("status=Closed")) return page(2);
    if (url.includes("status=Assigned")) return page(3);
    return json(me());
  });
  const user = userEvent.setup();
  render(<AccountProfile variant="staff" />);
  assert.ok(await screen.findByRole("heading", { name: "Hồ sơ Nhân viên Chăm sóc khách hàng" }));
  const summary = await screen.findByRole("region", { name: "Tóm tắt tài khoản" });
  assert.ok(within(summary).getByText("#STF-0003"));
  assert.ok(await within(summary).findByText("7"), "resolved = replied + closed");
  assert.ok(within(summary).getByText("3"));
  assert.equal(screen.queryByText(/Phân quyền thao tác/), null, "scope box is removed");
  assert.equal(screen.queryByText(/Trạng thái/), null, "status row is removed");
  assert.equal(screen.queryByLabelText("Mật khẩu hiện tại"), null, "no password form without a temporary password");
  assert.equal(screen.getByLabelText("Email nội bộ").hasAttribute("readonly"), true);
  await user.clear(screen.getByLabelText("Họ và tên"));
  await user.type(screen.getByLabelText("Họ và tên"), "  Nguyễn An  ");
  await user.type(screen.getByLabelText("Số điện thoại liên lạc"), "0912 345 678");
  await user.click(screen.getByRole("button", { name: "Lưu thông tin hồ sơ" }));
  assert.ok(await screen.findByText("Đã lưu thông tin hồ sơ."));
  const put = requests.find((item) => item.method === "PUT")!;
  assert.equal(put.url, "/api/v1/me");
  assert.deepEqual(put.body, { fullName: "Nguyễn An", phone: "0912 345 678", dateOfBirth: null, gender: null, address: null, consentPersonalData: false });
  assert.ok(within(summary).getByText("Nguyễn An"), "summary card follows the saved name");
});

test("M15 uses manager copy and counts closed feedback and open surveys", async () => {
  stubFetch((url) => url.includes("/feedback?status=Closed") ? page(42) : url.includes("/surveys?status=Open") ? page(4) : json(me({ id: 2, role: "Manager", email: "manager@cocoon.demo" })));
  render(<AccountProfile variant="manager" />);
  assert.ok(await screen.findByRole("heading", { name: "Hồ sơ Quản lý CRM" }));
  assert.equal((screen.getByLabelText("Mã quản lý") as HTMLInputElement).value, "MGR-0002");
  assert.ok(await screen.findByText("42"));
  assert.ok(screen.getByText("Khảo sát đang mở"));
  assert.ok(screen.getByRole("button", { name: "Cập nhật hồ sơ" }));
});

test("profile reports invalid fields and an unchanged form without calling the API", async () => {
  stubFetch((url) => url.includes("/staff/") ? page(0) : json(me()));
  const user = userEvent.setup();
  render(<AccountProfile variant="staff" />);
  await screen.findByLabelText("Họ và tên");
  await user.click(screen.getByRole("button", { name: "Lưu thông tin hồ sơ" }));
  assert.match(screen.getByRole("alert").textContent ?? "", /Chưa có thay đổi/);
  await user.clear(screen.getByLabelText("Họ và tên"));
  await user.type(screen.getByLabelText("Số điện thoại liên lạc"), "12");
  await user.click(screen.getByRole("button", { name: "Lưu thông tin hồ sơ" }));
  assert.ok(screen.getByText("Nhập họ và tên."));
  assert.ok(screen.getByText("Nhập số điện thoại hợp lệ (8–15 chữ số)."));
  assert.equal(requests.filter((item) => item.method === "PUT").length, 0);
});

test("A4 shows last login, and a temporary password unlocks the change form", async () => {
  let attempt = 0;
  stubFetch((url) => {
    if (url.includes("/admin/accounts")) return json({ items: [{ id: 1, lastLoginAt: "2026-11-07T01:30:00Z" }], totalCount: 1, page: 1, pageSize: 20 });
    if (!url.endsWith("/change-password")) return json(me({ id: 1, role: "Admin", email: "admin@cocoon.demo", mustChangePassword: true }));
    attempt++;
    return attempt === 1
      ? json({ detail: "Mật khẩu hiện tại không đúng.", code: "INVALID_CURRENT_PASSWORD", errors: { currentPassword: ["Mật khẩu hiện tại không đúng."] } }, 400)
      : new Response(null, { status: 204 });
  });
  const user = userEvent.setup();
  render(<AccountProfile variant="admin" />);
  assert.match((await screen.findByRole("alert")).textContent ?? "", /mật khẩu tạm/);
  assert.ok(await screen.findByText(/08:30.*07\/11\/2026|07\/11\/2026.*08:30/));
  await user.type(screen.getByLabelText("Mật khẩu hiện tại"), "Sai@12345");
  await user.type(screen.getByLabelText("Mật khẩu mới"), "MoiHon2026");
  await user.type(screen.getByLabelText("Nhập lại mật khẩu mới"), "MoiHon2026");
  await user.click(screen.getByRole("button", { name: "Đổi mật khẩu" }));
  assert.ok(await screen.findByText("Mật khẩu hiện tại không đúng."));
  await user.click(screen.getByRole("button", { name: "Đổi mật khẩu" }));
  assert.equal((await screen.findByRole("link", { name: "Đăng nhập lại" })).getAttribute("href"), "/admin/login");
  assert.deepEqual(requests.find((item) => item.url.endsWith("/change-password"))!.body, { currentPassword: "Sai@12345", newPassword: "MoiHon2026" });
});

test("stats that fail to load show a dash instead of blocking the page", async () => {
  stubFetch((url) => url.includes("/staff/") ? json({}, 500) : json(me()));
  render(<AccountProfile variant="staff" />);
  const summary = await screen.findByRole("region", { name: "Tóm tắt tài khoản" });
  assert.equal(within(summary).getAllByText("—").length, 2);
  assert.ok(screen.getByLabelText("Họ và tên"));
});

test("profile load failure offers a retry", async () => {
  stubFetch(() => json({}, 500));
  const user = userEvent.setup();
  render(<AccountProfile variant="manager" />);
  assert.ok(await screen.findByText("Chưa tải được hồ sơ."));
  stubFetch((url) => url.includes("status=") ? page(0) : json(me({ role: "Manager" })));
  await user.click(screen.getByRole("button", { name: "Thử lại" }));
  assert.ok(await screen.findByLabelText("Mã quản lý"));
});

test("validation mirrors the API's password and profile rules", () => {
  const ok = { currentPassword: "Cu@12345", newPassword: "MoiHon2026", confirmPassword: "MoiHon2026" };
  assert.deepEqual(validatePasswordDraft(ok), {});
  assert.equal(validatePasswordDraft({ ...ok, newPassword: "chicochu", confirmPassword: "chicochu" }).newPassword, "Mật khẩu cần 8–128 ký tự, có chữ và số.");
  assert.equal(validatePasswordDraft({ ...ok, newPassword: ok.currentPassword, confirmPassword: ok.currentPassword }).newPassword, "Mật khẩu mới phải khác mật khẩu hiện tại.");
  assert.equal(validatePasswordDraft({ ...ok, confirmPassword: "khac1234" }).confirmPassword, "Mật khẩu nhập lại không khớp.");
  assert.deepEqual(validateProfileDraft({ fullName: "An", phone: "" }), {});
  assert.equal(toUpdateProfileRequest({ fullName: " An ", phone: "  " }).phone, null);
  assert.equal(staffCode("ADM", 1), "ADM-0001");
});

test("each internal portal links its profile in the navigation", () => {
  for (const [portal, href] of [["admin", "/admin/profile"], ["manager", "/manager/profile"], ["staff", "/staff/profile"]] as const)
    assert.ok(navFor(portal).some((item) => item.href === href), portal);
});
