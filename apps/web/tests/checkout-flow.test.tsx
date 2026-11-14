import "./dom-setup.mjs";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { ContextType } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { CheckoutDialog } from "../features/customer/checkout-dialog";
import { loadShopCategories, loadShopProducts, placeOrder } from "../features/customer/shop-service";

const originalFetch = globalThis.fetch;
afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});

const sampleProduct = {
  id: 15,
  name: "Cà phê Đắk Lắk làm sạch da chết cơ thể",
  description: "Làm sạch tế bào chết",
  ingredients: "Cà phê Đắk Lắk",
  benefits: "Mịn màng",
  usage: "Tắm sạch rồi thoa",
  categoryName: "Chăm sóc cơ thể",
  status: "Active" as const,
  variants: [
    {
      id: 25,
      name: "200ml",
      price: 125000,
      imageUrl: null,
    },
  ],
};

function mountWithRouter(node: React.ReactNode, push: (href: string) => void = () => {}) {
  const router = {
    push,
    prefetch: async () => {},
    replace() {},
    back() {},
    forward() {},
    refresh() {},
    hmrRefresh() {},
  } as unknown as NonNullable<ContextType<typeof AppRouterContext>>;

  return render(<AppRouterContext.Provider value={router}>{node}</AppRouterContext.Provider>);
}

test("shop-service loadShopProducts and loadShopCategories fetch correctly", async () => {
  let calledUrl = "";
  globalThis.fetch = async (url) => {
    calledUrl = String(url);
    if (calledUrl.includes("/shop/categories")) {
      return Response.json([{ id: 1, name: "Chăm sóc da" }]);
    }
    return Response.json({
      items: [
        {
          id: 15,
          name: "Cà phê Đắk Lắk",
          categoryId: 1,
          categoryName: "Chăm sóc da",
          minPrice: 125000,
          imageUrl: null,
          averageRating: 4.8,
          feedbackCount: 12,
          variants: [{ id: 25, name: "200ml", price: 125000, imageUrl: null }],
        },
      ],
      totalCount: 1,
      page: 1,
      pageSize: 24,
    });
  };

  const cats = await loadShopCategories();
  assert.equal(cats.length, 1);
  assert.equal(cats[0].name, "Chăm sóc da");

  const products = await loadShopProducts({ search: "cà phê", categoryId: 1, page: 1, pageSize: 24 });
  assert.equal(products.items.length, 1);
  assert.equal(products.items[0].name, "Cà phê Đắk Lắk");
  assert.ok(calledUrl.includes("search=c%C3%A0+ph%C3%AA"));
  assert.ok(calledUrl.includes("categoryId=1"));
});

test("placeOrder posts to /api/v1/me/orders without unitPrice", async () => {
  let calledUrl = "";
  let calledMethod = "";
  let payload: { items: { variantId: number; quantity: number; unitPrice?: number }[]; shippingAddress: string } | null = null;

  globalThis.fetch = async (url, options) => {
    calledUrl = String(url);
    calledMethod = options?.method ?? "GET";
    payload = JSON.parse(String(options?.body));
    return Response.json({ id: 1, code: "CO-W-000123", totalAmount: 250000 }, { status: 201 });
  };

  const res = await placeOrder({
    items: [{ variantId: 25, quantity: 2 }],
    shippingAddress: "140 Hai Bà Trưng, Quận 1, TP. HCM",
  });

  assert.equal(calledUrl, "/api/v1/me/orders");
  assert.equal(calledMethod, "POST");
  assert.equal(res.code, "CO-W-000123");
  assert.equal(payload!.items.length, 1);
  assert.equal(payload!.items[0].variantId, 25);
  assert.equal(payload!.items[0].quantity, 2);
  assert.equal(payload!.items[0].unitPrice, undefined);
  assert.equal(payload!.shippingAddress, "140 Hai Bà Trưng, Quận 1, TP. HCM");
});

test("CheckoutDialog displays pre-filled address and submits order", async () => {
  let postBody: { items: { variantId: number; quantity: number }[]; shippingAddress: string } | null = null;
  const destinations: string[] = [];

  globalThis.fetch = async (url, options) => {
    const urlStr = String(url);
    if (urlStr === "/api/v1/me" && (options?.method === "GET" || options?.method === undefined)) {
      return Response.json({
        fullName: "Nguyễn Văn A",
        email: "customer-a@example.com",
        phone: "0901234567",
        address: "140 Hai Bà Trưng, Quận 1, TP. HCM",
        consentPersonalData: true,
      });
    }
    if (urlStr === "/api/v1/me/orders" && options?.method === "POST") {
      postBody = JSON.parse(String(options.body));
      return Response.json({ id: 10, code: "CO-W-000010", totalAmount: 250000 }, { status: 201 });
    }
    return Response.json({});
  };

  mountWithRouter(
    <CheckoutDialog
      open={true}
      onOpenChange={() => {}}
      product={sampleProduct}
      variant={sampleProduct.variants[0]}
      quantity={2}
    />,
    (href) => destinations.push(href)
  );

  await screen.findByRole("heading", { name: "Xác nhận đặt hàng" });
  assert.ok(screen.getByText("Cà phê Đắk Lắk làm sạch da chết cơ thể"));
  assert.ok(screen.getByText("Phân loại: 200ml"));
  assert.ok(screen.getByText("Số lượng: 2"));
  assert.ok(screen.getByText(/250\.000/));

  // Check pre-filled address
  const textarea = (await screen.findByLabelText(/Địa chỉ nhận hàng/)) as HTMLTextAreaElement;
  await waitFor(() => {
    assert.equal(textarea.value, "140 Hai Bà Trưng, Quận 1, TP. HCM");
  });

  // Submit order
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận đặt hàng" }));

  await waitFor(() => {
    assert.ok(postBody);
    assert.equal(postBody.items[0].variantId, 25);
    assert.equal(postBody.items[0].quantity, 2);
    assert.deepEqual(destinations, ["/account/orders"]);
  });
});
