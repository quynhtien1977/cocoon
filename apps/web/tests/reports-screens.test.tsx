import "./dom-setup.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ManagerDashboard } from "../features/reports/components/manager-dashboard";

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

test("M1 customer report shows the API age ratio and preference shares", async () => {
  stubFetch(serve);
  render(<ManagerDashboard />);
  await userEvent.setup().click(screen.getByRole("tab", { name: "Báo cáo khách hàng" }));
  const age = await screen.findByRole("table", { name: "Tỷ lệ khách hàng theo nhóm tuổi" });
  assert.match(rowOf(age, "25–34").textContent!, /19,5\s?%/);
  assert.match(rowOf(age, "Chưa cung cấp").textContent!, /9,8\s?%/);
  const preferences = screen.getByRole("table", { name: "Sở thích phổ biến" });
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

  await user.selectOptions(screen.getByLabelText("Kỳ báo cáo"), "last-month");
  await screen.findByText("Từ 61 lượt đánh giá");
  const ranged = requests.filter((url) => url.startsWith("/api/v1/reports/overview?"));
  assert.equal(ranged.length, 1);
  const params = new URLSearchParams(ranged[0].split("?")[1]);
  assert.ok(params.get("from") && params.get("to") && params.get("from")! < params.get("to")!);
  assert.ok(!requests.some((url) => url.startsWith("/api/v1/reports/customers/") && url.includes("?")), "customer snapshots take no period");

  await user.click(screen.getByRole("button", { name: "Xem phân tích" }));
  assert.equal(screen.getByRole("tab", { name: "Phân tích" }).getAttribute("aria-selected"), "true");
  assert.ok(screen.getByRole("table", { name: /Doanh số theo danh mục và nhóm tuổi/ }));
});

test("M1 shows an error with retry when the reports API fails", async () => {
  let fail = true;
  stubFetch((url) => fail && url.includes("/customers/") ? json({ title: "Server error" }, 500) : serve(url));
  const user = userEvent.setup();
  render(<ManagerDashboard />);
  await user.click(screen.getByRole("tab", { name: "Báo cáo khách hàng" }));
  const alerts = await screen.findAllByRole("alert");
  assert.ok(alerts.some((alert) => /Chưa tải được báo cáo khách hàng/.test(alert.textContent!)));
  fail = false;
  await user.click(screen.getAllByRole("button", { name: "Thử lại" })[0]);
  assert.ok(await screen.findByRole("table", { name: "Tỷ lệ khách hàng theo nhóm tuổi" }));
  assert.equal(screen.queryByText(/Chưa tải được báo cáo khách hàng/), null);
});
