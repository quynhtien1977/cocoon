import "./dom-setup.mjs";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductReviewsSection } from "../features/customer/product-reviews-section";
import {
  loadProductInsights,
  loadProductReviews,
} from "../features/customer/product-service";

const originalFetch = globalThis.fetch;

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});

const mockInsights = {
  totalFeedback: 15,
  averageRating: 4.6,
  ratingDistribution: [
    { rating: 5, count: 10 },
    { rating: 4, count: 3 },
    { rating: 3, count: 1 },
    { rating: 2, count: 1 },
    { rating: 1, count: 0 },
  ],
};

const mockReviews = {
  items: [
    {
      id: 101,
      customerName: "Nguyễn Văn An",
      rating: 5,
      content: "Sản phẩm dùng rất êm, hương thơm dịu nhẹ tự nhiên.",
      createdAt: "2026-11-10T10:00:00Z",
      variantName: "Chai 140ml",
      originalRating: 4,
      contentEditedAt: "2026-11-10T11:00:00Z",
      followUp: {
        content: "Dùng được 1 tuần da đỡ khô hẳn.",
        createdAt: "2026-11-11T09:00:00Z",
      },
      replies: [
        {
          id: 501,
          staffName: "Nguyễn Tiến An",
          content: "Cocoon chân thành cảm ơn bạn đã yêu thích và tin dùng sản phẩm!",
          createdAt: "2026-11-10T14:00:00Z",
          round: 1,
        },
        {
          id: 502,
          staffName: "Lê Thị Hoa",
          content: "Cocoon rất vui khi biết sản phẩm phù hợp với làn da của bạn!",
          createdAt: "2026-11-11T10:00:00Z",
          round: 2,
        },
      ],
    },
    {
      id: 102,
      customerName: "Trần Thị Mai",
      rating: 4,
      content: "Giao hàng nhanh, đóng gói cẩn thận.",
      createdAt: "2026-11-08T08:30:00Z",
      variantName: "Chai 310ml",
      replies: [],
    },
  ],
  totalCount: 2,
  page: 1,
  pageSize: 6,
};

test("loadProductInsights and loadProductReviews parse endpoint responses correctly", async () => {
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/insights")) return Response.json(mockInsights);
    if (url.includes("/reviews")) return Response.json(mockReviews);
    return Response.json({});
  };

  const insights = await loadProductInsights(1);
  assert.equal(insights.totalFeedback, 15);
  assert.equal(insights.averageRating, 4.6);
  assert.equal(insights.ratingDistribution.length, 5);

  const reviews = await loadProductReviews(1, { page: 1, pageSize: 6 });
  assert.equal(reviews.totalCount, 2);
  assert.equal(reviews.items[0].customerName, "Nguyễn Văn An");
  assert.equal(reviews.items[0].rating, 5);
  assert.equal(reviews.items[0].variantName, "Chai 140ml");
  assert.equal(reviews.items[0].originalRating, 4);
  assert.equal(reviews.items[0].followUp?.content, "Dùng được 1 tuần da đỡ khô hẳn.");
  assert.equal(reviews.items[0].replies.length, 2);
  assert.equal(reviews.items[0].replies[0].round, 1);
  assert.equal(reviews.items[0].replies[0].staffName, "Nguyễn Tiến An");
  assert.equal(reviews.items[0].replies[0].content, "Cocoon chân thành cảm ơn bạn đã yêu thích và tin dùng sản phẩm!");
  assert.equal(reviews.items[0].replies[1].round, 2);
  assert.equal(reviews.items[0].replies[1].staffName, "Lê Thị Hoa");
  assert.equal(reviews.items[0].replies[1].content, "Cocoon rất vui khi biết sản phẩm phù hợp với làn da của bạn!");
  assert.equal(reviews.items[1].replies.length, 0);
});

test("ProductReviewsSection renders rating summary, distribution, and reviews list", async () => {
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/insights")) return Response.json(mockInsights);
    if (url.includes("/reviews")) return Response.json(mockReviews);
    return Response.json({});
  };

  render(
    <ProductReviewsSection productId={1} productName="Gel rửa mặt bí đao" />
  );

  // Check section header
  assert.ok(
    await screen.findByRole("heading", {
      level: 2,
      name: "Nhận xét của khách hàng",
    })
  );

  // Check overall rating summary
  assert.ok(await screen.findByText("4,6"));
  assert.ok(screen.getByText("Dựa trên 15 lượt đánh giá"));

  // Check distribution
  assert.ok(screen.getByText("10 (67%)"));
  assert.ok(screen.getByText("3 (20%)"));

  // Check customer review cards
  assert.ok(await screen.findByText("Nguyễn Văn An"));
  assert.ok(screen.getByText("Sản phẩm dùng rất êm, hương thơm dịu nhẹ tự nhiên."));
  assert.ok(screen.getByText("Chai 140ml"));
  assert.ok(screen.getByText("Trần Thị Mai"));
  assert.ok(screen.getByText("Giao hàng nhanh, đóng gói cẩn thận."));
  assert.ok(screen.getByText("Chai 310ml"));

  // Check edited badges
  assert.ok(screen.getByText("Đã chỉnh sửa"));
  assert.ok(screen.getByText("Đã sửa từ 4★"));

  // Check round 1 staff reply
  assert.ok(screen.getByText(/Phản hồi từ Cocoon \(Nguyễn Tiến An\)/));
  assert.ok(screen.getByText("Cocoon chân thành cảm ơn bạn đã yêu thích và tin dùng sản phẩm!"));

  // Check customer follow-up
  assert.ok(screen.getByText(/Ý kiến bổ sung của khách hàng \(Nguyễn Văn An\)/));
  assert.ok(screen.getByText("Dùng được 1 tuần da đỡ khô hẳn."));

  // Check round 2 staff reply
  assert.ok(screen.getByText(/Giải đáp từ Cocoon \(Lê Thị Hoa\)/));
  assert.ok(screen.getByText("Cocoon rất vui khi biết sản phẩm phù hợp với làn da của bạn!"));
});

test("ProductReviewsSection renders empty state when there are no reviews", async () => {
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/insights")) {
      return Response.json({
        totalFeedback: 0,
        averageRating: null,
        ratingDistribution: [],
      });
    }
    if (url.includes("/reviews")) {
      return Response.json({
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 6,
      });
    }
    return Response.json({});
  };

  render(
    <ProductReviewsSection productId={99} productName="Sản phẩm mới" />
  );

  assert.ok(
    await screen.findByText("Chưa có nhận xét nào cho sản phẩm này")
  );
  assert.ok(screen.getByText("Chưa có lượt đánh giá"));
});

test("ProductReviewsSection filters reviews by star rating", async () => {
  const user = userEvent.setup();
  let requestedRating: string | null = null;

  globalThis.fetch = async (input) => {
    const url = new URL(String(input), "http://localhost");
    if (url.pathname.includes("/insights")) return Response.json(mockInsights);
    if (url.pathname.includes("/reviews")) {
      requestedRating = url.searchParams.get("rating");
      if (requestedRating === "5") {
        return Response.json({
          items: [mockReviews.items[0]],
          totalCount: 1,
          page: 1,
          pageSize: 6,
        });
      }
      return Response.json(mockReviews);
    }
    return Response.json({});
  };

  render(
    <ProductReviewsSection productId={1} productName="Gel rửa mặt bí đao" />
  );

  assert.ok(await screen.findByText("Nguyễn Văn An"));
  assert.ok(screen.getByText("Trần Thị Mai"));

  // Click filter button for "5 sao"
  const fiveStarBtn = screen.getByRole("button", { name: /5 sao/ });
  await user.click(fiveStarBtn);

  // Should fetch with rating=5 and update reviews
  await waitFor(() => {
    assert.equal(requestedRating, "5");
  });
  assert.ok(screen.getByText("Nguyễn Văn An"));
  assert.equal(screen.queryByText("Trần Thị Mai"), null);
});
