// Static data for M2 until GET customers is wired up. Delete when api.ts lands.
import type { CustomerListItem } from "./types";

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
