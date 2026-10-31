// Static data for M1 until reports/* is wired up. Delete when api.ts lands.
import type { AgeGroupCount, AttentionFeedback, CategoryAgeRevenue, CategoryRating, CoPurchasePair, GenderCount, MonthlyLowRating, PreferenceCount, ReportInsight, ReportOverview, WeeklyFeedback } from "./types";

export const overviewFixture: ReportOverview = {
  totalCustomers: 86,
  newCustomers30d: 17,
  newFeedback: 9,
  avgRating: 4.3,
  openSurveys: 3,
  newCustomersThisMonth: 4,
  ratingCount: 142,
  completedResponses: 128,
};

export const reportPeriodsFixture = ["Tháng 10/2026", "Tháng 09/2026", "Tháng 08/2026", "Quý 3/2026"];

export const weeklyFeedbackFixture: WeeklyFeedback[] = [
  { week: "08/09", total: 18, lowRating: 2 },
  { week: "15/09", total: 22, lowRating: 3 },
  { week: "22/09", total: 19, lowRating: 1 },
  { week: "29/09", total: 27, lowRating: 4 },
  { week: "06/10", total: 24, lowRating: 2 },
  { week: "13/10", total: 31, lowRating: 3 },
  { week: "20/10", total: 26, lowRating: 1 },
  { week: "27/10", total: 15, lowRating: 1 },
];

export const attentionFeedbackFixture: AttentionFeedback[] = [
  { id: 41, customerName: "Đặng Hoàng Lan", productName: "Nước sen Hậu Giang 310ml", rating: 2, excerpt: "Vòi xịt hơi mạnh, làm rất nhẹ khi xịt trực tiếp lên mặt.", status: "New", orderCode: "CC-8821", createdAt: "2026-10-28T09:15:00+07:00" },
  { id: 40, customerName: "Trần Tuấn Anh", productName: "Gel bí đao rửa mặt 140ml", rating: 1, excerpt: "Da mình bị khô căng sau hai tuần dùng liên tục.", status: "New", orderCode: "CC-8790", createdAt: "2026-10-27T21:02:00+07:00" },
  { id: 38, customerName: "Lê Minh Quân", productName: "Tẩy da chết cà phê Đắk Lắk", rating: 3, excerpt: "Mùi cà phê thơm nồng, nhưng hạt hơi to với da mặt.", status: "Accepted", orderCode: "CC-7390", createdAt: "2026-10-27T16:40:00+07:00" },
  { id: 36, customerName: "Phạm Ngọc Mai", productName: "Sữa dưỡng hoa hồng Cao Bằng", rating: 2, excerpt: "Hộp giao tới bị móp, nắp bơm không lên.", status: "Assigned", orderCode: "CC-7012", createdAt: "2026-10-26T10:24:00+07:00" },
];

export const ageGroupFixture: AgeGroupCount[] = [
  { group: "18–24", customers: 24 },
  { group: "25–34", customers: 38 },
  { group: "35–44", customers: 16 },
  { group: "45+", customers: 8 },
];

export const genderFixture: GenderCount[] = [
  { gender: "Nữ", customers: 67 },
  { gender: "Nam", customers: 16 },
  { gender: "Khác", customers: 3 },
];

export const topPreferencesFixture: PreferenceCount[] = [
  { preference: "Da dầu mụn", customers: 41 },
  { preference: "Làm sạch dịu nhẹ", customers: 35 },
  { preference: "Da nhạy cảm", customers: 29 },
  { preference: "Dưỡng ẩm", customers: 26 },
  { preference: "Chăm sóc tóc", customers: 18 },
  { preference: "Thuần chay", customers: 15 },
];

export const categoryRatingFixture: CategoryRating[] = [
  { category: "Làm sạch", avgRating: 4.6, feedbackCount: 58 },
  { category: "Tẩy da chết", avgRating: 4.4, feedbackCount: 31 },
  { category: "Toner", avgRating: 4.2, feedbackCount: 27 },
  { category: "Dưỡng da", avgRating: 4.1, feedbackCount: 44 },
  { category: "Chăm sóc tóc", avgRating: 3.8, feedbackCount: 19 },
];

export const monthlyLowRatingFixture: MonthlyLowRating[] = [
  { month: "05/2026", lowRatingRate: 0.071 },
  { month: "06/2026", lowRatingRate: 0.064 },
  { month: "07/2026", lowRatingRate: 0.058 },
  { month: "08/2026", lowRatingRate: 0.061 },
  { month: "09/2026", lowRatingRate: 0.049 },
  { month: "10/2026", lowRatingRate: 0.042 },
];

const categories = ["Làm sạch", "Tẩy da chết", "Toner", "Dưỡng da", "Chăm sóc tóc"];
const ageGroups = ["18–24", "25–34", "35–44", "45+"];
const revenueMillions = [
  [12.4, 21.8, 8.1, 3.2],
  [9.6, 14.2, 4.4, 1.1],
  [5.3, 11.7, 6.9, 2.8],
  [7.8, 19.5, 12.3, 6.4],
  [2.1, 6.6, 5.2, 3.9],
];
export const categoryAgeRevenueFixture: CategoryAgeRevenue[] = categories.flatMap((category, row) =>
  ageGroups.map((ageGroup, column) => ({ category, ageGroup, revenue: revenueMillions[row][column] * 1_000_000 })));

export const coPurchaseFixture: CoPurchasePair[] = [
  { productA: "Gel bí đao rửa mặt", productB: "Toner bí đao", bothCount: 23, confidence: 0.68 },
  { productA: "Tẩy da chết cà phê Đắk Lắk", productB: "Bơ dưỡng thể cà phê", bothCount: 17, confidence: 0.54 },
  { productA: "Nước sen Hậu Giang", productB: "Kem dưỡng sen", bothCount: 12, confidence: 0.41 },
  { productA: "Nước dưỡng tóc bưởi", productB: "Dầu gội bưởi", bothCount: 11, confidence: 0.39 },
  { productA: "Sữa dưỡng hoa hồng Cao Bằng", productB: "Toner hoa hồng", bothCount: 8, confidence: 0.33 },
];

export const insightsFixture: ReportInsight[] = [
  { id: "coffee", icon: "coffee", eyebrow: "Vùng nguyên liệu Đắk Lắk", title: "Hạt cà phê thuần chay", body: "Chiếm 48% danh mục ưu tiên mua lặp lại của nhóm khách hàng thành thị 25–34 tuổi." },
  { id: "winter-melon", icon: "leaf", eyebrow: "Bí đao tiên phong", title: "Làm sạch dịu nhẹ & giảm dầu", body: "Điểm đánh giá 4,6/5 với 68% khách hàng mua kèm toner bí đao." },
  { id: "response", icon: "clock", eyebrow: "Chỉ số vận hành CRM", title: "Tỷ lệ giữ chân khách thuần chay", body: "Thời gian phản hồi bình quân còn 32 phút, tỷ lệ phản hồi ≤ 2 sao giảm còn 4,2% trong tháng." },
];
