import "./dom-setup.mjs";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ColorSelect } from "../components/brand/color-select";

afterEach(cleanup);
const options = [{ value: "Active", label: "Đang bán", colorClass: "bg-status-sage-bg" }, { value: "Upcoming", label: "Sắp ra mắt", colorClass: "bg-status-lotus-bg" }];

test("badge select has no arrow and supports keyboard selection", async () => {
  const changes: string[] = [];
  render(<ColorSelect badge label="Trạng thái sản phẩm" value="Active" options={options} onValueChange={value => changes.push(value)} />);
  const trigger = screen.getByRole("combobox", { name: "Trạng thái sản phẩm" });
  assert.equal(trigger.querySelector("svg"), null);
  const user = userEvent.setup();
  await user.click(trigger);
  assert.ok(await screen.findByRole("option", { name: "Sắp ra mắt" }));
  await user.keyboard("{ArrowDown}{Enter}");
  assert.deepEqual(changes, ["Upcoming"]);
});

test("disabled badge cannot open or change while saving", async () => {
  let changed = false;
  render(<ColorSelect badge disabled busy label="Trạng thái sản phẩm" value="Active" options={options} onValueChange={() => { changed = true; }} />);
  await userEvent.setup().click(screen.getByRole("combobox"));
  assert.equal(screen.queryByRole("listbox"), null);
  assert.equal(changed, false);
});
