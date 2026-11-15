import type { XlsxSheet } from "@/lib/xlsx";
import { filterLabel, type ReportFilter } from "./date-range";
import type { ActivityReports, CustomerReports } from "./types";

const round = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;
const stamp = (date: Date) => date.toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });

/** M1 overview: period figures plus the customer snapshot, same numbers as the screen. */
export function reportSheets(filter: ReportFilter, activity: ActivityReports, customers: CustomerReports, now = new Date()): XlsxSheet[] {
  return [...activitySheets(filter, activity, now), ...customerSheets(customers)];
}

/** Period-bound sheets (M1, M17 analytics); they follow the date filter. */
export function activitySheets(filter: ReportFilter, activity: ActivityReports, now = new Date(), title = "Báo cáo tổng quan CRM & Khách hàng — Cocoon"): XlsxSheet[] {
  const { overview, ratings, purchases } = activity;
  return [
    { name: "Tổng quan", boldRows: [0, 4], rows: [
      [title],
      ["Kỳ báo cáo", filterLabel(filter)],
      ["Xuất lúc", stamp(now)],
      [],
      ["Chỉ số", "Giá trị"],
      ["Tổng khách hàng", overview.totalCustomers],
      ["Khách mới trong tháng này", overview.newCustomersThisMonth],
      ["Khách mới 30 ngày", overview.newCustomers30d],
      ["Phản hồi mới (chờ tiếp nhận, gửi trong kỳ)", overview.newFeedback],
      ["Điểm trung bình (/5)", overview.avgRating == null ? "—" : round(overview.avgRating)],
      ["Lượt đánh giá", overview.ratingCount],
      ["Khảo sát đang mở", overview.openSurveys],
      ["Lượt hoàn tất khảo sát trong kỳ", overview.completedResponses],
    ] },
    { name: "Phản hồi theo tháng", boldRows: [0], rows: [
      ["Tháng", "Tổng phản hồi", "Phản hồi ≤ 4 sao", "Tỷ lệ ≤ 4 sao (%)", "Điểm TB"],
      ...ratings.byMonth.map((row) => [row.month, row.feedbackCount, Math.round(row.feedbackCount * row.lowRatingRate), round(row.lowRatingRate * 100, 1), round(row.avgRating)]),
    ] },
    { name: "Phân bố điểm", boldRows: [0], rows: [
      ["Số sao", "Số phản hồi", "Tỷ lệ (%)"],
      ...ratings.distribution.map((row) => [row.rating, row.feedbackCount, round(row.percentage, 1)]),
    ] },
    { name: "Điểm theo danh mục", boldRows: [0], rows: [
      ["Danh mục", "Số phản hồi", "Điểm TB"],
      ...ratings.byCategory.map((row) => [row.category, row.feedbackCount, round(row.avgRating)]),
    ] },
    { name: "Điểm theo sản phẩm", boldRows: [0], rows: [
      ["Sản phẩm", "Số phản hồi", "Điểm TB"],
      ...ratings.byProduct.map((row) => [row.product, row.feedbackCount, round(row.avgRating)]),
    ] },
    { name: "Doanh số danh mục", boldRows: [0], rows: [
      ["Danh mục", "Nhóm tuổi", "Doanh thu (VND)", "Số lượng", "Số đơn"],
      ...purchases.items.map((row) => [row.category, row.ageGroup, row.revenue, row.quantity, row.orderCount]),
    ] },
  ];
}

/** Current customer snapshot (M18); the API takes no period. cover adds a title sheet for a standalone export. */
export function customerSheets(customers: CustomerReports, cover?: { now: Date }): XlsxSheet[] {
  return [
    ...(cover ? [{ name: "Thông tin", boldRows: [0], rows: [["Bảng báo cáo khách hàng — Cocoon"], ["Số liệu", "Hiện tại (không theo kỳ)"], ["Xuất lúc", stamp(cover.now)]] }] : []),
    { name: "Khách theo tuổi", boldRows: [0], rows: [
      ["Nhóm tuổi", "Số khách", "Tỷ lệ (%)"],
      ...customers.age.items.map((row) => [row.group, row.customers, round(row.percentage, 1)]),
    ] },
    { name: "Khách theo giới tính", boldRows: [0], rows: [
      ["Giới tính", "Số khách", "Tỷ lệ (%)"],
      ...customers.gender.items.map((row) => [row.gender, row.customers, round(row.percentage, 1)]),
    ] },
    { name: "Nhu cầu", boldRows: [0], rows: [
      ["Nhu cầu", "Số khách", `Tỷ lệ trên ${customers.preferences.consentingCustomers} khách đồng ý (%)`],
      ...customers.preferences.items.map((row) => [row.preference, row.customers, round(row.percentage, 1)]),
    ] },
  ];
}

/** filter null: a snapshot report, named by today's date. section tells the pages apart (e.g. "phan-tich"). */
export function reportFileName(filter: ReportFilter | null, extension: "xlsx" | "pdf" = "xlsx", section = "", now = new Date()): string {
  const range = !filter ? now.toLocaleDateString("sv-SE") : filter.range ? (filter.range.start === filter.range.end ? filter.range.start : `${filter.range.start}_${filter.range.end}`) : "toan-bo";
  return `bao-cao-cocoon${section ? `-${section}` : ""}_${range}.${extension}`;
}
