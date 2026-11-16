import "./dom-setup.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import type { ReactNode } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { ManagerProductsPage } from "../features/manager/products-page";
import { ManagerProductDetailPage } from "../features/manager/product-detail-page";

const realFetch = globalThis.fetch;
beforeEach(() => window.history.replaceState(null, "", "/"));
afterEach(() => { cleanup(); globalThis.fetch = realFetch; });

const withParams = (search: string, node: ReactNode) => (
  <SearchParamsContext.Provider value={new URLSearchParams(search)}>{node}</SearchParamsContext.Provider>
);

test("ManagerProductsPage renders unified stats, status tabs, table rows and mobile cards", async () => {
  const products = [
    { id: 1, name: "Nước sen Hậu Giang", sku: "COC-01", categoryId: 1, categoryName: "Dưỡng da", status: "Active", preferences: ["Da dầu"], averageRating: 4.5, feedbackCount: 12 },
    { id: 2, name: "Serum nghệ Hưng Yên", sku: "COC-02", categoryId: 2, categoryName: "Tinh chất", status: "Upcoming", preferences: [], averageRating: null, feedbackCount: null },
  ];
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ items: products, totalCount: products.length }), {
      headers: { "content-type": "application/json" },
    })) as typeof fetch;

  render(withParams("products.size=50", <ManagerProductsPage />));

  assert.ok(await screen.findByRole("heading", { name: "Quản lý danh mục sản phẩm" }));
  const tabs = screen.getByRole("navigation", { name: "Lọc nhanh theo trạng thái sản phẩm" });
  assert.ok(within(tabs).getByRole("button", { name: /Tất cả/ }));
  assert.ok(within(tabs).getByRole("button", { name: /Đang bán/ }));
  assert.ok(within(tabs).getByRole("button", { name: /Sắp ra mắt/ }));
  assert.ok(within(tabs).getByRole("button", { name: /Ngừng bán/ }));

  // Filter bar uses standard <select> controls like FeedbackInbox / OrdersList
  assert.equal((screen.getByLabelText("Danh mục") as HTMLSelectElement).tagName, "SELECT");
  assert.equal((screen.getByLabelText("Trạng thái") as HTMLSelectElement).tagName, "SELECT");
  assert.equal((screen.getByLabelText("Nhu cầu") as HTMLSelectElement).tagName, "SELECT");

  const table = await screen.findByRole("table", { name: "Danh sách sản phẩm" });
  assert.equal(within(table).getAllByRole("row").length - 1, 2);
  assert.equal(screen.getByRole("link", { name: "Xem chi tiết Nước sen Hậu Giang" }).getAttribute("href"), "/manager/products/1");
  assert.equal(screen.getByRole("link", { name: "Mở chi tiết Serum nghệ Hưng Yên" }).getAttribute("href"), "/manager/products/2");
});

test("ManagerProductDetailPage renders unified header, tabs, variants and product-specific feedback/ratings", async () => {
  const detail = {
    id: 1,
    name: "Nước sen Hậu Giang",
    sku: "COC-01",
    categoryId: 1,
    categoryName: "Dưỡng da",
    status: "Active",
    description: "Nước dưỡng cân bằng dịu nhẹ.",
    preferences: ["Da dầu"],
    preferenceIds: [10],
    averageRating: 2.6,
    variants: [{ id: 11, name: "140ml", sku: "COC-01-140", price: 195000, imageUrl: null }],
    ingredients: "Chiết xuất hoa sen",
    benefits: "Cấp ẩm và làm dịu",
    usage: "Thoa đều sau bước làm sạch",
  };
  const insights = {
    totalFeedback: 25,
    averageRating: 2.6,
    ratingDistribution: [
      { rating: 5, count: 3 },
      { rating: 4, count: 5 },
      { rating: 3, count: 4 },
      { rating: 2, count: 5 },
      { rating: 1, count: 8 },
    ],
  };
  const feedbackItems = [
    { id: 101, productId: 1, customerName: "Trần Thị Dung", rating: 5, content: "Hương sen dịu nhẹ, thấm nhanh." },
    { id: 102, productId: 2, customerName: "Khách sản phẩm khác", rating: 1, content: "Không thuộc sản phẩm 1." },
  ];
  globalThis.fetch = (async (input) => {
    const url = String(input);
    if (url.endsWith("/preferences")) {
      return new Response(JSON.stringify([{ id: 10, name: "Da dầu" }, { id: 12, name: "Da nhạy cảm" }]), {
        headers: { "content-type": "application/json" },
      });
    }
    if (url.endsWith("/products/1/insights")) {
      return new Response(JSON.stringify(insights), { headers: { "content-type": "application/json" } });
    }
    if (url.includes("/feedback?productId=1")) {
      return new Response(JSON.stringify({ items: feedbackItems, totalCount: feedbackItems.length }), {
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify(detail), { headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  render(<ManagerProductDetailPage id="1" />);

  assert.ok(await screen.findByRole("heading", { level: 1, name: "Nước sen Hậu Giang" }));
  assert.ok(screen.getByRole("tab", { name: /Thông tin sản phẩm/ }));
  const feedbackTab = screen.getByRole("tab", { name: /Phản hồi & đánh giá/ });
  assert.ok(screen.getByRole("table", { name: "Các biến thể sản phẩm" }));
  assert.ok(screen.getByText("Chiết xuất hoa sen"));

  await userEvent.setup().click(feedbackTab);
  assert.ok(await screen.findByText("Mức độ hài lòng với sản phẩm"));
  assert.ok(screen.getByText("32% khách chấm 4–5 sao"));
  assert.ok(screen.getByText("3 lượt (12%)"));
  assert.ok(screen.getByText("“Hương sen dịu nhẹ, thấm nhanh.”"));
  assert.ok(screen.getByText("Trần Thị Dung"));
  assert.equal(screen.queryByText("Khách sản phẩm khác"), null);
});
