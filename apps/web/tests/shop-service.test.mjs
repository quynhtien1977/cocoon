import assert from "node:assert/strict";
import { test } from "node:test";
import { toCarouselProduct } from "../features/customer/shop-service.ts";

const photo = name => `https://image.cocoonvietnam.com/uploads/${name}`;
const product = (imageUrl, hoverImageUrl) => ({
  id: 7, name: "Bơ dưỡng thể", categoryId: 1, categoryName: "Dưỡng thể", minPrice: 241000, imageUrl, hoverImageUrl,
  averageRating: null, feedbackCount: 0, variants: [{ id: 9, name: "200ml", price: 241000, imageUrl, hoverImageUrl, images: [] }],
});

test("cards fade to the API hover photo and keep a single photo still", () => {
  assert.deepEqual(
    (({ image, hoverImage, url }) => ({ image, hoverImage, url }))(toCarouselProduct(product(photo("front.png"), photo("back.jpg")))),
    { image: photo("front.png"), hoverImage: photo("back.jpg"), url: "/account/products/7" });
  assert.equal(toCarouselProduct(product(photo("front.png"), null)).hoverImage, "");
  assert.equal(toCarouselProduct(product(photo("front.png"), photo("front.png"))).hoverImage, "");
});
