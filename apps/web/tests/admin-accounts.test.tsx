import "./dom-setup.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { accountsFixture } from "../features/accounts/accounts.fixture";
import { AccountCreateForm } from "../features/accounts/components/account-create-form";
import { AccountList } from "../features/accounts/components/account-list";
import { toCreateAccountRequest, validateAccountDraft } from "../features/accounts/schemas";

beforeEach(() => window.history.replaceState(null, "", "/"));
afterEach(cleanup);

const list = (search = "size=50") => render(<SearchParamsContext.Provider value={new URLSearchParams(search)}><AccountList /></SearchParamsContext.Provider>);
// hidden: an open dialog marks the page behind it aria-hidden.
const rowOf = (name: string) => within(screen.getByRole("table", { name: /Tài khoản/, hidden: true })).getByText(name).closest("tr")!;

test("A1 filters by role from the URL and links to A2", () => {
  list("filter.role=Staff&size=50");
  const staff = accountsFixture.filter((row) => row.role === "Staff");
  assert.equal(within(screen.getByRole("table", { name: /Tài khoản/ })).getAllByRole("row").length - 1, staff.length);
  assert.equal(screen.getByRole("link", { name: "Tạo tài khoản mới" }).getAttribute("href"), "/admin/accounts/new");
});

test("A1 changes role only after confirmation", async () => {
  const user = userEvent.setup();
  list();
  const account = accountsFixture.find((row) => row.role === "Staff")!;
  await user.click(within(rowOf(account.fullName)).getByRole("button", { name: `Đổi vai trò ${account.fullName}` }));
  const dialog = await screen.findByRole("alertdialog");
  await user.selectOptions(within(dialog).getByLabelText("Vai trò"), "Manager");
  assert.ok(within(rowOf(account.fullName)).getByText("Nhân viên"), "unchanged until confirmed");
  await user.click(within(dialog).getByRole("button", { name: "Lưu vai trò" }));
  assert.ok(within(rowOf(account.fullName)).getByText("Quản lý"));
});

test("A1 locks, unlocks and deletes through ConfirmDialog; cancel changes nothing", async () => {
  const user = userEvent.setup();
  list();
  const account = accountsFixture.find((row) => row.status === "Active")!;
  const lock = () => within(rowOf(account.fullName)).getByRole("button", { name: `Khóa ${account.fullName}` });
  await user.click(lock());
  await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Hủy" }));
  assert.ok(within(rowOf(account.fullName)).getByText("Hoạt động"));
  await user.click(lock());
  await user.click(await screen.findByRole("button", { name: "Khóa tài khoản" }));
  assert.ok(within(rowOf(account.fullName)).getByText("Đã khóa"));
  await user.click(within(rowOf(account.fullName)).getByRole("button", { name: `Mở khóa ${account.fullName}` }));
  await user.click(await screen.findByRole("button", { name: "Mở khóa" }));
  assert.ok(within(rowOf(account.fullName)).getByText("Hoạt động"));
  await user.click(within(rowOf(account.fullName)).getByRole("button", { name: `Xóa ${account.fullName}` }));
  await user.click(await screen.findByRole("button", { name: "Xóa tài khoản" }));
  assert.equal(within(screen.getByRole("table", { name: /Tài khoản/ })).queryByText(account.fullName), null);
});

test("A2 reports missing fields, follows the role summary and confirms creation", async () => {
  const user = userEvent.setup();
  render(<AccountCreateForm />);
  await user.click(screen.getByRole("button", { name: "Tạo tài khoản" }));
  assert.ok(screen.getByText("Nhập họ và tên."));
  assert.ok(screen.getByText("Nhập email đăng nhập."));
  assert.equal(screen.getByLabelText(/Họ và tên/).getAttribute("aria-invalid"), "true");
  await user.selectOptions(screen.getByLabelText(/Phân quyền vai trò/), "Admin");
  assert.ok(screen.getByText("Đặc quyền vai trò: Quản trị viên"));
  await user.type(screen.getByLabelText(/Họ và tên/), "Nguyễn Văn An");
  await user.type(screen.getByLabelText(/Email đăng nhập/), "an@cocoon.demo");
  await user.click(screen.getByRole("button", { name: "Tạo tài khoản" }));
  assert.ok(screen.getByText(/Đã tạo tài khoản an@cocoon.demo/));
  assert.equal((screen.getByLabelText(/Email đăng nhập/) as HTMLInputElement).value, "");
});

test("account draft maps to CreateAccountRequest with API role ordinals", () => {
  assert.equal(validateAccountDraft({ fullName: "A", email: "khong-hop-le", role: "Staff" }).email, "Email không hợp lệ.");
  assert.deepEqual(toCreateAccountRequest({ fullName: " Nguyễn An ", email: " an@cocoon.demo ", role: "Manager" }), { email: "an@cocoon.demo", fullName: "Nguyễn An", role: 1 });
  assert.equal(toCreateAccountRequest({ fullName: "A", email: "a@b.vn", role: "Admin" }).role, 0);
  assert.equal(toCreateAccountRequest({ fullName: "A", email: "a@b.vn", role: "Customer" }).role, 3);
});
