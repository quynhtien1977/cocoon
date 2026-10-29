// Static data for M8 until GET preferences, GET products?status=Upcoming and GET surveys/{id} are wired up. Delete when api.ts lands.
import type { PreferenceOption, SurveyDraft, UpcomingProduct } from "./types";

export const preferencesFixture: PreferenceOption[] = [
  { id: 1, name: "Da dầu mụn" }, { id: 2, name: "Da nhạy cảm" }, { id: 3, name: "Da khô" }, { id: 4, name: "Da hỗn hợp" },
  { id: 5, name: "Làm sạch dịu nhẹ" }, { id: 6, name: "Dưỡng ẩm" }, { id: 7, name: "Chăm sóc tóc" }, { id: 8, name: "Thuần chay" },
];

export const upcomingProductsFixture: UpcomingProduct[] = [
  { id: 31, name: "Kem dưỡng ẩm hoa hồng Cao Bằng 50ml" },
  { id: 32, name: "Mặt nạ nghệ Hưng Yên 100ml" },
];

/** Existing draft shown at /manager/surveys/[id]/edit, mirroring the Stitch M8 mock. */
export const surveyDraftFixture: SurveyDraft = {
  title: "Khảo sát sản phẩm mới: Kem dưỡng ẩm hoa hồng",
  description: "Ghi nhận mong đợi về kết cấu, mùi hương và thói quen dưỡng ẩm ban đêm trước khi ra mắt kem dưỡng hoa hồng Cao Bằng.",
  purpose: "NewProduct",
  productId: 31,
  openAt: "2026-11-01",
  closeAt: "2026-11-15",
  questions: [
    {
      key: "q1", text: "Loại da hiện tại của bạn là gì?", type: "SingleChoice", isRequired: true,
      options: [
        { key: "q1o1", text: "Da dầu", preferenceId: 1 }, { key: "q1o2", text: "Da hỗn hợp thiên dầu", preferenceId: 4 },
        { key: "q1o3", text: "Da khô", preferenceId: 3 }, { key: "q1o4", text: "Da nhạy cảm", preferenceId: 2 },
      ],
    },
    {
      key: "q2", text: "Bạn ưu tiên công dụng nào nhất ở một loại kem dưỡng?", type: "MultiChoice", isRequired: true,
      options: [
        { key: "q2o1", text: "Khóa ẩm chuyên sâu", preferenceId: 6 }, { key: "q2o2", text: "Làm dịu mẩn đỏ", preferenceId: 2 },
        { key: "q2o3", text: "Thấm nhanh, không nhờn rít", preferenceId: null },
      ],
    },
    { key: "q3", text: "Bạn mong đợi sản phẩm kem dưỡng hoa hồng ở mức nào?", type: "Rating", isRequired: false, options: [] },
    { key: "q4", text: "Bạn muốn góp ý gì về mùi hương và bao bì?", type: "ShortText", isRequired: false, options: [] },
  ],
};
