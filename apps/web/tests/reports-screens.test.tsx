import "./dom-setup.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DateRangePicker } from "../features/reports/components/date-range-picker";
import { AnalyticsReport } from "../features/reports/components/analytics-report";
import { CustomerReport } from "../features/reports/components/customer-report";
import { ManagerDashboard } from "../features/reports/components/manager-dashboard";
import { filterLabel, presetFilter, presetRange, toReportRange, type ReportFilter } from "../features/reports/date-range";
import { customerSheets, reportFileName, reportSheets } from "../features/reports/export-excel";
import { pageCuts } from "../features/reports/export-pdf";
import type { ActivityReports, CustomerReports } from "../features/reports/types";
import { xlsxBytes, xlsxFiles } from "../lib/xlsx";

beforeEach(() => window.history.replaceState(null, "", "/"));
afterEach(cleanup);

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const realFetch = globalThis.fetch;
let requests: string[] = [];
function stubFetch(respond: (url: string) => Response) {
  requests = [];
  globalThis.fetch = (async (url: string) => { requests.push(url); return respond(url); }) as typeof fetch;
}
afterEach(() => { globalThis.fetch = realFetch; });

// Shapes and numbers taken from the seeded API (ReportContracts.cs); percentages are 0–100, rates 0–1.
const reports: Record<string, unknown> = {
  "/api/v1/reports/overview": { totalCustomers: 82, newCustomers30d: 2, newFeedback: 12, avgRating: 2.74, openSurveys: 1, newCustomersThisMonth: 1, ratingCount: 61, completedResponses: 41 },
  "/api/v1/reports/customers/age": { items: [{ group: "<18", customers: 14, percentage: 17.07 }, { group: "25–34", customers: 16, percentage: 19.51 }, { group: "Chưa cung cấp", customers: 8, percentage: 9.76 }], totalCustomers: 82, asOf: "2026-11-05" },
  "/api/v1/reports/customers/gender": { items: [{ gender: "Nam", customers: 27, percentage: 32.93 }, { gender: "Nữ", customers: 28, percentage: 34.15 }], totalCustomers: 82, asOf: "2026-11-05" },
  "/api/v1/reports/customers/preferences": { items: [{ preferenceId: 8, preference: "Thuần chay", customers: 37, percentage: 50.68 }, { preferenceId: 11, preference: "Cấp ẩm", customers: 35, percentage: 47.95 }], consentingCustomers: 73, multiSelect: true },
  "/api/v1/reports/feedback/ratings": {
    feedbackCount: 61, avgRating: 2.74,
    distribution: [1, 2, 3, 4, 5].map((rating) => ({ rating, feedbackCount: rating <= 2 ? 15 : 10, percentage: 0 })),
    byMonth: [{ month: "2026-10", feedbackCount: 60, avgRating: 2.75, lowRatingRate: 0.5 }, { month: "2026-11", feedbackCount: 1, avgRating: 2, lowRatingRate: 1 }],
    byProduct: [], byCategory: [{ categoryId: 1, category: "Làm sạch", feedbackCount: 58, avgRating: 2.71 }],
  },
  "/api/v1/reports/purchases/categories": { items: [{ categoryId: 1, category: "Làm sạch", ageGroup: "18–24", revenue: 21_060_000, quantity: 203, orderCount: 53 }], asOf: "2026-11-05" },
};
const serve = (url: string) => {
  const body = reports[url.split("?")[0]];
  return body ? json(body) : json({ title: "Not found" }, 404);
};
const rowOf = (table: HTMLElement, header: string) => within(table).getByRole("rowheader", { name: header }).closest("tr")!;

test("M20 customer report shows the API age ratio and preference shares, with no period filter", async () => {
  stubFetch(serve);
  render(<CustomerReport />);
  assert.equal(screen.queryByRole("button", { name: /Kỳ báo cáo/ }), null, "customer snapshots take no period");
  const age = await screen.findByRole("table", { name: "Tỷ lệ khách hàng theo nhóm tuổi" });
  assert.match(rowOf(age, "25–34").textContent!, /19,5\s?%/);
  assert.match(rowOf(age, "Chưa cung cấp").textContent!, /9,8\s?%/);
  const preferences = screen.getByRole("table", { name: "Nhu cầu phổ biến" });
  assert.match(rowOf(preferences, "Thuần chay").textContent!, /50,7\s?%/);
  assert.ok(screen.getByText(/Tỷ lệ trên 73 khách đồng ý chia sẻ dữ liệu/));
  assert.match(rowOf(screen.getByRole("table", { name: "Cơ cấu giới tính" }), "Nữ").textContent!, /28/);
});

test("M1 overview renders API tiles and previews and sends the chosen period", async () => {
  stubFetch(serve);
  const user = userEvent.setup();
  render(<ManagerDashboard />);
  assert.ok(await screen.findByText("Từ 61 lượt đánh giá"));
  assert.ok(screen.getByText("82"));
  assert.match(screen.getByText("Điểm trung bình").closest("dl")!.textContent!, /2,7\/5/);
  assert.ok(screen.getByText(/Tổng 61 phản hồi, 82\s?% ≤ 4 sao/));
  assert.ok(await screen.findByText("Chưa cung cấp"));
  assert.match(screen.getByText(/^Thuần chay:/).textContent!, /50,7\s?%/);
  assert.equal(screen.getByRole("link", { name: /Hộp phản hồi \(12 mới\)/ }).getAttribute("href"), "/manager/feedback");
  assert.ok(requests.every((url) => !url.includes("?")), "the default period sends no bounds");

  await user.click(screen.getByRole("button", { name: /Kỳ báo cáo/ }));
  await user.click(within(screen.getByRole("dialog", { name: "Chọn kỳ báo cáo" })).getByRole("button", { name: "Tháng trước" }));
  await user.click(screen.getByRole("button", { name: "Áp dụng" }));
  assert.equal(screen.queryByRole("dialog"), null);
  assert.match(screen.getByRole("button", { name: /Kỳ báo cáo/ }).textContent!, /Tháng trước/);
  await screen.findByText("Từ 61 lượt đánh giá");
  const ranged = requests.filter((url) => url.startsWith("/api/v1/reports/overview?"));
  assert.equal(ranged.length, 1);
  const params = new URLSearchParams(ranged[0].split("?")[1]);
  assert.ok(params.get("from") && params.get("to") && params.get("from")! < params.get("to")!);
  assert.ok(!requests.some((url) => url.startsWith("/api/v1/reports/customers/") && url.includes("?")), "customer snapshots take no period");

  assert.equal(screen.queryByRole("tab"), null, "M1 has no report tabs; they moved to the Báo cáo pages");
  assert.equal(screen.getByRole("link", { name: "Xem phân tích" }).getAttribute("href"), "/manager/reports/analytics");
  assert.equal(screen.getByRole("link", { name: "Xem báo cáo" }).getAttribute("href"), "/manager/reports/customers");
});

test("M1 shows an error with retry when the reports API fails", async () => {
  let fail = true;
  stubFetch((url) => fail && url.includes("/customers/") ? json({ title: "Server error" }, 500) : serve(url));
  const user = userEvent.setup();
  render(<CustomerReport />);
  const alerts = await screen.findAllByRole("alert");
  assert.ok(alerts.some((alert) => /Chưa tải được báo cáo khách hàng/.test(alert.textContent!)));
  fail = false;
  await user.click(screen.getAllByRole("button", { name: "Thử lại" })[0]);
  assert.ok(await screen.findByRole("table", { name: "Tỷ lệ khách hàng theo nhóm tuổi" }));
  assert.equal(screen.queryByText(/Chưa tải được báo cáo khách hàng/), null);
});

test("M1 date picker selects a custom range by two clicks and cancels without applying", async () => {
  const user = userEvent.setup();
  const applied: ReportFilter[] = [];
  const now = new Date(2026, 10, 15, 9);
  render(<DateRangePicker value={presetFilter("all", now)} onChange={(value) => applied.push(value)} now={now} />);
  await user.click(screen.getByRole("button", { name: /Kỳ báo cáo/ }));
  const panel = screen.getByRole("dialog", { name: "Chọn kỳ báo cáo" });
  assert.ok(within(panel).getByRole("group", { name: "Tháng 10 - 2026" }));
  const november = within(panel).getByRole("group", { name: "Tháng 11 - 2026" });
  assert.equal((within(november).getByRole("button", { name: "16/11/2026" }) as HTMLButtonElement).disabled, true, "future days are disabled");
  await user.click(within(november).getByRole("button", { name: "10/11/2026" }));
  assert.ok(within(panel).getByText("Chọn ngày kết thúc."));
  await user.click(within(november).getByRole("button", { name: "03/11/2026" }));
  assert.equal(within(november).getByRole("button", { name: "05/11/2026" }).getAttribute("aria-pressed"), "true");
  assert.equal((within(panel).getByLabelText("Từ ngày") as HTMLInputElement).value, "2026-11-03");
  await user.click(within(panel).getByRole("button", { name: "Hủy" }));
  assert.equal(applied.length, 0);

  await user.click(screen.getByRole("button", { name: /Kỳ báo cáo/ }));
  await user.click(screen.getByRole("button", { name: "Xem tháng trước" }));
  const september = screen.getByRole("group", { name: "Tháng 9 - 2026" });
  await user.click(within(september).getByRole("button", { name: "28/09/2026" }));
  await user.click(within(screen.getByRole("group", { name: "Tháng 10 - 2026" })).getByRole("button", { name: "02/10/2026" }));
  await user.click(screen.getByRole("button", { name: "Áp dụng" }));
  assert.deepEqual(applied, [{ preset: "custom", range: { start: "2026-09-28", end: "2026-10-02" } }]);
  assert.deepEqual(toReportRange(applied[0].range), { from: new Date(2026, 8, 28).toISOString(), to: new Date(2026, 9, 3).toISOString() });
});

test("report presets cover whole calendar periods", () => {
  const now = new Date(2026, 10, 15, 9);
  assert.deepEqual(presetRange("yesterday", now), { start: "2026-11-14", end: "2026-11-14" });
  assert.deepEqual(presetRange("7d", now), { start: "2026-11-09", end: "2026-11-15" });
  assert.deepEqual(presetRange("last-month", now), { start: "2026-10-01", end: "2026-10-31" });
  assert.deepEqual(presetRange("quarter", now), { start: "2026-10-01", end: "2026-11-15" });
  assert.deepEqual(presetRange("last-quarter", now), { start: "2026-07-01", end: "2026-09-30" });
  assert.deepEqual(presetRange("last-year", now), { start: "2025-01-01", end: "2025-12-31" });
  assert.equal(presetRange("all", now), null);
  assert.deepEqual(toReportRange(null), {});
  assert.equal(filterLabel({ preset: "custom", range: { start: "2026-11-03", end: "2026-11-10" } }), "03/11/2026 – 10/11/2026");
});

test("xlsx writer produces a zip with escaped inline strings and valid sheet names", () => {
  const files = xlsxFiles([{ name: "Doanh số [danh mục]", boldRows: [0], rows: [["Tên", "Số"], ["A & <B>", 21_060_000]] }, { name: "Doanh số [danh mục]", rows: [] }]);
  const workbook = files.find((file) => file.name === "xl/workbook.xml")!.content;
  assert.match(workbook, /name="Doanh số  danh mục"/);
  assert.match(workbook, /name="Doanh số  danh mục 2"/);
  const sheet = files.find((file) => file.name === "xl/worksheets/sheet1.xml")!.content;
  assert.match(sheet, /<c r="A2" t="inlineStr"><is><t xml:space="preserve">A &amp; &lt;B&gt;<\/t><\/is><\/c><c r="B2"><v>21060000<\/v><\/c>/);
  assert.match(sheet, /<c r="A1" s="1" t="inlineStr">/);
  const bytes = xlsxBytes([{ name: "A", rows: [["x"]] }]);
  assert.deepEqual([...bytes.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
});

test("M1 export menu downloads PDF (never opens the print dialog) and Excel", async () => {
  stubFetch(serve);
  const user = userEvent.setup();
  const downloads: string[] = [];
  const realCreate = URL.createObjectURL, realRevoke = URL.revokeObjectURL, realClick = window.HTMLAnchorElement.prototype.click, realPrint = window.print;
  let printed = 0;
  URL.createObjectURL = () => "blob:report";
  URL.revokeObjectURL = () => {};
  window.HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) { downloads.push(this.download); };
  window.print = () => { printed++; };
  try {
    render(<ManagerDashboard />);
    await screen.findByText("Từ 61 lượt đánh giá");
    await screen.findByText("Chưa cung cấp");
    await user.click(screen.getByRole("button", { name: /Xuất dữ liệu/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Xuất báo cáo PDF" }));
    // jsdom has no canvas, so the capture fails; the screen reports it instead of falling back to print.
    assert.ok(await screen.findByText("Chưa xuất được PDF. Đợi biểu đồ tải xong rồi thử lại.", undefined, { timeout: 5000 }));
    assert.equal(printed, 0);
    await user.click(screen.getByRole("button", { name: /Xuất dữ liệu/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Xuất file Excel" }));
    assert.deepEqual(downloads, ["bao-cao-cocoon_toan-bo.xlsx"]);
  } finally {
    URL.createObjectURL = realCreate; URL.revokeObjectURL = realRevoke; window.HTMLAnchorElement.prototype.click = realClick; window.print = realPrint;
  }
});

test("Excel sheets carry the period label and the same figures as the screen", () => {
  const sheets = reportSheets({ preset: "custom", range: { start: "2026-10-01", end: "2026-10-31" } },
    { overview: reports["/api/v1/reports/overview"], ratings: reports["/api/v1/reports/feedback/ratings"], purchases: reports["/api/v1/reports/purchases/categories"] } as ActivityReports,
    { age: reports["/api/v1/reports/customers/age"], gender: reports["/api/v1/reports/customers/gender"], preferences: reports["/api/v1/reports/customers/preferences"] } as CustomerReports);
  assert.deepEqual(sheets[0].rows[1], ["Kỳ báo cáo", "01/10/2026 – 31/10/2026"]);
  assert.deepEqual(sheets[0].rows[5], ["Tổng khách hàng", 82]);
  assert.deepEqual(sheets[1].rows[1], ["2026-10", 60, 30, 50, 2.75]);
  assert.deepEqual(sheets.find((sheet) => sheet.name === "Doanh số danh mục")!.rows[1], ["Làm sạch", "18–24", 21_060_000, 203, 53]);
  assert.equal(reportFileName({ preset: "custom", range: { start: "2026-10-01", end: "2026-10-31" } }), "bao-cao-cocoon_2026-10-01_2026-10-31.xlsx");
});

test("PDF pages end at block edges and fall back to a hard cut", () => {
  assert.deepEqual(pageCuts(500, 1000, [100, 400]), [500]);
  assert.deepEqual(pageCuts(2500, 1000, [300, 900, 1200, 1800, 2400]), [900, 1800, 2500]);
  assert.deepEqual(pageCuts(2500, 1000, [100, 2400]), [1000, 2000, 2500], "no block edge in the lower half of a page");
});

test("M19 analytics renders category ratings and the revenue table for the chosen period", async () => {
  stubFetch(serve);
  const user = userEvent.setup();
  render(<AnalyticsReport />);
  const revenue = await screen.findByRole("table", { name: /Doanh số theo danh mục và nhóm tuổi/ });
  assert.match(rowOf(revenue, "Làm sạch").textContent!, /21,1/);
  assert.match(rowOf(screen.getByRole("table", { name: "Điểm trung bình theo danh mục" }), "Làm sạch").textContent!, /2,7/);
  await user.click(screen.getByRole("button", { name: /Kỳ báo cáo/ }));
  await user.click(within(screen.getByRole("dialog", { name: "Chọn kỳ báo cáo" })).getByRole("button", { name: "Năm nay" }));
  await user.click(screen.getByRole("button", { name: "Áp dụng" }));
  await screen.findByRole("table", { name: /Doanh số theo danh mục và nhóm tuổi/ });
  assert.ok(requests.some((url) => url.startsWith("/api/v1/reports/purchases/categories?from=")));
});

test("M20 Excel adds a title sheet and is named by date", () => {
  const sheets = customerSheets({ age: reports["/api/v1/reports/customers/age"], gender: reports["/api/v1/reports/customers/gender"], preferences: reports["/api/v1/reports/customers/preferences"] } as CustomerReports, { now: new Date(2026, 10, 15) });
  assert.deepEqual(sheets.map((sheet) => sheet.name), ["Thông tin", "Khách theo tuổi", "Khách theo giới tính", "Nhu cầu"]);
  assert.equal(reportFileName(null, "xlsx", "khach-hang", new Date(2026, 10, 15)), "bao-cao-cocoon-khach-hang_2026-11-15.xlsx");
});
