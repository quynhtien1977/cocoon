import assets from "@/public/images/landing/sources.json";
const image = (key: keyof typeof assets) => assets[key].src;
export const products = [
  { name: "Sữa chống nắng vô cơ sen Hậu Giang", size: "50ml · Tone up Beige", category: "Chăm sóc da", image: image("product-0"), hoverImage: image("product-0-hover"), price: "449.000 ₫", url: "https://cocoonvietnam.com/san-pham/sua-chong-nang-vo-co-sen-hau-giang-50ml-tone-up-beige" },
  { name: "Nước dưỡng tóc tinh dầu bưởi", size: "140ml", category: "Chăm sóc tóc", image: image("product-1"), hoverImage: image("product-1-hover"), price: "162.000 ₫", url: "https://cocoonvietnam.com/san-pham/nuoc-duong-toc-tinh-dau-buoi-140ml-1" },
  { name: "Mặt nạ nghệ Hưng Yên", size: "100ml", category: "Chăm sóc da", image: image("product-2"), hoverImage: image("product-2-hover"), price: "339.000 ₫", url: "https://cocoonvietnam.com/san-pham/mat-na-nghe-hung-yen-100ml" },
  { name: "Nước tẩy trang bí đao", size: "500ml", category: "Chăm sóc da", image: image("product-3"), hoverImage: image("product-3-hover"), price: "299.000 ₫", url: "https://cocoonvietnam.com/san-pham/nuoc-tay-trang-bi-dao-500ml" },
  { name: "Cà phê Đắk Lắk làm sạch da chết cơ thể", size: "200ml", category: "Chăm sóc da", image: image("product-4"), hoverImage: image("product-4-hover"), price: "133.000 ₫", url: "https://cocoonvietnam.com/san-pham/ca-phe-dak-lak-lam-sach-da-chet-co-the-200ml" },
];

// These slugs identify local reference content, not database product IDs.
export const detailProducts = [...products, {
  name: "Dầu gội bồ kết", size: "500ml", category: "Chăm sóc tóc",
  image: image("spotlight-product"), hoverImage: image("spotlight-product"),
  price: "", url: "https://cocoonvietnam.com/san-pham/dau-goi-bo-ket-500ml",
}];

export function findReferenceProduct(slug: string) {
  return detailProducts.find((product) => product.url.split("/").at(-1) === slug);
}
