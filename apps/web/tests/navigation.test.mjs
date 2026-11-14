import assert from "node:assert/strict";
import test from "node:test";
import { isNavActive } from "../lib/navigation.ts";
import { navFor } from "../lib/screens.ts";

test("portal home links do not stay selected on child pages", () => {
  for (const href of ["/", "/account", "/manager", "/admin"]) {
    assert.equal(isNavActive(href, { href, exact: true }), true);
    assert.equal(isNavActive(`${href === "/" ? "" : href}/other`, { href, exact: true }), false);
  }
});

test("section links stay selected on detail and form routes", () => {
  const item = { href: "/manager/surveys" };
  for (const path of [item.href, `${item.href}/new`, `${item.href}/sample/edit`]) {
    assert.equal(isNavActive(path, item), true);
  }
});

test("similar prefixes and other portals do not select the link", () => {
  const item = { href: "/account/feedback" };
  for (const path of ["/account/feedback-old", "/manager/feedback", "/account"]) {
    assert.equal(isNavActive(path, item), false);
  }
});

test("portal navigation selects only the relevant section", () => {
  for (const [portal, path, expected] of [
    ["customer", "/account/feedback/new", "C3"],
    ["manager", "/manager/surveys/example/edit", "M7"],
    ["staff", "/staff/feedback/example", "S1"],
    ["admin", "/admin/accounts/new", "A2"],
    ["admin", "/admin/activity", "A3"],
  ]) {
    const items = navFor(portal);
    assert.ok(items.every((item) => item.portal === portal));
    assert.deepEqual(items.filter((item) => isNavActive(path, item)).map((item) => item.code), [expected]);
  }
});
