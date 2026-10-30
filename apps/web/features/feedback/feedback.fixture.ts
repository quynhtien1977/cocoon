// Static data for M5, M6, S1, S2 until feedback/* and staff/feedback are wired up. Delete when api.ts lands.
import type { FeedbackDetail, FeedbackListItem, FeedbackStatus, StaffOption } from "./types";

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

export const staffFixture: StaffOption[] = [{ id: 11, name: "Ngô Thị Thu" }, { id: 12, name: "Lâm Quốc Bảo" }];
/** Signed-in staff for S1 and S2 until GET me is wired up. */
export const currentStaffFixture = staffFixture[0];
const staff = staffFixture.map((item) => item.name);
const pad = (value: number) => String(value).padStart(2, "0");

export const feedbackFixture: FeedbackListItem[] = entries.map(([customerName, rating, status, content], index) => {
  const [productName, categoryName] = products[index % products.length];
  return {
    id: 41 - index,
    customerName,
    customerCode: `KH-${String(108 + index).padStart(4, "0")}`,
    orderCode: index % 6 !== 5 ? `CC-${8821 - index * 37}` : null,
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

const sequence: FeedbackStatus[] = ["New", "Accepted", "Assigned", "Replied", "Closed"];
const atOffset = (iso: string, hours: number) => new Date(new Date(iso).getTime() + hours * 3_600_000).toISOString();

export function feedbackDetailFixture(id: number): FeedbackDetail | null {
  const row = feedbackFixture.find((item) => item.id === id);
  if (!row) return null;
  const reached = sequence.slice(0, sequence.indexOf(row.status) + 1);
  const index = 41 - id;
  return {
    ...row,
    customerEmail: `${row.customerCode.toLowerCase()}@example.com`,
    customerPhone: index % 5 === 4 ? null : `0900 000 ${100 + index}`,
    customerOrderCount: 1 + (index % 7),
    customerPreferences: ["Da dầu mụn", "Làm sạch dịu nhẹ"],
    sku: `CO-${1000 + (index % 8)}`,
    price: 145_000 + (index % 8) * 30_000,
    orderCompletedAt: row.orderCode ? atOffset(row.createdAt, -96) : null,
    statusTimes: Object.fromEntries(reached.map((status, step) => [status, atOffset(row.createdAt, step * 5)])),
    replies: row.assigneeName && (row.status === "Replied" || row.status === "Closed")
      ? [{ id: 1, staffName: row.assigneeName, content: "Cocoon cảm ơn góp ý của bạn. Chúng tôi đã ghi nhận và chuyển tới bộ phận phụ trách để cải thiện trải nghiệm.", createdAt: atOffset(row.createdAt, 15) }]
      : [],
  };
}
