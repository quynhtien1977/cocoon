// Static data for M5 until GET feedback is wired up. Delete when api.ts lands.
import type { FeedbackListItem, FeedbackStatus } from "./types";

export const categoriesFixture = ["Làm sạch", "Tẩy da chết", "Toner", "Dưỡng da", "Chăm sóc tóc"];

const products: [string, string][] = [
  ["Gel bí đao rửa mặt 140ml", "Làm sạch"], ["Tẩy da chết cà phê Đắk Lắk 150ml", "Tẩy da chết"], ["Nước sen Hậu Giang 310ml", "Toner"],
  ["Sữa dưỡng hoa hồng Cao Bằng 100ml", "Dưỡng da"], ["Nước dưỡng tóc bưởi 140ml", "Chăm sóc tóc"], ["Toner bí đao 140ml", "Toner"],
  ["Kem dưỡng sen 30ml", "Dưỡng da"], ["Dầu gội bưởi 310ml", "Chăm sóc tóc"],
];

const entries: [string, number, FeedbackStatus, string][] = [
  ["Đặng Hoàng Lan", 2, "New", "Vòi xịt hơi mạnh, làm rất nhẹ khi xịt trực tiếp lên mặt nên tốn sản phẩm."],
  ["Trần Tuấn Anh", 1, "New", "Da mình bị khô căng sau hai tuần dùng liên tục, không biết có hợp da dầu không."],
  ["Trúc Nguyễn", 5, "New", "Chai dùng rất êm, bọt mịn, rửa xong da không bị khô. Sẽ mua lại chai to."],
  ["Lê Minh Quân", 3, "Accepted", "Mùi cà phê thơm nồng, tẩy xong da mịn nhưng hạt hơi to với da mặt."],
  ["Phạm Ngọc Mai", 2, "Assigned", "Hộp giao tới bị móp, nắp bơm không lên được dù sản phẩm còn mới."],
  ["Vũ Phương Thảo", 4, "Replied", "Tóc đỡ rụng rõ sau một tháng, chỉ mong có thêm bản dung tích lớn."],
  ["Hồ Gia Bảo", 5, "Closed", "Toner dịu, không cồn, dùng cho da nhạy cảm rất ổn. Cảm ơn Cocoon."],
  ["Nguyễn Thị Hạnh", 4, "Replied", "Kem thấm nhanh, mùi sen nhẹ, nhưng hũ nhỏ nên dùng nhanh hết."],
  ["Bùi Khánh Linh", 1, "Assigned", "Dầu gội làm da đầu mình bị ngứa, đã ngưng dùng sau ba lần gội."],
  ["Đỗ Quốc Huy", 3, "Accepted", "Bọt ít hơn mình nghĩ, rửa sạch nhưng cần dùng nhiều sản phẩm."],
  ["Lý Thanh Trúc", 5, "Closed", "Mua lần thứ ba, chất lượng ổn định, đóng gói cẩn thận."],
  ["Mai Anh Thư", 4, "New", "Da mềm hơn sau một tuần, mong có combo với toner cùng dòng."],
  ["Phan Đức Long", 2, "Replied", "Giao hàng chậm năm ngày so với dự kiến, sản phẩm thì dùng tốt."],
  ["Cao Bảo Ngọc", 5, "Closed", "Mùi hoa hồng tự nhiên, không hắc, thấm nhanh không bết."],
  ["Tạ Minh Châu", 3, "New", "Sản phẩm ổn nhưng nhãn chưa ghi rõ hạn dùng sau khi mở nắp."],
  ["Võ Hải Yến", 4, "Assigned", "Tóc thơm lâu, chỉ có điều vòi xịt hay bị kẹt khi gần hết."],
];

const staff = ["Ngô Thị Thu", "Lâm Quốc Bảo"];
const pad = (value: number) => String(value).padStart(2, "0");

export const feedbackFixture: FeedbackListItem[] = entries.map(([customerName, rating, status, content], index) => {
  const [productName, categoryName] = products[index % products.length];
  return {
    id: 41 - index,
    customerName,
    productName,
    categoryName,
    rating,
    content,
    status,
    assigneeName: status === "Assigned" || status === "Replied" || status === "Closed" ? staff[index % 2] : null,
    verifiedPurchase: index % 6 !== 5,
    createdAt: `2026-10-${pad(28 - Math.floor(index * 1.5))}T${pad(8 + ((index * 5) % 12))}:${pad((index * 17) % 60)}:00+07:00`,
  };
});
