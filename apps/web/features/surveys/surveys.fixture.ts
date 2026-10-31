// Static data for M7/M8 until GET surveys, GET preferences, GET products?status=Upcoming and GET surveys/{id} are wired up. Delete when api.ts lands.
import type { PreferenceOption, SurveyDraft, SurveyListItem, UpcomingProduct } from "./types";

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

export const surveysFixture: SurveyListItem[] = [
  { id: 81, title: "Khảo sát mức độ hài lòng về gel bí đao rửa mặt", purpose: "Satisfaction", status: "Open", openAt: "2026-10-15T00:00:00+07:00", closeAt: "2026-10-30T23:59:59+07:00", questionCount: 5, recipientCount: 28, responseCount: 19 },
  { id: 82, title: "Khảo sát sản phẩm mới: Kem dưỡng ẩm hoa hồng", purpose: "NewProduct", status: "Open", openAt: "2026-10-20T00:00:00+07:00", closeAt: "2026-11-04T23:59:59+07:00", questionCount: 4, recipientCount: 35, responseCount: 12 },
  { id: 75, title: "Thói quen chống nắng hằng ngày và kết cấu mong đợi", purpose: "Other", status: "Closed", openAt: "2026-09-01T00:00:00+07:00", closeAt: "2026-09-15T23:59:59+07:00", questionCount: 6, recipientCount: 50, responseCount: 45 },
  { id: 83, title: "Nghiên cứu mặt nạ nghệ Hưng Yên", purpose: "NewProduct", status: "Draft", openAt: "2026-11-01T00:00:00+07:00", closeAt: "2026-11-15T23:59:59+07:00", questionCount: 3, recipientCount: 0, responseCount: 0 },
  { id: 71, title: "Đánh giá mùi hương và hiệu quả nước dưỡng tóc bưởi", purpose: "Satisfaction", status: "Closed", openAt: "2026-08-05T00:00:00+07:00", closeAt: "2026-08-20T23:59:59+07:00", questionCount: 5, recipientCount: 40, responseCount: 38 },
  { id: 84, title: "Nhu cầu dung tích lớn (bản tiết kiệm 310ml – 500ml)", purpose: "Other", status: "Draft", openAt: null, closeAt: null, questionCount: 2, recipientCount: 0, responseCount: 0 },
];
