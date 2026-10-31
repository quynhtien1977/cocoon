// Static data for M2 and M4 until customers/* is wired up. Delete when api.ts lands.
import type { CustomerDetail, CustomerListItem, OrderStatus } from "./types";

export const preferencesFixture = ["Da dầu mụn", "Da nhạy cảm", "Da khô", "Da hỗn hợp", "Làm sạch dịu nhẹ", "Dưỡng ẩm", "Chăm sóc tóc", "Thuần chay"];

const people: [string, string | null, number | null][] = [
  ["Trúc Nguyễn", "Nữ", 26], ["Đặng Hoàng Lan", "Nữ", 23], ["Lê Minh Quân", "Nam", 29], ["Vũ Phương Thảo", "Nữ", 31],
  ["Trần Tuấn Anh", "Nam", 24], ["Phạm Ngọc Mai", "Nữ", 27], ["Hồ Gia Bảo", "Nam", 35], ["Nguyễn Thị Hạnh", "Nữ", 42],
  ["Bùi Khánh Linh", "Nữ", 19], ["Đỗ Quốc Huy", "Nam", 33], ["Lý Thanh Trúc", "Nữ", 28], ["Mai Anh Thư", "Nữ", 21],
  ["Phan Đức Long", "Nam", 47], ["Cao Bảo Ngọc", "Nữ", 25], ["Tạ Minh Châu", "Khác", 30], ["Võ Hải Yến", "Nữ", 38],
  ["Huỳnh Nhật Nam", "Nam", null], ["Trịnh Thu Hà", "Nữ", 52], ["Đinh Gia Hân", "Nữ", 22], ["Lâm Quang Vinh", "Nam", 27],
  ["Kiều Mỹ Duyên", null, 34], ["Ngô Bích Phương", "Nữ", 29], ["Dương Tấn Phát", "Nam", 41], ["Hà Linh Đan", "Nữ", 24],
];

const pad = (value: number) => String(value).padStart(2, "0");
const ascii = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();

export const customersFixture: CustomerListItem[] = people.map(([fullName, gender, age], index) => {
  const orderCount = (index * 7) % 9;
  const parts = ascii(fullName).split(" ");
  return {
    id: 108 + index,
    code: `KH-${String(108 + index).padStart(4, "0")}`,
    fullName,
    email: `${parts.at(-1)}.${parts[0]}${index + 1}@example.com`,
    phone: index % 5 === 4 ? null : `09${pad((index * 13) % 100)} ${pad((index * 31) % 100)}${index % 10} ${pad((index * 17) % 100)}${(index * 3) % 10}`,
    age,
    gender,
    preferences: [preferencesFixture[index % 8], preferencesFixture[(index * 3 + 2) % 8]].filter((value, position, list) => list.indexOf(value) === position).slice(0, index % 4 === 3 ? 1 : 2),
    orderCount,
    lastOrderAt: orderCount === 0 ? null : `2026-${pad(10 - (index % 6))}-${pad(1 + ((index * 5) % 27))}T10:00:00+07:00`,
    joinedAt: `2025-${pad(1 + (index % 12))}-${pad(1 + ((index * 11) % 27))}T09:00:00+07:00`,
    status: index === 4 || index === 17 ? "Locked" : "Active",
  };
});

const products = ["Gel bí đao rửa mặt 140ml", "Tẩy da chết cà phê Đắk Lắk 150ml", "Nước sen Hậu Giang 310ml", "Sữa dưỡng hoa hồng Cao Bằng 100ml", "Nước dưỡng tóc bưởi 140ml"];
const orderStatuses: OrderStatus[] = ["Completed", "Completed", "Completed", "Returned", "Completed", "Cancelled"];

export function customerDetailFixture(id: number): CustomerDetail | null {
  const row = customersFixture.find((item) => item.id === id);
  if (!row) return null;
  const orders = Array.from({ length: row.orderCount }, (_, index) => ({
    id: id * 100 + index,
    code: `CC-${id * 10 + index}`,
    placedAt: `2026-${pad(10 - (index % 9))}-${pad(5 + index * 3)}T10:00:00+07:00`,
    itemCount: 1 + (index % 3),
    total: 195_000 + index * 85_000,
    status: orderStatuses[index % orderStatuses.length],
  }));
  return {
    ...row,
    address: id % 4 === 0 ? null : `${id} Hai Bà Trưng, Phường Bến Nghé, TP. HCM`,
    dateOfBirth: row.age === null ? null : `${2026 - row.age}-05-20`,
    totalSpent: orders.filter((order) => order.status === "Completed").reduce((sum, order) => sum + order.total, 0),
    orders,
    feedback: row.orderCount === 0 ? [] : [
      { id: 41, productName: products[0], rating: 5, content: "Bọt mịn, rửa xong da không khô căng. Mong có thêm bản dung tích lớn.", createdAt: "2026-10-20T09:15:00+07:00", status: "Replied" },
      { id: 38, productName: products[1], rating: 3, content: "Mùi cà phê thơm, da mịn nhưng hạt hơi to với da mặt.", createdAt: "2026-09-12T16:40:00+07:00", status: "Closed" },
    ],
    surveys: [
      { id: 82, title: "Khảo sát sản phẩm mới: Kem dưỡng ẩm hoa hồng", sentAt: "2026-10-20T08:00:00+07:00", status: "NotDone" },
      { id: 75, title: "Thói quen chống nắng hằng ngày và kết cấu mong đợi", sentAt: "2026-09-01T08:00:00+07:00", status: "Done" },
    ],
    recommendations: [
      { id: 1, productName: "Gel bí đao rửa mặt 310ml", reason: "Khớp sở thích, đã mua danh mục Làm sạch", score: 0.67, state: "Clicked" },
      { id: 2, productName: products[1], reason: "Đã mua danh mục, khách tương tự mua cùng", score: 0.58, state: "None" },
      { id: 3, productName: products[4], reason: "Khớp sở thích, đánh giá tốt", score: 0.49, state: "None" },
      { id: 4, productName: products[3], reason: "Thuộc kế hoạch gợi ý đang chạy", score: 0.31, state: "Dismissed" },
    ],
  };
}

/** Worked example from spec 5.7: Pref 1, Survey 0, Category 0.6, CoPurchase 0.4, Rating 0.9, Plan 1 gives 0.67. */
export const scoreComponentsFixture = [
  { label: "Sở thích", weight: 0.3, value: 1, note: "Khớp toàn bộ sở thích của khách." },
  { label: "Khảo sát đã làm", weight: 0.15, value: 0, note: "Chưa có câu trả lời khảo sát liên quan." },
  { label: "Danh mục đã mua", weight: 0.2, value: 0.6, note: "Đã mua nhiều lần trong danh mục Làm sạch." },
  { label: "Mua cùng phổ biến", weight: 0.15, value: 0.4, note: "Hay được mua cùng sản phẩm khách đã có." },
  { label: "Điểm đánh giá", weight: 0.1, value: 0.9, note: "Sản phẩm có điểm đánh giá cao." },
  { label: "Kế hoạch gợi ý", weight: 0.1, value: 1, note: "Thuộc kế hoạch đang kích hoạt." },
];
