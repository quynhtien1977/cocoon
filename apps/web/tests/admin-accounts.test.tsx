import "./dom-setup.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { AccountCreateForm } from "../features/accounts/components/account-create-form";
import { AccountList } from "../features/accounts/components/account-list";
import { toCreateAccountRequest, validateAccountDraft } from "../features/accounts/schemas";
import type { AccountListItem } from "../features/accounts/types";

type Respond = (url: string, init?: RequestInit) => Response;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const realFetch = globalThis.fetch;
let requests: { url: string; method: string; body: unknown }[] = [];
function stubFetch(respond: Respond) {
  requests = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    requests.push({ url, method: init?.method ?? "GET", body: init?.body ? JSON.parse(init.body as string) : undefined });
    return respond(url, init);
  }) as typeof fetch;
}
const sent = () => requests.map(({ method, url, body }) => [method, url, body]);

const accountRows: AccountListItem[] = [
  { id: 1, fullName: "Nguyễn Quản Trị", email: "admin@cocoon.test", phone: null, role: "Admin", status: "Active", lastLoginAt: "2026-10-29T03:45:00Z" },
  { id: 2, fullName: "Trần Quản Lý", email: "manager@cocoon.test", phone: "0900 000 102", role: "Manager", status: "Active", lastLoginAt: null },
  { id: 3, fullName: "Lê Nhân Viên", email: "staff1@cocoon.test", phone: "0900 000 103", role: "Staff", status: "Active", lastLoginAt: "2026-10-28T09:30:00Z" },
  { id: 4, fullName: "Võ Nhân Viên", email: "staff2@cocoon.test", phone: null, role: "Staff", status: "Locked", lastLoginAt: null },
  { id: 5, fullName: "Phạm Khách Hàng", email: "customer@cocoon.test", phone: null, role: "Customer", status: "Active", lastLoginAt: null },
];
const listPage = () => json({ items: accountRows, totalCount: accountRows.length, page: 1, pageSize: 100 });
/** GET returns the list; every write succeeds with 204. */
const api: Respond = (_url, init) => (init?.method ?? "GET") === "GET" ? listPage() : new Response(null, { status: 204 });
const listRequest = ["GET", "/api/v1/admin/accounts?page=1&pageSize=100", undefined];

beforeEach(() => window.history.replaceState(null, "", "/"));
afterEach(() => { cleanup(); globalThis.fetch = realFetch; });

const renderList = (search = "size=50") => render(<SearchParamsContext.Provider value={new URLSearchParams(search)}><AccountList /></SearchParamsContext.Provider>);
const list = (search?: string) => { renderList(search); return screen.findByRole("table", { name: /Tài khoản/ }); };
// hidden: an open dialog marks the page behind it aria-hidden.
const rowOf = (name: string) => within(screen.getByRole("table", { name: /Tài khoản/, hidden: true })).getByText(name).closest("tr")!;

test("A1 loads accounts from the API, filters by role from the URL and links to A2", async () => {
  stubFetch(api);
  const table = await list("filter.role=Staff&size=50");
  assert.deepEqual(sent(), [listRequest]);
  assert.equal(within(table).getAllByRole("row").length - 1, accountRows.filter((row) => row.role === "Staff").length);
  assert.equal(screen.getByRole("link", { name: "Tạo tài khoản mới" }).getAttribute("href"), "/admin/accounts/new");
});

test("A1 shows a retry when the list fails to load", async () => {
  let fail = true;
  stubFetch(() => fail ? json({ detail: "Lỗi máy chủ" }, 500) : listPage());
  renderList();
  assert.ok(await screen.findByText(/Chưa tải được danh sách tài khoản/));
  fail = false;
  await userEvent.setup().click(screen.getByRole("button", { name: "Thử lại" }));
  assert.ok(await screen.findByRole("table", { name: /Tài khoản/ }));
});

test("A1 changes role only after confirmation", async () => {
  stubFetch(api);
  const user = userEvent.setup();
  await list();
  const account = accountRows.find((row) => row.role === "Staff")!;
  await user.click(within(rowOf(account.fullName)).getByRole("button", { name: `Đổi vai trò ${account.fullName}` }));
  const dialog = await screen.findByRole("alertdialog");
  await user.selectOptions(within(dialog).getByLabelText("Vai trò"), "Manager");
  assert.ok(within(rowOf(account.fullName)).getByText("Nhân viên"), "unchanged until confirmed");
  assert.deepEqual(sent(), [listRequest], "nothing sent before confirming");
  await user.click(within(dialog).getByRole("button", { name: "Lưu vai trò" }));
  assert.ok(await within(rowOf(account.fullName)).findByText("Quản lý"));
  assert.deepEqual(sent().slice(1), [["PATCH", `/api/v1/admin/accounts/${account.id}/role`, { role: 1 }]]);
});

test("A1 keeps the row and shows the API message when a change is refused", async () => {
  const admin = accountRows.find((row) => row.role === "Admin")!;
  stubFetch((_url, init) => (init?.method ?? "GET") === "GET" ? listPage() : json({ detail: "Không thể tự khóa tài khoản.", code: "SELF_MODIFICATION_FORBIDDEN" }, 409));
  const user = userEvent.setup();
  await list();
  await user.click(within(rowOf(admin.fullName)).getByRole("button", { name: `Khóa ${admin.fullName}` }));
  await user.click(await screen.findByRole("button", { name: "Khóa tài khoản" }));
  assert.ok(await screen.findByText("Không thể tự khóa tài khoản."));
  assert.ok(screen.getByRole("alertdialog"), "dialog stays open");
  assert.ok(within(rowOf(admin.fullName)).getByText("Hoạt động"));
  assert.deepEqual(sent().slice(1), [["PATCH", `/api/v1/admin/accounts/${admin.id}/status`, { isActive: false }]]);
});

test("A1 locks, unlocks and deletes through ConfirmDialog; cancel changes nothing", async () => {
  stubFetch(api);
  const user = userEvent.setup();
  await list();
  const account = accountRows.find((row) => row.role === "Staff" && row.status === "Active")!;
  const lock = () => within(rowOf(account.fullName)).getByRole("button", { name: `Khóa ${account.fullName}` });
  await user.click(lock());
  await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Hủy" }));
  assert.ok(within(rowOf(account.fullName)).getByText("Hoạt động"));
  assert.deepEqual(sent(), [listRequest], "cancel sends nothing");
  await user.click(lock());
  await user.click(await screen.findByRole("button", { name: "Khóa tài khoản" }));
  assert.ok(await within(rowOf(account.fullName)).findByText("Đã khóa"));
  await user.click(within(rowOf(account.fullName)).getByRole("button", { name: `Mở khóa ${account.fullName}` }));
  await user.click(await screen.findByRole("button", { name: "Mở khóa" }));
  assert.ok(await within(rowOf(account.fullName)).findByText("Hoạt động"));
  await user.click(within(rowOf(account.fullName)).getByRole("button", { name: `Xóa ${account.fullName}` }));
  await user.click(await screen.findByRole("button", { name: "Xóa tài khoản" }));
  await waitFor(() => assert.equal(within(screen.getByRole("table", { name: /Tài khoản/ })).queryByText(account.fullName), null));
  assert.deepEqual(sent().slice(1), [
    ["PATCH", `/api/v1/admin/accounts/${account.id}/status`, { isActive: false }],
    ["PATCH", `/api/v1/admin/accounts/${account.id}/status`, { isActive: true }],
    ["DELETE", `/api/v1/admin/accounts/${account.id}`, undefined],
  ]);
});

test("A2 reports missing fields, follows the role summary and creates the account", async () => {
  stubFetch(() => json({ id: 42, email: "an@cocoon.demo", role: "Admin", temporaryPassword: "Coc!TEMP9a", mustChangePassword: true }, 201));
  const user = userEvent.setup();
  render(<AccountCreateForm />);
  await user.click(screen.getByRole("button", { name: "Tạo tài khoản" }));
  assert.ok(screen.getByText("Nhập họ và tên."));
  assert.ok(screen.getByText("Nhập email đăng nhập."));
  assert.equal(screen.getByLabelText(/Họ và tên/).getAttribute("aria-invalid"), "true");
  assert.deepEqual(sent(), [], "invalid form sends nothing");
  await user.selectOptions(screen.getByLabelText(/Phân quyền vai trò/), "Admin");
  assert.ok(screen.getByText("Đặc quyền vai trò: Quản trị viên"));
  await user.type(screen.getByLabelText(/Họ và tên/), "Nguyễn Văn An");
  await user.type(screen.getByLabelText(/Email đăng nhập/), "an@cocoon.demo");
  await user.click(screen.getByRole("button", { name: "Tạo tài khoản" }));
  assert.ok(await screen.findByText(/Đã tạo tài khoản an@cocoon.demo/));
  assert.equal(screen.queryByText("Coc!TEMP9a"), null, "temporary password is masked until revealed");
  await user.click(screen.getByRole("button", { name: "Hiện" }));
  assert.ok(screen.getByText("Coc!TEMP9a"));
  assert.equal((screen.getByLabelText(/Email đăng nhập/) as HTMLInputElement).value, "");
  assert.deepEqual(sent(), [["POST", "/api/v1/admin/accounts", { email: "an@cocoon.demo", fullName: "Nguyễn Văn An", role: 0, phone: null }]]);
});

test("A2 shows EMAIL_TAKEN next to the email field and keeps the draft", async () => {
  stubFetch(() => json({ detail: "Email này đã được sử dụng.", code: "EMAIL_TAKEN", errors: { email: ["Email này đã được sử dụng."] } }, 409));
  const user = userEvent.setup();
  render(<AccountCreateForm />);
  await user.type(screen.getByLabelText(/Họ và tên/), "Nguyễn Văn An");
  await user.type(screen.getByLabelText(/Email đăng nhập/), "an@cocoon.demo");
  await user.click(screen.getByRole("button", { name: "Tạo tài khoản" }));
  assert.ok(await screen.findByText("Email này đã được sử dụng."));
  assert.equal(screen.getByLabelText(/Email đăng nhập/).getAttribute("aria-invalid"), "true");
  assert.equal((screen.getByLabelText(/Email đăng nhập/) as HTMLInputElement).value, "an@cocoon.demo");
  assert.equal(screen.queryByText(/Đã tạo tài khoản/), null);
});

test("account draft maps to CreateAccountRequest with API role ordinals", () => {
  assert.equal(validateAccountDraft({ fullName: "A", email: "khong-hop-le", phone: "", role: "Staff" }).email, "Email không hợp lệ.");
  assert.equal(validateAccountDraft({ fullName: "A", email: "a@b.vn", phone: " ", role: "Manager" }).phone, "Quản lý cần có số điện thoại.");
  assert.deepEqual(validateAccountDraft({ fullName: "A", email: "a@b.vn", phone: "", role: "Staff" }), {});
  assert.deepEqual(toCreateAccountRequest({ fullName: " Nguyễn An ", email: " an@cocoon.demo ", phone: " 0912 345 678 ", role: "Manager" }), { email: "an@cocoon.demo", fullName: "Nguyễn An", role: 1, phone: "0912 345 678" });
  assert.equal(toCreateAccountRequest({ fullName: "A", email: "a@b.vn", phone: "", role: "Admin" }).phone, null);
  assert.equal(toCreateAccountRequest({ fullName: "A", email: "a@b.vn", phone: "", role: "Customer" }).role, 3);
});
