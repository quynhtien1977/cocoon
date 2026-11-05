import "./dom-setup.mjs";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { RecommendationSection } from "../features/customer/recommendation-section";
import { RecommendationHomeLink } from "../features/customer/recommendation-home-link";
import { loadRecommendations, parseRecommendations, recordRecommendationClick } from "../features/customer/recommendation-service";

const originalFetch = globalThis.fetch;
afterEach(() => { cleanup(); globalThis.fetch = originalFetch; });
const row = { id: 71, score: 82.5, product: { id: 12, name: "Nước dưỡng tóc bưởi", minPrice: 162000, imageUrl: "/images/landing/product-1.jpg", avgRating: 4.5 }, reasons: [{ code: "preference", label: "Hợp sở thích của bạn" }, { code: "popular", label: "Được yêu thích" }, { code: "new", label: "Gợi ý mới" }] };

test("recommendations read the existing customer contract and use recommendation IDs for clicks", async () => {
  const calls: { url: string; method: string }[] = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), method: options?.method as string });
    return options?.method === "POST" ? new Response(null, { status: 204 }) : Response.json([row]);
  };
  assert.equal((await loadRecommendations())[0].product.id, 12);
  await recordRecommendationClick(71);
  assert.deepEqual(calls, [{ url: "/api/v1/me/recommendations", method: "GET" }, { url: "/api/v1/me/recommendations/71/click", method: "POST" }]);
  await assert.rejects(recordRecommendationClick(-1));
  assert.equal(calls.length, 2);
});

test("malformed suggestions and unavailable API cannot masquerade as an empty recommendation list", async () => {
  assert.deepEqual(parseRecommendations([]), []);
  assert.throws(() => parseRecommendations({ items: [row] }));
  assert.throws(() => parseRecommendations([row, row]));
  assert.throws(() => parseRecommendations([{ ...row, product: { ...row.product, minPrice: -1 } }]));
  assert.throws(() => parseRecommendations([{ ...row, product: { ...row.product, avgRating: 20 } }]));
  assert.equal(parseRecommendations([{ ...row, product: { ...row.product, imageUrl: "javascript:alert(1)" } }])[0].product.imageUrl, null);
  globalThis.fetch = async () => Response.json({}, { status: 501 });
  await assert.rejects(loadRecommendations(), error => (error as { status: number }).status === 501);
});

test("shared section excludes the viewed product, shows real details and records one click without blocking navigation", async () => {
  let writes = 0;
  globalThis.fetch = async (_url, options) => {
    if (options?.method === "POST") { writes++; return Response.json({}, { status: 500 }); }
    return Response.json([row, { ...row, id: 72, product: { ...row.product, id: 13, name: "Sản phẩm đang xem" } }]);
  };
  render(<RecommendationSection excludeProductId={13} />);
  const link = await screen.findByRole("link", { name: row.product.name });
  assert.equal(link.getAttribute("href"), "/account/products/12");
  assert.equal(screen.queryByText("Sản phẩm đang xem"), null);
  assert.ok(screen.getByText(/162\.000/));
  assert.ok(screen.getByText("Hợp sở thích của bạn"));
  assert.equal(screen.queryByText("Gợi ý mới"), null);
  const imageLink = screen.getByRole("link", { name: `Xem sản phẩm ${row.product.name}` });
  for (const anchor of [link, imageLink]) anchor.addEventListener("click", event => event.preventDefault());
  fireEvent.click(imageLink); fireEvent.click(link);
  await waitFor(() => assert.equal(writes, 1));
  assert.ok(screen.getByRole("link", { name: row.product.name }));
});

test("section exposes retry on API errors and a preference action for an actually empty list", async () => {
  globalThis.fetch = async () => Response.json({}, { status: 501 });
  render(<RecommendationSection home />);
  await screen.findByRole("alert");
  assert.equal(screen.queryByRole("link", { name: "Cập nhật sở thích" }), null);
  globalThis.fetch = async () => Response.json([]);
  fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
  const preferences = await screen.findByRole("link", { name: "Cập nhật sở thích" });
  assert.equal(preferences.getAttribute("href"), "/account/profile");
  assert.equal(document.querySelector("#goi-y-cho-ban")?.tagName, "SECTION");
});

test("landing CTA keeps the home anchor through login; authenticated customers navigate directly", async () => {
  const paths: string[] = [];
  const router = { push: (path: string) => paths.push(path), replace() {}, back() {}, forward() {}, refresh() {}, prefetch() {}, bfcacheId: "recommendations" };
  globalThis.fetch = async () => Response.json({}, { status: 401 });
  render(<AppRouterContext.Provider value={router}><RecommendationHomeLink>Gợi ý cho bạn</RecommendationHomeLink></AppRouterContext.Provider>);
  fireEvent.click(screen.getByRole("link", { name: "Gợi ý cho bạn" }));
  await waitFor(() => assert.equal(paths.length, 1));
  assert.equal(new URL(paths[0], "http://localhost").searchParams.get("next"), "/account#goi-y-cho-ban");
  globalThis.fetch = async () => Response.json({ role: "Customer" });
  fireEvent.click(screen.getByRole("link", { name: "Gợi ý cho bạn" }));
  await waitFor(() => assert.equal(paths.at(-1), "/account#goi-y-cho-ban"));
});
