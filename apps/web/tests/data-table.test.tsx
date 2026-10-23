import "./dom-setup.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { useEffect, useState } from "react";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { DataTable, type DataTableProps } from "../components/data/data-table";

const originalPush = window.history.pushState.bind(window.history);
const originalReplace = window.history.replaceState.bind(window.history);
beforeEach(() => {
  originalReplace(null, "", "/?tab=customers#results");
  // Next's router emits a new search-params context on native history changes.
  for (const [method, original] of [["pushState", originalPush], ["replaceState", originalReplace]] as const) {
    window.history[method] = (...args) => { original(...args); window.dispatchEvent(new window.Event("popstate")); };
  }
});
afterEach(() => { cleanup(); window.history.pushState = originalPush; window.history.replaceState = originalReplace; });

type Row = { id: number; name: string; active: boolean };
const rows = Array.from({ length: 24 }, (_, index) => ({ id: index + 1, name: index === 0 ? "Đặng Ánh" : `Khách ${index + 1}`, active: index % 2 === 0 }));
const props: DataTableProps<Row> = {
  data: rows, caption: "Khách hàng", getRowId: (row) => row.id,
  columns: [{ id: "name", header: "Họ tên", value: (row) => row.name, sortable: true }, { id: "id", header: "Mã", value: (row) => row.id, sortable: true, searchable: false }],
  filters: [{ id: "active", label: "Trạng thái", options: [{ value: "yes", label: "Hoạt động" }], matches: (row) => row.active }],
};
function Harness({ tableProps = props }: { tableProps?: DataTableProps<Row> }) {
  const [search, setSearch] = useState(window.location.search);
  useEffect(() => { const update = () => setSearch(window.location.search); window.addEventListener("popstate", update); return () => window.removeEventListener("popstate", update); }, []);
  return <SearchParamsContext.Provider value={new URLSearchParams(search)}><DataTable {...tableProps} /></SearchParamsContext.Provider>;
}

test("search ignores Vietnamese accents, updates URL and retains unrelated query/hash", async () => {
  render(<Harness />);
  await userEvent.setup().type(screen.getByRole("searchbox", { name: "Tìm kiếm" }), "dang anh");
  assert.equal(screen.getAllByRole("row").length, 2);
  assert.ok(screen.getByText("Đặng Ánh"));
  const params = new URLSearchParams(window.location.search);
  assert.equal(params.get("q"), "dang anh");
  assert.equal(params.get("tab"), "customers");
  assert.equal(window.location.hash, "#results");
});

test("pagination, filter, numeric sort and page size update displayed rows and URL", async () => {
  render(<Harness />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Trang sau" }));
  assert.equal(new URLSearchParams(window.location.search).get("page"), "2");
  assert.ok(screen.getByText("Khách 11"));
  await user.selectOptions(screen.getByRole("combobox", { name: "Trạng thái" }), "yes");
  assert.equal(new URLSearchParams(window.location.search).get("page"), "1");
  await user.click(screen.getByRole("button", { name: "Mã" }));
  await user.click(screen.getByRole("button", { name: "Mã" }));
  assert.equal(within(screen.getAllByRole("row")[1]).getAllByRole("cell")[1].textContent, "23");
  assert.equal(screen.getByRole("columnheader", { name: "Mã" }).getAttribute("aria-sort"), "descending");
  await user.selectOptions(screen.getByRole("combobox", { name: "Số dòng mỗi trang" }), "20");
  assert.equal(screen.getAllByRole("row").length, 13);
});

test("out-of-range deep links are corrected after data is available", async () => {
  originalReplace(null, "", "/?page=999&tab=customers");
  render(<Harness />);
  await waitFor(() => assert.equal(new URLSearchParams(window.location.search).get("page"), "3"));
  assert.ok(screen.getByText("Khách 24"));
});

test("Back and Forward restore table pagination", async () => {
  render(<Harness />);
  await userEvent.setup().click(screen.getByRole("button", { name: "Trang sau" }));
  await act(async () => { window.history.back(); await new Promise((resolve) => window.setTimeout(resolve, 30)); });
  await waitFor(() => assert.ok(screen.getByText("Đặng Ánh")));
  await act(async () => { window.history.forward(); await new Promise((resolve) => window.setTimeout(resolve, 30)); });
  await waitFor(() => assert.ok(screen.getByText("Khách 11")));
});

test("loading, empty and retry states are accessible", async () => {
  let retried = false;
  const { rerender } = render(<Harness tableProps={{ ...props, loading: true }} />);
  assert.ok(screen.getByRole("status"));
  assert.equal(screen.queryByRole("table"), null);
  rerender(<Harness tableProps={{ ...props, error: "Không thể tải dữ liệu", onRetry: () => { retried = true; } }} />);
  assert.ok(screen.getByRole("alert"));
  await userEvent.setup().click(screen.getByRole("button", { name: "Thử lại" }));
  assert.equal(retried, true);
  rerender(<Harness tableProps={{ ...props, data: [] }} />);
  assert.ok(screen.getByRole("heading", { name: "Không có dữ liệu" }));
});
