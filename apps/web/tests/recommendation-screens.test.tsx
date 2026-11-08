import "./dom-setup.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { emptySegmentFilter, type SegmentFilterValue } from "../components/data/segment-filter-builder";
import { PlanEditor } from "../features/recommendations/components/plan-editor";
import { PlanPage } from "../features/recommendations/components/plan-page";
import { RecommendationOverviewPage } from "../features/recommendations/components/recommendation-overview";
import { segmentSummary, toPlanDraft, toPlanUpsertRequest, validatePlanDetails } from "../features/recommendations/schemas";
import type { PlanProduct, PlanStatus, RecommendationPlan, RecommendationReport } from "../features/recommendations/types";

beforeEach(() => window.history.replaceState(null, "", "/"));
afterEach(cleanup);

const withParams = (search: string, node: ReactNode) => <SearchParamsContext.Provider value={new URLSearchParams(search)}>{node}</SearchParamsContext.Provider>;
const preferences = [{ id: 1, name: "Da dầu" }, { id: 2, name: "Da khô" }];
const categories = [{ id: 1, name: "Làm sạch" }, { id: 2, name: "Dưỡng da" }];
const products: PlanProduct[] = [
  { id: 1, name: "Gel rửa mặt bí đao", categoryName: "Làm sạch", status: "Active", preferences: ["Da dầu"] },
  { id: 2, name: "Nước sen Hậu Giang", categoryName: "Làm sạch", status: "Active", preferences: ["Da khô"] },
  { id: 3, name: "Kem dưỡng bí đao", categoryName: "Dưỡng da", status: "Active", preferences: [] },
  { id: 4, name: "Mặt nạ nghệ", categoryName: "Dưỡng da", status: "Active", preferences: [] },
  { id: 5, name: "Sữa tắm cà phê cũ", categoryName: "Dưỡng da", status: "Hidden", preferences: [] },
];
const segment = (patch: Partial<SegmentFilterValue> = {}) => ({ ...emptySegmentFilter(), ...patch });
const plan = (id: number, status: PlanStatus, name: string, patch: Partial<RecommendationPlan> = {}): RecommendationPlan => ({ id, name, goal: null, status, startAt: "2026-11-05T17:00:00Z", endAt: "2026-12-15T16:59:59Z", segment: segment(), productIds: [1, 2], recipientCount: 40, clickRate: status === "Draft" ? null : 0.2, ...patch });
const plans = [plan(12, "Active", "Khám phá thuần chay"), plan(11, "Draft", "Chăm sóc da mỗi ngày", { segment: segment({ ageMin: 18, ageMax: 44 }) }), plan(10, "Ended", "Chăm sóc da dầu")];
const report: RecommendationReport = { coverage: 0.917808, clickRate: 0.125, dismissRate: 0.05, activePlans: 1, lastBuiltAt: "2026-11-05T02:00:00Z", topProducts: [{ id: 4, name: "Nước tẩy trang bí đao", recommendationCount: 62, clicks: 9, dismissals: 1, clickRate: 0.145, dismissRate: 0.016 }] };
const preview = { count: 7, sample: [{ id: 5, code: "KH-0005", fullName: "Nguyễn Văn An", email: "an@example.com", age: 30, gender: "Nam" }] };

type Respond = (url: string, method: string) => Response | undefined;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const page = (items: unknown[]) => json({ items, totalCount: items.length, page: 1, pageSize: 100 });
const realFetch = globalThis.fetch;
let requests: { url: string; method: string; body: unknown }[] = [];
afterEach(() => { globalThis.fetch = realFetch; });

/** Answers the reads every screen makes; `respond` handles the rest (or overrides). */
function stubFetch(respond: Respond = () => undefined) {
  requests = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    requests.push({ url, method, body: init?.body ? JSON.parse(init.body as string) : undefined });
    const path = url.replace("/api/v1", "").split("?")[0];
    return respond(path, method) ?? ({
      "/recommendation-plans": page(plans), "/reports/recommendations": json(report), "/preferences": json(preferences),
      "/categories": json(categories), "/products": page(products), "/segments/preview": json(preview),
    } as Record<string, Response>)[path] ?? json({}, 404);
  }) as typeof fetch;
}
const writes = () => requests.filter((item) => item.method !== "GET" && !item.url.startsWith("/api/v1/segments/preview")).map(({ url, method, body }) => [method, url, body]);
const next = () => screen.getByRole("button", { name: "Tiếp tục" });
const overview = async () => {
  render(withParams("plans.size=50", <RecommendationOverviewPage />));
  return screen.findByRole("table", { name: /Kế hoạch gợi ý/ });
};

test("M13 shows the report's stats and top products, then rebuilds through the API", async () => {
  stubFetch((path, method) => path === "/recommendations/rebuild" && method === "POST" ? json({ customerCount: 73, recommendationCount: 600, builtAt: "2026-11-05T05:30:00Z" }) : undefined);
  const user = userEvent.setup();
  const table = await overview();
  assert.equal(within(table).getAllByRole("row").length - 1, plans.length);
  assert.ok(screen.getByText(/91,8/), "coverage comes from the report");
  assert.ok(screen.getByText(/12,5/), "click rate comes from the report");
  assert.ok(screen.getByText("Nước tẩy trang bí đao"));
  assert.ok(screen.getByText("62 lần gợi ý"));
  assert.match(screen.getByText(/05\/11\/2026/).textContent ?? "", /09:00/);
  assert.equal(screen.queryByText(/Tương tác gợi ý theo tuần/), null, "no API data for the weekly chart");
  await user.click(screen.getByRole("button", { name: "Tính lại gợi ý" }));
  assert.ok(await screen.findByText("Đã tính lại 600 gợi ý cho 73 khách hàng."));
  assert.match((await screen.findByText(/12:30/)).textContent ?? "", /05\/11\/2026/);
  assert.deepEqual(writes(), [["POST", "/api/v1/recommendations/rebuild", undefined]]);
});

test("M13 ends an active plan and deletes a draft through the API", async () => {
  stubFetch((path, method) => method === "POST" && path.endsWith("/end") ? json({ audienceCount: 40, recommendationCount: 120 }) : method === "DELETE" ? new Response(null, { status: 204 }) : undefined);
  const user = userEvent.setup();
  const table = await overview();
  assert.equal(within(table).getByRole("link", { name: "Chỉnh sửa Chăm sóc da mỗi ngày" }).getAttribute("href"), "/manager/recommendations/plans/11");
  assert.equal(within(table).queryByRole("button", { name: "Kết thúc Chăm sóc da dầu" }), null);
  await user.click(within(table).getByRole("button", { name: "Kết thúc Khám phá thuần chay" }));
  await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Kết thúc kế hoạch" }));
  assert.ok(await screen.findByText("Đã kết thúc “Khám phá thuần chay”."));
  assert.equal(screen.queryAllByRole("button", { name: "Kết thúc Khám phá thuần chay" }).length, 0);
  await user.click(within(table).getByRole("button", { name: "Xóa Chăm sóc da mỗi ngày" }));
  await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Xóa bản nháp" }));
  assert.ok(await screen.findByText("Đã xóa bản nháp “Chăm sóc da mỗi ngày”."));
  assert.deepEqual(writes(), [["POST", "/api/v1/recommendation-plans/12/end", undefined], ["DELETE", "/api/v1/recommendation-plans/11", undefined]]);
});

test("M13 keeps the dialog open with the API message when a plan cannot be ended", async () => {
  stubFetch((path, method) => method === "POST" && path.endsWith("/end") ? json({ detail: "Chỉ kết thúc được kế hoạch đang chạy.", code: "PLAN_NOT_ACTIVE" }, 409) : undefined);
  const user = userEvent.setup();
  const table = await overview();
  await user.click(within(table).getByRole("button", { name: "Kết thúc Khám phá thuần chay" }));
  const dialog = await screen.findByRole("alertdialog");
  await user.click(within(dialog).getByRole("button", { name: "Kết thúc kế hoạch" }));
  assert.match((await within(dialog).findByRole("alert")).textContent ?? "", /đang chạy/);
  assert.ok(within(table).getByRole("button", { name: "Kết thúc Khám phá thuần chay", hidden: true }), "status unchanged");
});

test("M13 offers a retry when the overview fails to load", async () => {
  stubFetch((path) => path === "/reports/recommendations" ? json({}, 500) : undefined);
  render(withParams("plans.size=50", <RecommendationOverviewPage />));
  await screen.findByText("Chưa tải được tổng quan gợi ý");
  stubFetch();
  await userEvent.setup().click(screen.getByRole("button", { name: "Thử lại" }));
  assert.ok(await screen.findByRole("table", { name: /Kế hoạch gợi ý/ }));
});

test("M14 blocks step 1 until name and valid dates are set", async () => {
  stubFetch();
  const user = userEvent.setup();
  render(<PlanEditor products={products} preferences={preferences} categories={categories} />);
  await user.click(next());
  assert.ok(screen.getByText("Nhập tên kế hoạch."));
  assert.ok(screen.getByText("Chọn ngày bắt đầu."));
  assert.equal(screen.getByRole("button", { name: /Thông tin chung/ }).getAttribute("aria-current"), "step");
  assert.equal(validatePlanDetails({ ...toPlanDraft(plans[1]), endAt: "2026-01-01" }).endAt, "Ngày kết thúc phải sau ngày bắt đầu.");
});

test("M14 creates a plan with the chosen products in order, then activates it", async () => {
  stubFetch((path, method) =>
    path === "/recommendation-plans" && method === "POST" ? json(plan(77, "Draft", "Kế hoạch mới"), 201)
    : path === "/recommendation-plans/77/activate" ? json({ audienceCount: 7, recommendationCount: 21 }) : undefined);
  const user = userEvent.setup();
  render(<PlanPage />);
  await user.type(await screen.findByLabelText(/Tên kế hoạch/), "Kế hoạch mới");
  fireEvent.change(screen.getByLabelText(/Ngày bắt đầu/), { target: { value: "2026-11-06" } });
  fireEvent.change(screen.getByLabelText(/Ngày kết thúc/), { target: { value: "2026-12-15" } });
  await user.click(next());
  assert.ok(await screen.findByText("Nguyễn Văn An"), "sample comes from segments/preview");
  await user.click(screen.getByRole("button", { name: "Da dầu" }));
  await user.click(next());
  assert.equal(screen.queryByRole("button", { name: /^Chọn Sữa tắm cà phê cũ/ }), null, "hidden products cannot be pushed");
  await user.click(screen.getByRole("button", { name: /^Chọn Kem dưỡng/ }));
  await user.click(screen.getByRole("button", { name: /^Chọn Gel rửa mặt/ }));
  await user.click(screen.getByRole("button", { name: "Đưa Gel rửa mặt bí đao lên trên" }));
  await user.click(screen.getByRole("button", { name: /^Chọn Nước sen/ }));
  await user.click(screen.getByRole("button", { name: /^Chọn Mặt nạ/ }));
  assert.match(screen.getByRole("alert").textContent ?? "", /tối đa 3 sản phẩm/);
  await user.click(screen.getByRole("button", { name: "Kích hoạt kế hoạch" }));
  const dialog = await screen.findByRole("alertdialog");
  assert.match(dialog.textContent ?? "", /7 khách hàng/);
  await user.click(within(dialog).getByRole("button", { name: "Kích hoạt ngay" }));
  assert.ok(await screen.findByRole("heading", { name: "Đã kích hoạt kế hoạch" }));
  assert.ok(screen.getByText(/7 khách hàng với 3 sản phẩm, tạo 21 gợi ý/));
  assert.deepEqual(writes(), [
    ["POST", "/api/v1/recommendation-plans", { name: "Kế hoạch mới", goal: null, startAt: "2026-11-06T00:00:00+07:00", endAt: "2026-12-15T23:59:59+07:00", segment: segment({ preferenceIds: [1] }), productIds: [1, 3, 2] }],
    ["POST", "/api/v1/recommendation-plans/77/activate", undefined],
  ]);
  assert.ok(requests.some((item) => item.url === "/api/v1/segments/preview?consentOnly=true" && JSON.stringify(item.body) === JSON.stringify(segment({ preferenceIds: [1] }))));
  assert.equal(window.location.pathname, "/manager/recommendations/plans/77");
});

test("M14 saves an existing draft with PUT and shows the API error when activation fails", async () => {
  stubFetch((path, method) =>
    path === "/recommendation-plans/11" && method === "PUT" ? json(plans[1])
    : path === "/recommendation-plans/11/activate" ? json({ detail: "Kế hoạch đã qua ngày kết thúc. Hãy sửa thời gian trước khi kích hoạt.", code: "PLAN_EXPIRED" }, 400)
    : path === "/recommendation-plans/11" ? json(plans[1]) : undefined);
  const user = userEvent.setup();
  render(<PlanPage id={11} />);
  assert.equal((await screen.findByLabelText(/Ngày bắt đầu/) as HTMLInputElement).value, "2026-11-06", "UTC start reads as the Vietnam calendar day");
  await user.click(screen.getByRole("button", { name: "Lưu bản nháp" }));
  assert.ok(await screen.findByText(/Đã lưu bản nháp lúc/));
  await user.click(next());
  await screen.findByText("Nguyễn Văn An");
  await user.click(next());
  await user.click(screen.getByRole("button", { name: "Kích hoạt kế hoạch" }));
  const dialog = await screen.findByRole("alertdialog");
  await user.click(within(dialog).getByRole("button", { name: "Kích hoạt ngay" }));
  assert.match((await within(dialog).findByRole("alert")).textContent ?? "", /qua ngày kết thúc/);
  assert.equal(screen.queryByRole("heading", { name: "Đã kích hoạt kế hoạch" }), null);
  const body = toPlanUpsertRequest(toPlanDraft(plans[1]));
  assert.deepEqual(writes(), [["PUT", "/api/v1/recommendation-plans/11", body], ["PUT", "/api/v1/recommendation-plans/11", body], ["POST", "/api/v1/recommendation-plans/11/activate", undefined]]);
});

test("M14 sends the manager back to the step that blocks activation", async () => {
  stubFetch();
  const user = userEvent.setup();
  render(<PlanEditor products={products} preferences={preferences} categories={categories} initial={{ ...toPlanDraft(plans[1]), productIds: [] }} />);
  await user.click(next());
  await user.click(next());
  await user.click(screen.getByRole("button", { name: "Kích hoạt kế hoạch" }));
  assert.match(screen.getByRole("alert").textContent ?? "", /chưa chọn sản phẩm/);
  assert.equal(screen.queryByRole("alertdialog"), null);
});

test("plan page shows active and ended plans read-only and ends an active one through the API", async () => {
  stubFetch((path, method) => path === "/recommendation-plans/10" ? json(plans[2]) : path === "/recommendation-plans/12/end" && method === "POST" ? json({ audienceCount: 40, recommendationCount: 0 }) : path === "/recommendation-plans/12" ? json(plans[0]) : undefined);
  const user = userEvent.setup();
  const { unmount } = render(<PlanPage id={10} />);
  await screen.findByRole("heading", { name: "Chăm sóc da dầu" });
  assert.equal(screen.queryByRole("button", { name: "Kết thúc kế hoạch" }), null);
  assert.equal(screen.queryByRole("textbox"), null);
  assert.ok(screen.getByText("Gel rửa mặt bí đao"));
  unmount();
  render(<PlanPage id={12} />);
  await user.click(await screen.findByRole("button", { name: "Kết thúc kế hoạch" }));
  await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Kết thúc kế hoạch" }));
  assert.ok(await screen.findByText("Đã kết thúc kế hoạch."));
  assert.deepEqual(writes(), [["POST", "/api/v1/recommendation-plans/12/end", undefined]]);
});

test("plan page shows not found for a missing plan", async () => {
  stubFetch((path) => path === "/recommendation-plans/999" ? json({}, 404) : undefined);
  render(<PlanPage id={999} />);
  assert.ok(await screen.findByText("Không tìm thấy kế hoạch"));
});

test("plan draft maps to PlanUpsertRequest and segments read as text", () => {
  const body = toPlanUpsertRequest({ name: " Kế hoạch ", goal: "  ", startAt: "2026-11-01", endAt: "2026-11-30", segment: emptySegmentFilter(), productIds: [2, 1] });
  assert.deepEqual({ name: body.name, goal: body.goal, startAt: body.startAt, endAt: body.endAt, productIds: body.productIds }, { name: "Kế hoạch", goal: null, startAt: "2026-11-01T00:00:00+07:00", endAt: "2026-11-30T23:59:59+07:00", productIds: [2, 1] });
  assert.deepEqual([toPlanDraft(plans[0]).startAt, toPlanDraft(plans[0]).endAt], ["2026-11-06", "2026-12-15"]);
  assert.equal(segmentSummary(emptySegmentFilter(), preferences, categories), "Mọi khách hàng");
  assert.equal(segmentSummary({ ...emptySegmentFilter(), ageMin: 18, preferenceIds: [1] }, preferences, categories), "18–… tuổi · Da dầu");
});
