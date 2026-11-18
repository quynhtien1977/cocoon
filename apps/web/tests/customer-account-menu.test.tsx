import "./dom-setup.mjs";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { ContextType, ReactNode } from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { LandingFrame } from "../features/landing/landing-frame";
import { OrdersPage } from "../features/customer/orders-page";

const originalFetch = globalThis.fetch;

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});

function renderFrame(node: ReactNode, pathname = "/account") {
  globalThis.fetch = async () => Response.json([]);
  const router = {
    back() {},
    forward() {},
    refresh() {},
    push() {},
    replace() {},
    prefetch: async () => {},
  } as unknown as NonNullable<ContextType<typeof AppRouterContext>>;
  return render(
    <AppRouterContext.Provider value={router}>
      <PathnameContext.Provider value={pathname}>{node}</PathnameContext.Provider>
    </AppRouterContext.Provider>,
  );
}

test("guest header keeps the user icon linked to /login without an account menu", () => {
  renderFrame(
    <LandingFrame customer={false}>
      <p>Nội dung</p>
    </LandingFrame>,
    "/",
  );
  const loginLink = screen.getByRole("link", { name: "Đăng nhập tài khoản" });
  assert.equal(loginLink.getAttribute("href"), "/login");
  assert.equal(screen.queryByRole("button", { name: "Tài khoản" }), null);
});

test("customer header account menu lists four links, badge, aria-current, and keyboard controls", async () => {
  const user = userEvent.setup();
  renderFrame(
    <LandingFrame customer pendingSurveyCount={3}>
      <p>Nội dung</p>
    </LandingFrame>,
    "/account/feedback",
  );

  const trigger = screen.getByRole("button", { name: "Tài khoản" });
  trigger.focus();
  await user.keyboard("{Enter}");

  const menu = await screen.findByRole("menu");
  const items = within(menu).getAllByRole("menuitem");
  assert.deepEqual(
    items.map((el) => el.getAttribute("href")),
    ["/account/profile", "/account/orders", "/account/feedback", "/account/surveys"],
  );
  assert.ok(within(menu).getByText("Hồ sơ của bạn"));
  assert.ok(within(menu).getByText("Đơn hàng của bạn"));
  assert.ok(within(menu).getByText("Phản hồi của bạn"));
  assert.ok(within(menu).getByText("Khảo sát dành cho bạn"));
  assert.ok(within(menu).getByText("3"));

  assert.equal(items[2].getAttribute("aria-current"), "page");
  assert.equal(items[0].getAttribute("aria-current"), null);

  await user.keyboard("{ArrowDown}");
  await user.keyboard("{Escape}");
  await waitFor(() => assert.equal(screen.queryByRole("menu"), null));
  assert.equal(document.activeElement, trigger);
});

test("customer mobile sheet menu includes Phản hồi của bạn beside Hồ sơ của bạn", async () => {
  const user = userEvent.setup();
  renderFrame(
    <LandingFrame customer>
      <p>Nội dung</p>
    </LandingFrame>,
    "/account/feedback",
  );

  await user.click(screen.getByRole("button", { name: "Mở menu" }));
  const mobileNav = await screen.findByRole("navigation", { name: "Điều hướng mobile" });
  const profile = within(mobileNav).getByRole("link", { name: "Hồ sơ của bạn" });
  const feedback = within(mobileNav).getByRole("link", { name: "Phản hồi của bạn" });
  assert.equal(profile.getAttribute("href"), "/account/profile");
  assert.equal(feedback.getAttribute("href"), "/account/feedback");
  assert.equal(feedback.getAttribute("aria-current"), "page");
});

test("OrdersPage turns only the reviewed products summary box into a link to /account/feedback", () => {
  render(
    <OrdersPage initialPreview />,
  );

  const feedbackLink = screen.getByRole("link", { name: /sản phẩm đã đánh giá/ });
  assert.equal(feedbackLink.getAttribute("href"), "/account/feedback");
  assert.equal(screen.queryByRole("link", { name: /đơn đã giao/ }), null);
  assert.equal(screen.queryByRole("link", { name: /sản phẩm chờ đánh giá/ }), null);
});
