// Static data for M7/M8 until GET surveys, GET preferences, GET products?status=Upcoming and GET surveys/{id} are wired up. Delete when api.ts lands.
import type { PreferenceOption, QuestionResult, SurveyCandidate, SurveyDraft, SurveyListItem, UpcomingProduct } from "./types";

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
  { id: 81, title: "Khảo sát mức độ hài lòng về gel bí đao rửa mặt", purpose: "Satisfaction", status: "Open", openAt: "2026-10-15T00:00:00+07:00", closeAt: "2026-11-30T23:59:59+07:00", questionCount: 4, recipientCount: 28, responseCount: 19 },
  { id: 82, title: "Khảo sát sản phẩm mới: Kem dưỡng ẩm hoa hồng", purpose: "NewProduct", status: "Open", openAt: "2026-10-20T00:00:00+07:00", closeAt: "2026-11-04T23:59:59+07:00", questionCount: 2, recipientCount: 35, responseCount: 12 },
  { id: 75, title: "Thói quen chống nắng hằng ngày và kết cấu mong đợi", purpose: "Other", status: "Closed", openAt: "2026-09-01T00:00:00+07:00", closeAt: "2026-09-15T23:59:59+07:00", questionCount: 2, recipientCount: 50, responseCount: 45 },
  { id: 83, title: "Nghiên cứu mặt nạ nghệ Hưng Yên", purpose: "NewProduct", status: "Draft", openAt: "2026-11-01T00:00:00+07:00", closeAt: "2026-11-15T23:59:59+07:00", questionCount: 3, recipientCount: 0, responseCount: 0 },
  { id: 71, title: "Đánh giá mùi hương và hiệu quả nước dưỡng tóc bưởi", purpose: "Satisfaction", status: "Closed", openAt: "2026-08-05T00:00:00+07:00", closeAt: "2026-08-20T23:59:59+07:00", questionCount: 2, recipientCount: 40, responseCount: 38 },
  { id: 84, title: "Nhu cầu dung tích lớn (bản tiết kiệm 310ml – 500ml)", purpose: "Other", status: "Draft", openAt: null, closeAt: null, questionCount: 2, recipientCount: 0, responseCount: 0 },
];

/** Drafts for /manager/surveys/[id]/edit; only Draft rows of surveysFixture can be edited. */
const draftsById: Record<number, SurveyDraft> = {
  83: {
    title: "Nghiên cứu mặt nạ nghệ Hưng Yên",
    description: "Tìm hiểu thói quen đắp mặt nạ và mong đợi về kết cấu trước khi ra mắt mặt nạ nghệ.",
    purpose: "NewProduct",
    productId: 32,
    openAt: "2026-11-01",
    closeAt: "2026-11-15",
    questions: [
      { key: "q1", text: "Bạn đắp mặt nạ bao lâu một lần?", type: "SingleChoice", isRequired: true, options: [{ key: "q1o1", text: "Mỗi tuần", preferenceId: null }, { key: "q1o2", text: "Vài lần mỗi tháng", preferenceId: null }, { key: "q1o3", text: "Hiếm khi", preferenceId: null }] },
      { key: "q2", text: "Bạn mong đợi mặt nạ nghệ ở mức nào?", type: "Rating", isRequired: true, options: [] },
      { key: "q3", text: "Bạn muốn góp ý gì về kết cấu mặt nạ?", type: "ShortText", isRequired: false, options: [] },
    ],
  },
  84: {
    title: "Nhu cầu dung tích lớn (bản tiết kiệm 310ml – 500ml)",
    description: "",
    purpose: "Other",
    productId: null,
    openAt: "",
    closeAt: "",
    questions: [
      { key: "q1", text: "Bạn muốn sản phẩm nào có bản dung tích lớn?", type: "MultiChoice", isRequired: true, options: [{ key: "q1o1", text: "Gel rửa mặt", preferenceId: 5 }, { key: "q1o2", text: "Nước dưỡng tóc", preferenceId: 7 }] },
      { key: "q2", text: "Bạn thích dung tích nào hơn?", type: "SingleChoice", isRequired: true, options: [{ key: "q2o1", text: "310ml", preferenceId: null }, { key: "q2o2", text: "500ml", preferenceId: null }] },
    ],
  },
};

export const surveyDraftByIdFixture = (id: number): SurveyDraft | null => draftsById[id] ?? null;

export const segmentCategoriesFixture = [
  { id: 1, name: "Làm sạch" }, { id: 2, name: "Tẩy da chết" }, { id: 3, name: "Toner" }, { id: 4, name: "Dưỡng da" }, { id: 5, name: "Chăm sóc tóc" },
];

// Same names as the M2 customer fixture; features/surveys cannot import features/customers.
const people: [string, string | null, number | null][] = [
  ["Trúc Nguyễn", "Nữ", 26], ["Đặng Hoàng Lan", "Nữ", 23], ["Lê Minh Quân", "Nam", 29], ["Vũ Phương Thảo", "Nữ", 31],
  ["Trần Tuấn Anh", "Nam", 24], ["Phạm Ngọc Mai", "Nữ", 27], ["Hồ Gia Bảo", "Nam", 35], ["Nguyễn Thị Hạnh", "Nữ", 42],
  ["Bùi Khánh Linh", "Nữ", 19], ["Đỗ Quốc Huy", "Nam", 33], ["Lý Thanh Trúc", "Nữ", 28], ["Mai Anh Thư", "Nữ", 21],
  ["Phan Đức Long", "Nam", 47], ["Cao Bảo Ngọc", "Nữ", 25], ["Tạ Minh Châu", "Khác", 30], ["Võ Hải Yến", "Nữ", 38],
  ["Huỳnh Nhật Nam", "Nam", null], ["Trịnh Thu Hà", "Nữ", 52], ["Đinh Gia Hân", "Nữ", 22], ["Lâm Quang Vinh", "Nam", 27],
  ["Kiều Mỹ Duyên", null, 34], ["Ngô Bích Phương", "Nữ", 29], ["Dương Tấn Phát", "Nam", 41], ["Hà Linh Đan", "Nữ", 24],
];

export const surveyCandidatesFixture: SurveyCandidate[] = people.map(([fullName, gender, age], index) => ({
  id: 108 + index,
  code: `KH-${String(108 + index).padStart(4, "0")}`,
  fullName,
  email: `khach${108 + index}@example.com`,
  age,
  gender,
  preferenceIds: [1 + (index % 8), 1 + ((index * 3 + 2) % 8)],
  purchasedCategoryIds: index % 7 === 0 ? [] : [1 + (index % 5), 1 + ((index + 2) % 5)],
  lowRatedCategoryIds: index % 6 === 5 ? [1 + (index % 5)] : [],
  daysSinceLastOrder: index % 7 === 0 ? null : 12 + ((index * 23) % 200),
}));

const resultsById: Record<number, QuestionResult[]> = {
  81: [
    { kind: "SingleChoice", text: "Loại da hiện tại của bạn là gì?", answerCount: 19, options: [{ text: "Da hỗn hợp thiên dầu", count: 10 }, { text: "Da dầu", count: 6 }, { text: "Da nhạy cảm", count: 2 }, { text: "Da khô", count: 1 }] },
    { kind: "Rating", text: "Đánh giá cảm giác sạch thoáng, không khô căng sau khi rửa mặt:", answerCount: 19, average: 4.6, distribution: { 5: 13, 4: 5, 3: 1, 2: 0, 1: 0 } },
    { kind: "MultiChoice", text: "Đặc tính bạn hài lòng nhất ở sản phẩm:", answerCount: 19, options: [{ text: "Bọt mịn êm dịu", count: 15 }, { text: "Kiểm soát bã nhờn vùng chữ T", count: 14 }, { text: "Mùi tinh dầu tràm trà thư giãn", count: 12 }, { text: "Dễ rửa trôi với nước", count: 9 }] },
    { kind: "ShortText", text: "Ý kiến đóng góp về bao bì và dung tích:", answerCount: 3, answers: [
      { customerName: "Trúc Nguyễn", content: "Gel rửa mặt dùng rất thích, mong Cocoon ra mắt bản chai lớn 310ml hoặc 500ml để dùng tiết kiệm hơn." },
      { customerName: "Đặng Hoàng Lan", content: "Vòi nhấn tiện lợi, gel tạo bọt êm không cay mắt, nên giữ nguyên mùi tinh dầu tự nhiên này." },
      { customerName: "Lê Minh Quân", content: "Mong hãng ra thêm dạng túi refill thân thiện với môi trường." },
    ] },
  ],
  82: [
    { kind: "Rating", text: "Bạn mong đợi sản phẩm kem dưỡng hoa hồng ở mức nào?", answerCount: 12, average: 4.25, distribution: { 5: 5, 4: 5, 3: 2, 2: 0, 1: 0 } },
    { kind: "ShortText", text: "Bạn muốn góp ý gì về mùi hương và bao bì?", answerCount: 0, answers: [] },
  ],
  75: [
    { kind: "SingleChoice", text: "Bạn thoa kem chống nắng bao lâu một lần?", answerCount: 45, options: [{ text: "Mỗi ngày", count: 27 }, { text: "Khi ra ngoài", count: 15 }, { text: "Hiếm khi", count: 3 }] },
    { kind: "MultiChoice", text: "Bạn mong đợi kết cấu nào?", answerCount: 40, options: [{ text: "Mỏng nhẹ", count: 34 }, { text: "Không vệt trắng", count: 31 }, { text: "Nâng tông nhẹ", count: 8 }] },
  ],
  71: [
    { kind: "Rating", text: "Đánh giá mùi hương của nước dưỡng tóc bưởi:", answerCount: 38, average: 4.37, distribution: { 5: 20, 4: 13, 3: 4, 2: 1, 1: 0 } },
    { kind: "Rating", text: "Đánh giá hiệu quả giảm gãy rụng:", answerCount: 38, average: 3.95, distribution: { 5: 12, 4: 14, 3: 10, 2: 2, 1: 0 } },
  ],
};

export const surveyResultsFixture = (id: number): QuestionResult[] => resultsById[id] ?? [];
