import "./dom-setup.mjs";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ProfilePage } from "../features/customer/profile-page";

const originalFetch = globalThis.fetch;
afterEach(() => { cleanup(); globalThis.fetch = originalFetch; });
const initial = { fullName: "Nguyễn An", email: "an@example.com", phone: null, dateOfBirth: null, gender: null, address: null, consentPersonalData: true };

function fixture(write: (url: string, body: unknown) => Promise<Response> = async () => new Response(null, { status: 204 })) {
  globalThis.fetch = async (input, options) => {
    const url = String(input);
    if (options?.method === "PUT") return write(url, JSON.parse(options.body as string));
    if (url.endsWith("/me/preferences")) return Response.json({ preferenceIds: [42] });
    if (url.endsWith("/preferences")) return Response.json([{ id: 42, name: "Dry Skin" }, { id: 50, name: "Facial Care" }]);
    return Response.json(initial);
  };
}

test("registered information pre-fills the two forms; undo and independent saves preserve the other draft", async () => {
  const writes: { url: string; body: unknown }[] = [];
  fixture(async (url, body) => { writes.push({ url, body }); return new Response(null, { status: 204 }); });
  render(<ProfilePage />);
  const name = await screen.findByLabelText(/Họ và tên/);
  assert.equal((name as HTMLInputElement).value, "Nguyễn An");
  assert.equal((screen.getByLabelText("Email đăng ký") as HTMLInputElement).readOnly, true);
  await screen.findByRole("button", { name: "Lưu sở thích" });
  fireEvent.change(name, { target: { value: "Tên mới" } });
  fireEvent.click(screen.getByRole("button", { name: "Hoàn tác thông tin" }));
  assert.equal((name as HTMLInputElement).value, "Nguyễn An");
  fireEvent.change(name, { target: { value: "Tên mới" } });
  fireEvent.click(screen.getByRole("button", { name: "Bỏ tất cả sở thích" }));
  fireEvent.click(screen.getByRole("button", { name: "Lưu thông tin" }));
  await screen.findByText("Đã lưu thông tin cá nhân.");
  assert.equal(writes.length, 1);
  assert.equal(writes[0].url, "/api/v1/me");
  assert.equal((writes[0].body as typeof initial).fullName, "Tên mới");
  fireEvent.click(screen.getByRole("button", { name: "Lưu sở thích" }));
  await screen.findByText("Đã lưu sở thích.");
  assert.deepEqual(writes[1], { url: "/api/v1/me/preferences", body: { preferenceIds: [] } });
});

test("failed save retains edits and never displays success; retry can save", async () => {
  let status = 501;
  fixture(async () => status === 501 ? Response.json({}, { status }) : new Response(null, { status }));
  render(<ProfilePage />);
  const name = await screen.findByLabelText(/Họ và tên/);
  fireEvent.change(name, { target: { value: "Bản đang sửa" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu thông tin" }));
  await screen.findByRole("alert");
  assert.equal((name as HTMLInputElement).value, "Bản đang sửa");
  assert.equal(screen.queryByText("Đã lưu thông tin cá nhân."), null);
  status = 204;
  fireEvent.click(screen.getByRole("button", { name: "Lưu thông tin" }));
  await screen.findByText("Đã lưu thông tin cá nhân.");
});

test("unavailable preferences do not prevent personal edits or submit an empty preference list", async () => {
  globalThis.fetch = async input => String(input).endsWith("/me") ? Response.json(initial) : Response.json({}, { status: 501 });
  render(<ProfilePage />);
  await screen.findByLabelText(/Họ và tên/);
  const preferences = screen.getByRole("region", { name: "Sở thích của bạn" });
  await within(preferences).findByRole("alert");
  assert.equal(within(preferences).queryByRole("button", { name: "Lưu sở thích" }), null);
  assert.ok(within(preferences).getByRole("button", { name: "Thử lại" }));
});

test("validation focuses the first invalid field and repeated submit sends only one request", async () => {
  let writes = 0;
  let finish!: () => void;
  fixture(async () => { writes++; await new Promise<void>(resolve => { finish = resolve; }); return new Response(null, { status: 204 }); });
  render(<ProfilePage />);
  const name = await screen.findByLabelText(/Họ và tên/);
  fireEvent.change(name, { target: { value: " " } });
  const form = screen.getByRole("form", { name: "Chỉnh sửa thông tin cá nhân" });
  fireEvent.submit(form);
  assert.equal(writes, 0);
  assert.equal(document.activeElement, name);
  fireEvent.change(name, { target: { value: "Đã đổi" } });
  fireEvent.submit(form);
  fireEvent.submit(form);
  assert.equal(writes, 1);
  finish();
  await waitFor(() => assert.ok(screen.getByText("Đã lưu thông tin cá nhân.")));
});
