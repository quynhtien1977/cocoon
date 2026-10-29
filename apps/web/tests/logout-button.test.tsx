import "./dom-setup.mjs";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { act, cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { LogoutButton } from "../features/auth/logout-button";

const originalFetch = globalThis.fetch;
afterEach(() => { cleanup(); globalThis.fetch = originalFetch; });

test("opening and cancelling confirmation never logs the customer out", async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response(null, { status: 204 }); };
  render(<LogoutButton />);
  fireEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));
  const dialog = await screen.findByRole("alertdialog");
  assert.equal(calls, 0);
  fireEvent.click(within(dialog).getByRole("button", { name: "Hủy" }));
  await waitFor(() => assert.equal(screen.queryByRole("alertdialog"), null));
  assert.equal(calls, 0);
});

test("logout prevents duplicate requests and allows retry after an API failure", async () => {
  let calls = 0;
  let finish!: (response: Response) => void;
  globalThis.fetch = async () => {
    calls++;
    return new Promise<Response>(resolve => { finish = resolve; });
  };
  render(<LogoutButton />);
  fireEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));
  const dialog = await screen.findByRole("alertdialog");
  fireEvent.click(within(dialog).getByRole("button", { name: "Đăng xuất" }));
  const pending = screen.getByRole("button", { name: "Đang đăng xuất…" }) as HTMLButtonElement;
  assert.equal(pending.disabled, true);
  assert.equal((within(dialog).getByRole("button", { name: "Đóng hộp thoại" }) as HTMLButtonElement).disabled, true);
  fireEvent.click(pending);
  assert.equal(calls, 1);
  await act(async () => finish(Response.json({}, { status: 500 })));
  assert.ok(await screen.findByRole("alert"));
  assert.equal((within(dialog).getByRole("button", { name: "Đăng xuất" }) as HTMLButtonElement).disabled, false);
  fireEvent.click(within(dialog).getByRole("button", { name: "Đăng xuất" }));
  assert.equal(calls, 2);
  await act(async () => finish(Response.json({}, { status: 500 })));
});

test("soft confirmation close icon dismisses without sending logout", async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response(null, { status: 204 }); };
  render(<LogoutButton />);
  fireEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));
  const dialog = await screen.findByRole("alertdialog");
  assert.ok(within(dialog).getByText("Tài khoản Cocoon"));
  fireEvent.click(within(dialog).getByRole("button", { name: "Đóng hộp thoại" }));
  await waitFor(() => assert.equal(screen.queryByRole("alertdialog"), null));
  assert.equal(calls, 0);
});
