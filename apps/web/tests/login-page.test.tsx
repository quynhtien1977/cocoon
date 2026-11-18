import "./dom-setup.mjs";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { ContextType } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { LoginPage } from "../features/auth/login-page";

// The page reads the form with new FormData(form); Node's own FormData rejects jsdom forms.
globalThis.FormData = window.FormData as unknown as typeof FormData;
const realFetch = globalThis.fetch;
const realCredentials = Object.getOwnPropertyDescriptor(window.navigator, "credentials");
afterEach(() => {
  cleanup();
  globalThis.fetch = realFetch;
  delete (window as unknown as { PasswordCredential?: unknown }).PasswordCredential;
  if (realCredentials) Object.defineProperty(window.navigator, "credentials", realCredentials);
  else delete (window.navigator as unknown as { credentials?: unknown }).credentials;
});

/** Stubs the API sign-in and the browser password manager; returns what was offered for saving. */
function setup() {
  const stored: { id: string; password: string }[] = [], destinations: string[] = [];
  globalThis.fetch = (async (url: string) => new Response(JSON.stringify(url.endsWith("/me") ? { role: "Manager" } : {}), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;
  (window as unknown as { PasswordCredential: unknown }).PasswordCredential = class { constructor(public data: { id: string; password: string }) {} };
  Object.defineProperty(window.navigator, "credentials", { configurable: true, value: { store: async (credential: { data: { id: string; password: string } }) => { stored.push({ id: credential.data.id, password: credential.data.password }); return credential; } } });
  const router = { push() {}, prefetch: async () => {}, replace: (href: string) => destinations.push(href), back() {}, forward() {}, refresh() {}, hmrRefresh() {} } as unknown as NonNullable<ContextType<typeof AppRouterContext>>;
  render(<AppRouterContext.Provider value={router}><LoginPage /></AppRouterContext.Provider>);
  return { stored, destinations };
}

async function signIn(remember: boolean) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email"), "manager@cocoon.demo");
  await user.type(screen.getByLabelText("Mật khẩu"), "Demo@12345");
  if (remember) await user.click(screen.getByRole("checkbox", { name: "Ghi nhớ đăng nhập" }));
  await user.click(screen.getByRole("button", { name: "ĐĂNG NHẬP" }));
}

test("ticking remember hands email and password to the browser password manager", async () => {
  const { stored, destinations } = setup();
  await signIn(true);
  await waitFor(() => assert.deepEqual(destinations, ["/manager"]));
  assert.deepEqual(stored, [{ id: "manager@cocoon.demo", password: "Demo@12345" }]);
});

test("without remember nothing is offered to the password manager", async () => {
  const { stored, destinations } = setup();
  await signIn(false);
  await waitFor(() => assert.deepEqual(destinations, ["/manager"]));
  assert.deepEqual(stored, []);
});
