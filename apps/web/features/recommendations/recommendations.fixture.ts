// Static data for M13/M14 until reports/recommendations, recommendation-plans and GET products are wired up. Delete when api.ts lands.
import type { SegmentFilterValue } from "@/components/data/segment-filter-builder";
import type { PlanProduct, RecommendationPlan, RecommendationStats, TopProduct, WeeklyInteraction } from "./types";

export const planProductsFixture: PlanProduct[] = [
  { id: 1, name: "Gel rửa mặt bí đao 140ml", categoryName: "Làm sạch", preferences: ["Da dầu mụn", "Làm sạch dịu nhẹ"] },
  { id: 2, name: "Tinh chất bí đao 7% Niacinamide", categoryName: "Dưỡng da", preferences: ["Da dầu mụn"] },
  { id: 3, name: "Nước sen Hậu Giang 150ml", categoryName: "Toner", preferences: ["Da nhạy cảm", "Dưỡng ẩm"] },
  { id: 4, name: "Tẩy da chết cà phê Đắk Lắk 200ml", categoryName: "Tẩy da chết", preferences: ["Thuần chay"] },
  { id: 5, name: "Mặt nạ bí đao giảm mụn 100ml", categoryName: "Dưỡng da", preferences: ["Da dầu mụn"] },
  { id: 6, name: "Dầu tẩy trang nghệ Hưng Yên 150ml", categoryName: "Làm sạch", preferences: ["Làm sạch dịu nhẹ"] },
  { id: 7, name: "Kem dưỡng ẩm hoa hồng 50ml", categoryName: "Dưỡng da", preferences: ["Da khô", "Dưỡng ẩm"] },
  { id: 8, name: "Nước dưỡng tóc tinh dầu bưởi 140ml", categoryName: "Chăm sóc tóc", preferences: ["Chăm sóc tóc"] },
];

const segment = (patch: Partial<SegmentFilterValue>): SegmentFilterValue => ({ ageMin: null, ageMax: null, genders: [], preferenceIds: [], purchasedCategoryIds: [], lastPurchaseWithinDays: null, excludeLowRatedCategoryIds: [], ...patch });

export const plansFixture: RecommendationPlan[] = [
  { id: 101, name: "Gợi ý chu trình làm sạch cho da dầu mụn", goal: "Ưu tiên dòng bí đao cho khách da dầu mụn", status: "Active", startAt: "2026-10-15T00:00:00+07:00", endAt: "2026-11-15T23:59:59+07:00", segment: segment({ preferenceIds: [1], lastPurchaseWithinDays: 90 }), productIds: [1, 2, 3], recipientCount: 28, clickRate: 0.214 },
  { id: 102, name: "Bộ dưỡng phục hồi sau nắng hè", goal: "Gợi ý kèm mặt nạ và kem dưỡng cho khách đã mua dưỡng da", status: "Active", startAt: "2026-10-01T00:00:00+07:00", endAt: "2026-11-10T23:59:59+07:00", segment: segment({ purchasedCategoryIds: [4] }), productIds: [5, 7, 3], recipientCount: 42, clickRate: 0.162 },
  { id: 103, name: "Thử nghiệm đề xuất biến thể dung tích lớn", goal: "Đo mức quan tâm tới bản dung tích lớn", status: "Draft", startAt: "2026-11-15T00:00:00+07:00", endAt: "2026-12-15T23:59:59+07:00", segment: segment({ ageMin: 25, ageMax: 44, lastPurchaseWithinDays: 180 }), productIds: [4, 1], recipientCount: 0, clickRate: null },
  { id: 98, name: "Làm mới chu trình tóc mùa thu", goal: null, status: "Ended", startAt: "2026-08-01T00:00:00+07:00", endAt: "2026-09-30T23:59:59+07:00", segment: segment({ preferenceIds: [7] }), productIds: [8], recipientCount: 40, clickRate: 0.183 },
];

export const recommendationStatsFixture: RecommendationStats = { coverage: 0.826, clickRate: 0.178, dismissRate: 0.042, lastBuiltAt: "2026-10-21T09:00:00+07:00" };

export const weeklyInteractionsFixture: WeeklyInteraction[] = [
  { week: "Tuần 1", interactions: 1240 }, { week: "Tuần 2", interactions: 1580 }, { week: "Tuần 3", interactions: 1820 }, { week: "Tuần 4", interactions: 2100 },
];

export const topProductsFixture: TopProduct[] = [
  { id: 1, name: "Gel rửa mặt bí đao 140ml", tag: "Da dầu mụn", clicks: 428 },
  { id: 3, name: "Nước sen Hậu Giang 150ml", tag: "Da nhạy cảm", clicks: 315 },
  { id: 4, name: "Tẩy da chết cà phê Đắk Lắk 200ml", tag: "Thuần chay", clicks: 290 },
  { id: 8, name: "Nước dưỡng tóc tinh dầu bưởi 140ml", tag: "Chăm sóc tóc", clicks: 210 },
  { id: 7, name: "Kem dưỡng ẩm hoa hồng 50ml", tag: "Dưỡng ẩm", clicks: 185 },
];
