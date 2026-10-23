import assert from "node:assert/strict";
import test from "node:test";
import { readTableState, updateTableParams } from "../components/data/table-state.ts";

test("table URL rejects invalid pages, sort columns and filter values", () => {
  const state = readTableState(new URLSearchParams("page=-2&size=100000&sort=secret&filter.status=unknown"), "", ["name"], [{ id: "status", options: [{ value: "Active" }] }]);
  assert.equal(state.page, 1);
  assert.equal(state.pageSize, 10);
  assert.equal(state.sort, "");
  assert.equal(state.filters.status, "");
});

test("table updates preserve unrelated params and support multiple tables", () => {
  const result = new URLSearchParams(updateTableParams("tab=orders&other.page=3&grid.page=7", "grid.", { q: "sen & cà phê", page: "1" }));
  assert.equal(result.get("tab"), "orders");
  assert.equal(result.get("other.page"), "3");
  assert.equal(result.get("grid.q"), "sen & cà phê");
  assert.equal(result.get("grid.page"), "1");
});
