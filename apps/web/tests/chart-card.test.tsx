import "./dom-setup.mjs";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChartCard, chartColor } from "../components/data/chart-card";

afterEach(cleanup);

type Row = { week: string; feedback: number; lowRating: number };
const rows: Row[] = [{ week: "Tuần 1", feedback: 1200, lowRating: 3 }, { week: "Tuần 2", feedback: 45.5, lowRating: 0 }];
const series = [{ key: "feedback" as const, label: "Phản hồi" }, { key: "lowRating" as const, label: "≤ 2 sao" }];

test("colors follow --chart-1…5 in series order and repeat after five", () => {
  assert.deepEqual([0, 1, 4, 5].map(chartColor), ["var(--chart-1)", "var(--chart-2)", "var(--chart-5)", "var(--chart-1)"]);
});

test("renders an accessible data table with Vietnamese number format and hides the SVG", () => {
  const { container } = render(<ChartCard title="Phản hồi theo tuần" type="bar" data={rows} categoryKey="week" categoryLabel="Tuần" series={series} />);
  assert.ok(screen.getByRole("region", { name: "Phản hồi theo tuần" }));
  const table = screen.getByRole("table", { name: "Phản hồi theo tuần" });
  assert.deepEqual(within(table).getAllByRole("columnheader").map((cell) => cell.textContent), ["Tuần", "Phản hồi", "≤ 2 sao"]);
  assert.deepEqual(within(table).getAllByRole("cell").map((cell) => cell.textContent), ["1.200", "3", "45,5", "0"]);
  assert.equal(container.querySelector("[aria-hidden='true']")?.parentElement?.tagName, "SECTION");
});

test("pie table uses only the first series", () => {
  render(<ChartCard title="Giới tính" type="pie" data={rows} categoryKey="week" categoryLabel="Nhóm" series={series} />);
  assert.equal(screen.getAllByRole("columnheader").length, 2);
});

test("loading, empty and error states", async () => {
  const { rerender } = render(<ChartCard title="Biểu đồ" type="line" data={rows} categoryKey="week" categoryLabel="Tuần" series={series} loading />);
  assert.ok(screen.getByRole("status"));
  assert.equal(screen.queryByRole("table"), null);
  rerender(<ChartCard title="Biểu đồ" type="line" data={[]} categoryKey="week" categoryLabel="Tuần" series={series} />);
  assert.ok(screen.getByRole("heading", { name: "Chưa có dữ liệu" }));
  let retried = false;
  rerender(<ChartCard title="Biểu đồ" type="line" data={rows} categoryKey="week" categoryLabel="Tuần" series={series} error="Không tải được" onRetry={() => { retried = true; }} />);
  assert.ok(within(screen.getByRole("alert")).getByText("Không tải được"));
  await userEvent.setup().click(screen.getByRole("button", { name: "Thử lại" }));
  assert.ok(retried);
});
