import "./dom-setup.mjs";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { ReactNode } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { emptySegmentFilter } from "../components/data/segment-filter-builder";
import { PlanDetail } from "../features/recommendations/components/plan-detail";
import { PlanEditor } from "../features/recommendations/components/plan-editor";
import { RecommendationOverview } from "../features/recommendations/components/recommendation-overview";
import { planProductsFixture, plansFixture } from "../features/recommendations/recommendations.fixture";
import { segmentSummary, toPlanDraft, toPlanUpsertRequest, validatePlanDetails } from "../features/recommendations/schemas";
import { preferencesFixture, segmentCategoriesFixture, surveyCandidatesFixture } from "../features/surveys/surveys.fixture";

afterEach(cleanup);

const withParams = (search: string, node: ReactNode) => <SearchParamsContext.Provider value={new URLSearchParams(search)}>{node}</SearchParamsContext.Provider>;
const audience = { products: planProductsFixture, customers: surveyCandidatesFixture, preferences: preferencesFixture, categories: segmentCategoriesFixture };
const planWith = (status: string) => plansFixture.find((plan) => plan.status === status)!;
const next = () => screen.getByRole("button", { name: "Tiếp tục" });
const overview = () => render(withParams("plans.size=50", <RecommendationOverview initialPlans={plansFixture} preferences={preferencesFixture} categories={segmentCategoriesFixture} />));

test("M13 shows the spec's four stats, plans and rebuild time", async () => {
  const user = userEvent.setup();
  overview();
  for (const label of ["Độ phủ gợi ý", "Tỷ lệ bấm", "Tỷ lệ bỏ qua", "Kế hoạch đang chạy"]) assert.ok(screen.getAllByText(label).length > 0);
  assert.equal(within(screen.getByRole("table", { name: /Kế hoạch gợi ý/ })).getAllByRole("row").length - 1, plansFixture.length);
  assert.match(screen.getByText(/21\/10\/2026/).textContent ?? "", /09:00/);
  await user.click(screen.getByRole("button", { name: "Tính lại gợi ý" }));
  assert.ok(screen.getByText(/Đã tính lại gợi ý/));
});

test("M13 offers actions by status and ends a plan after confirmation", async () => {
  const user = userEvent.setup();
  overview();
  const table = screen.getByRole("table", { name: /Kế hoạch gợi ý/ });
  const [active, draft, ended] = [planWith("Active"), planWith("Draft"), planWith("Ended")];
  assert.equal(within(table).getByRole("link", { name: `Chỉnh sửa ${draft.name}` }).getAttribute("href"), `/manager/recommendations/plans/${draft.id}`);
  assert.equal(within(table).queryByRole("button", { name: `Kết thúc ${ended.name}` }), null);
  await user.click(within(table).getByRole("button", { name: `Kết thúc ${active.name}` }));
  await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Kết thúc kế hoạch" }));
  assert.ok(await screen.findByText(new RegExp(`Đã kết thúc “${active.name}”`)));
  assert.equal(screen.queryAllByRole("button", { name: `Kết thúc ${active.name}` }).length, 0);
});

test("M14 blocks step 1 until name and valid dates are set", async () => {
  const user = userEvent.setup();
  render(<PlanEditor {...audience} />);
  await user.click(next());
  assert.ok(screen.getByText("Nhập tên kế hoạch."));
  assert.ok(screen.getByText("Chọn ngày bắt đầu."));
  assert.equal(screen.getByRole("button", { name: /Thông tin chung/ }).getAttribute("aria-current"), "step");
  assert.equal(validatePlanDetails({ ...toPlanDraft(planWith("Draft")), endAt: "2026-01-01" }).endAt, "Ngày kết thúc phải sau ngày bắt đầu.");
});

test("M14 walks three steps, orders products, caps at 3 and activates naming the customer count", async () => {
  const user = userEvent.setup();
  render(<PlanEditor {...audience} initial={toPlanDraft(planWith("Draft"))} planId={103} />);
  await user.click(next());
  assert.ok(screen.getByRole("heading", { name: "Khách hàng mẫu" }));
  const count = surveyCandidatesFixture.filter((customer) => customer.age !== null && customer.age >= 25 && customer.age <= 44 && customer.daysSinceLastOrder !== null && customer.daysSinceLastOrder <= 180).length;
  await user.click(next());
  const [first, second] = plansFixture.find((plan) => plan.id === 103)!.productIds.map((id) => planProductsFixture.find((product) => product.id === id)!.name);
  await user.click(screen.getByRole("button", { name: `Đưa ${second} lên trên` }));
  const order = within(screen.getByRole("region", { name: "Sản phẩm trong kế hoạch" })).getAllByRole("listitem").map((item) => item.textContent ?? "");
  assert.ok(order[0].includes(second) && order[1].includes(first));
  await user.click(screen.getByRole("button", { name: /^Chọn Mặt nạ/ }));
  await user.click(screen.getByRole("button", { name: /^Chọn Kem dưỡng/ }));
  assert.match(screen.getByRole("alert").textContent ?? "", /tối đa 3 sản phẩm/);
  await user.click(screen.getByRole("button", { name: "Kích hoạt kế hoạch" }));
  const dialog = await screen.findByRole("alertdialog");
  assert.match(dialog.textContent ?? "", new RegExp(`${count} khách hàng`));
  await user.click(within(dialog).getByRole("button", { name: "Kích hoạt ngay" }));
  assert.ok(await screen.findByRole("heading", { name: "Đã kích hoạt kế hoạch" }));
});

test("M14 sends the manager back to the step that blocks activation", async () => {
  const user = userEvent.setup();
  render(<PlanEditor {...audience} initial={{ ...toPlanDraft(planWith("Draft")), productIds: [] }} />);
  await user.click(next());
  await user.click(next());
  await user.click(screen.getByRole("button", { name: "Kích hoạt kế hoạch" }));
  assert.match(screen.getByRole("alert").textContent ?? "", /chưa chọn sản phẩm/);
  assert.equal(screen.queryByRole("alertdialog"), null);
});

test("plan detail is read-only and only an active plan can be ended", () => {
  const props = { products: planProductsFixture, preferences: preferencesFixture, categories: segmentCategoriesFixture };
  const { unmount } = render(<PlanDetail initial={planWith("Active")} {...props} />);
  assert.ok(screen.getByRole("button", { name: "Kết thúc kế hoạch" }));
  unmount();
  render(<PlanDetail initial={planWith("Ended")} {...props} />);
  assert.equal(screen.queryByRole("button", { name: "Kết thúc kế hoạch" }), null);
  assert.equal(screen.queryByRole("textbox"), null);
});

test("plan draft maps to PlanUpsertRequest and segments read as text", () => {
  const body = toPlanUpsertRequest({ name: " Kế hoạch ", goal: "  ", startAt: "2026-11-01", endAt: "2026-11-30", segment: emptySegmentFilter(), productIds: [2, 1] });
  assert.deepEqual({ name: body.name, goal: body.goal, startAt: body.startAt, endAt: body.endAt, productIds: body.productIds }, { name: "Kế hoạch", goal: null, startAt: "2026-11-01T00:00:00+07:00", endAt: "2026-11-30T23:59:59+07:00", productIds: [2, 1] });
  assert.equal(segmentSummary(emptySegmentFilter(), preferencesFixture, segmentCategoriesFixture), "Mọi khách hàng");
  assert.equal(segmentSummary({ ...emptySegmentFilter(), ageMin: 18, preferenceIds: [1] }, preferencesFixture, segmentCategoriesFixture), "18–… tuổi · Da dầu mụn");
});
