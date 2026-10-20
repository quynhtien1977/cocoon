# Cocoon CRM: Thiết kế giao diện, CSDL, API và phân công nhóm

- Ngày tạo: 15/10/2026. Cập nhật: 17/10/2026, lấy trải nghiệm khách hàng làm trọng tâm, thêm đơn hàng và gợi ý sản phẩm.
- Phạm vi: đồ án HTTTDN 841065, phần **II.2 Giao diện Admin** và **III.4 Mô phỏng hệ thống CRM**
- Mốc chấm: tuần 10–11 (09/11/2026 – 22/11/2026). Code đóng băng ngày 08/11/2026.
- Trạng thái: chờ review spec bản cập nhật

## 1. Mục tiêu và tiêu chí thành công

Hệ thống CRM của Cocoon xoay quanh **khách hàng**. Khách đăng nhập để xem sản phẩm đã mua, đánh giá sản phẩm, làm khảo sát và nhận gợi ý sản phẩm hợp sở thích. Phía doanh nghiệp, Manager tiếp nhận phản hồi, tạo khảo sát (kể cả thăm dò trước khi ra mắt sản phẩm mới), phân tích khách hàng và lập kế hoạch gợi ý. Giao diện lấy cảm hứng từ nhận diện của cocoonvietnam.com. Nhóm 4 người chia việc theo tầng kỹ thuật.

Thành công khi:

1. Mọi chức năng trong bảng yêu cầu dưới đây chạy được end-to-end trên dữ liệu seed.
2. Từ trang chủ, khách đi được ba luồng chính mà không cần hướng dẫn: đánh giá sản phẩm đã mua, làm khảo sát đang chờ, xem gợi ý.
3. Mỗi gợi ý sản phẩm hiển thị được lý do bằng lời ("Hợp với sở thích Da dầu"). Manager xem được bảng điểm chi tiết của từng gợi ý.
4. Admin có shell và điều hướng tách biệt khỏi Manager/Staff (đề II.2).
5. Mỗi màn hình chụp được ảnh và có mô tả cho mục "Thiết kế giao diện" (5đ) của báo cáo.
6. Mọi cặp màu chữ/nền đạt WCAG 2.2 AA (bảng ở mục 4.2).
7. Mỗi thành viên có phần việc độc lập, đo được để chấm % khối lượng.

| Mã | Yêu cầu | Màn hình | Role | Ưu tiên |
|---|---|---|---|---|
| II.2 | Admin thêm, xóa, phân quyền account | A1, A2 | Admin | A |
| 4.1.1 | Thêm khách hàng mới | M3 | Manager | A |
| 4.1.2 | Xóa khách hàng | M4 | Manager | A |
| 4.1.3 | Khóa tài khoản khách hàng | M4 | Manager | A |
| 4.1.4 | Tiếp nhận phản hồi | M5, M6 (+ S1, S2) | Manager, Staff | A |
| 4.1.5 | Báo cáo khách hàng: độ tuổi, sở thích | M1 (tab Báo cáo KH) | Manager | A |
| 4.1.6 | Tạo khảo sát, gửi đến tài khoản khách hàng | M8, M9 | Manager | A |
| 4.1.7 | Thống kê kết quả khảo sát | M10 | Manager | A |
| 4.3.1, 4.3.8 | Đăng ký, đăng nhập | U2, U3 | Customer | A |
| 4.3.2 | Chỉnh sửa thông tin | C1 | Customer | A |
| 4.3.3 | Gửi phản hồi về sản phẩm | C0, C2, C3, C4, C5 | Customer | A |
| 4.3.4 | Nhận và thực hiện khảo sát | C0, C6, C7 | Customer | A |
| Mục tiêu 4 | Thăm dò khách khi chuẩn bị ra mắt sản phẩm mới | M8 (khảo sát gắn sản phẩm `Upcoming`), M10 | Manager | A |
| Mở rộng R1 | Gợi ý sản phẩm theo sở thích, lịch sử mua và phản hồi | C0, C8, C9, M4 (tab Gợi ý) | Customer, Manager | B |
| Mở rộng R2 | Phân tích và lập kế hoạch gợi ý theo phân khúc | M1 (tab Phân tích), M13, M14 | Manager | B |
| Mở rộng R3 | Gắn tag sở thích cho sản phẩm | M11, M12 | Manager | B |

**Ưu tiên A** là phần đề chấm, làm xong trước. **Ưu tiên B** là điểm khác biệt, làm ở T3. Nếu trễ lịch, cắt theo thứ tự M14 → M13 → M12; giữ gợi ý tự động ở C0/C8 vì chỉ cần engine và một API.

## 2. Quyết định đã chốt

| Chủ đề | Quyết định | Lý do |
|---|---|---|
| Trọng tâm sản phẩm | Cổng khách hàng là "mặt tiền": trang chủ khách gom ba việc (đánh giá, khảo sát, gợi ý) | Theo yêu cầu cập nhật 17/10 |
| Hướng thương hiệu | **Lai (B)**: back-office dùng sidebar màu mực, nền kem, card trắng bo 4px; cổng khách hàng và public dùng ngôn ngữ thuần Cocoon (góc vuông, serif) | Bảng dày đặc cần ranh giới rõ; phía khách cần cảm xúc thương hiệu |
| Dữ liệu mua hàng | Thêm `Order`, `OrderItem`. Dữ liệu seed mô phỏng lịch sử mua từ các kênh bán. Khách chỉ xem, không đặt hàng trên cổng | Gợi ý cần lịch sử mua; giỏ hàng và thanh toán nằm ngoài phạm vi CRM |
| Phản hồi gắn đơn hàng | Khách chỉ đánh giá được sản phẩm đã mua (đơn `Completed`), mỗi dòng đơn một phản hồi. Phản hồi hiển thị nhãn "Đã mua" | Phản hồi thật, chống spam, có `OrderItemId` để phân tích |
| Thuật toán gợi ý | **Chấm điểm lai**, giải thích được (mục 7) | Chạy bằng SQL và C#, không cần mô hình học máy, trình bày dễ trong báo cáo |
| ERD vs code | **Giữ schema code** (`Account.Role` + `CustomerProfile`/`StaffProfile`), chỉ thêm bảng. ERD báo cáo được sửa theo mục 5.2 | Migration `InitialCreate` và test schema đã chạy |
| Chia việc | Theo **tầng kỹ thuật**: 2 FE, 1 BE, 1 DB+QA+báo cáo | Theo lựa chọn của nhóm |
| Mock API | Không dùng MSW. FE dựng UI tĩnh với `*.fixture.ts`, rồi nối API khi BE bàn giao | Giảm công cụ phải học |
| Dark mode | Bỏ. Xóa khối `.dark` trong `globals.css` | Đề không yêu cầu |
| Staff portal | Giữ (2 màn) | Domain đã có `FeedbackAssignment`; luồng tiếp nhận phản hồi đầy đủ khi demo |

## 3. Nhận diện tham chiếu (đo từ cocoonvietnam.com ngày 15/10/2026)

| Thuộc tính | Giá trị đo được |
|---|---|
| Nền | `#FEFBF4` (kem), `#FCFBF8` |
| Chữ chính | `#1F1C17` (mực), `#414548` |
| Viền | `#E7E5DF` |
| Vàng logo | `#C5A25D`; biến thể `#CCB48F`, `#D39746` |
| Be | `#EDE0CC` |
| Màu chiến dịch | hồng sen `#EF7B9A`, san hô `#FF6561` |
| Font | Nunito (nội dung, nav 16px/700), Vollkorn (serif hiển thị), Barlow Condensed (nhãn viết HOA) |
| Hình khối | Nút và nav không bo góc (0px); viền mảnh; thanh thông báo nền mực phía trên |

Chỉ lấy màu, font và nhịp bố cục. Không sao chép logo raster, ảnh sản phẩm hay copy marketing của trang. Logo trong app là wordmark chữ "cocoon" dựng bằng Barlow Condensed màu vàng. Ảnh sản phẩm trong seed dùng ảnh giữ chỗ (khối màu theo danh mục và tên sản phẩm).

## 4. Design system

### 4.1 Token màu (`apps/web/app/globals.css`, khối `:root`)

Giữ tên biến của shadcn để component có sẵn tự nhận màu.

```css
:root {
  --background: #FEFBF4;          /* kem */
  --foreground: #1F1C17;          /* mực */
  --card: #FFFFFF;
  --card-foreground: #1F1C17;
  --popover: #FFFFFF;
  --popover-foreground: #1F1C17;
  --primary: #1F1C17;
  --primary-foreground: #FEFBF4;
  --secondary: #EDE0CC;           /* be */
  --secondary-foreground: #1F1C17;
  --muted: #F4F1EA;
  --muted-foreground: #6B6760;
  --accent: #F4F1EA;
  --accent-foreground: #1F1C17;
  --destructive: #B33A32;
  --border: #E7E5DF;              /* trang trí, không dùng cho viền input */
  --input: #8F8A80;               /* viền control, đạt 3:1 */
  --ring: #8A6A2B;                /* vàng đậm, focus ring */
  --radius: 0.25rem;

  --gold: #C5A25D;                /* chỉ trang trí, logo, chỉ báo active trên nền mực */
  --gold-strong: #8A6A2B;         /* khi vàng phải làm chữ trên nền sáng */

  --sidebar: #1F1C17;
  --sidebar-foreground: #FEFBF4;
  --sidebar-primary: #C5A25D;
  --sidebar-primary-foreground: #1F1C17;
  --sidebar-accent: #2E2A23;
  --sidebar-accent-foreground: #FEFBF4;
  --sidebar-border: #3A352D;
  --sidebar-ring: #C5A25D;
  --sidebar-muted: #B8B6AF;

  /* trạng thái: nền tint / chữ */
  --status-lotus-bg: #FCE8EE;    --status-lotus-fg: #A3324F;
  --status-turmeric-bg: #FBF0DF; --status-turmeric-fg: #8A5A14;
  --status-sage-bg: #E8F0E6;     --status-sage-fg: #3D6338;
  --status-beige-bg: #EDE0CC;    --status-beige-fg: #6B5530;
  --status-gray-bg: #EFEDE8;     --status-gray-fg: #55524C;
  --status-danger-bg: #FBE9E7;   --status-danger-fg: #B33A32;

  /* chart: thứ tự cố định theo series */
  --chart-1: #C5A25D;  /* vàng */
  --chart-2: #EF7B9A;  /* sen */
  --chart-3: #4F7A4A;  /* lá */
  --chart-4: #D39746;  /* nghệ */
  --chart-5: #6B6760;  /* xám ấm */
}

[data-portal="customer"] { --radius: 0rem; }
```

Khai báo thêm trong `@theme inline`: `--color-gold`, `--color-gold-strong`, `--color-sidebar-muted` và các `--color-status-*`, để Tailwind có class `bg-status-lotus-bg`, `text-gold-strong`...

### 4.2 Contrast đã kiểm (tính theo công thức WCAG 2.2)

| Cặp | Tỷ lệ | Ngưỡng | Kết quả |
|---|---|---|---|
| Mực trên kem | 16.43 | 4.5 | Đạt |
| `muted-foreground` trên kem / trắng | 5.44 / 5.62 | 4.5 | Đạt |
| Kem trên mực (nút chính) | 16.43 | 4.5 | Đạt |
| Mực trên be (nút phụ) | 13.05 | 4.5 | Đạt |
| `gold-strong` trên kem | 4.86 | 4.5 | Đạt |
| Vàng trên mực (mục sidebar active) | 7.03 | 4.5 | Đạt |
| `sidebar-muted` trên mực | 8.37 | 4.5 | Đạt |
| `--input` trên trắng (viền control) | 3.43 | 3.0 | Đạt |
| Trắng trên `destructive` | 5.89 | 4.5 | Đạt |
| 5 cặp badge trạng thái (fg trên bg) | 5.24–6.65 | 4.5 | Đạt |
| Vàng `#C5A25D` trên kem | 2.34 | 3.0 | **Không đạt.** Vì vậy ring dùng `#8A6A2B`, vàng gốc không bao giờ làm chữ hoặc focus trên nền sáng |

Các tỷ lệ trên chỉ tính trên giá trị token. Khi lên giao diện thật, contrast, trạng thái focus, kích thước vùng chạm và responsive phải kiểm trên trình duyệt ở bước QA của P4. Máy hiện chưa cài browser cho các gate render, nên các mục đó **chưa đo**.

### 4.3 Typography

Tải bằng `next/font/google` với `subsets: ["latin", "vietnamese"]` trong `app/layout.tsx`, thay cho Geist.

| Biến | Font | Dùng cho |
|---|---|---|
| `--font-sans` | Nunito 400/600/700 | Toàn bộ UI, bảng, form |
| `--font-heading` | Vollkorn 400/500 | `h1` tiêu đề trang, lời chào và tiêu đề section ở cổng khách hàng |
| `--font-label` | Barlow Condensed 500, `uppercase`, `tracking-wide` | Eyebrow, nhãn KPI, nhãn section, chip lý do gợi ý |

Thang cỡ chữ:
- **Back-office:** body 14px, bảng 14px, `h1` 28px Vollkorn, nhãn KPI 13px Barlow.
- **Cổng khách hàng:** body 16px, `h1` 40px Vollkorn (dưới 640px giảm còn 32px), tiêu đề section 24px Vollkorn.

### 4.4 Mật độ và lưới

- **Back-office:** sidebar 248px (thu còn icon 64px khi dưới 1024px, dạng `Sheet` khi dưới 768px); nội dung tối đa 1280px, padding 24px; dòng bảng 44px.
- **Cổng khách hàng:** topnav cao 64px kiểu Cocoon (logo ở giữa; trái: Trang chủ, Đơn hàng, Gợi ý; phải: Khảo sát có badge số chờ, Phản hồi, avatar), thanh thông báo nền mực phía trên; nội dung tối đa 1080px; lưới sản phẩm 4 cột ≥ 1024px, 2 cột < 768px.
- **Khoảng cách:** thang Tailwind mặc định, chỉ dùng 1, 2, 3, 4, 6, 8, 12.

### 4.5 Component dùng chung

| Component | Vị trí | Chủ | Ghi chú |
|---|---|---|---|
| `Logo` | `components/brand` | P1 | Wordmark "cocoon" + "CRM", hai biến thể: trên kem, trên mực |
| `BackofficeShell` | `components/shell` | P1 | Nhận `nav: NavItem[]`, `variant: "admin" \| "manager" \| "staff"`. Admin có nhãn "ADMIN CONSOLE" và nav riêng |
| `CustomerShell` | `components/shell` | P1 | Topnav + footer, đặt `data-portal="customer"`, badge số khảo sát chờ |
| `PageHeader` | `components/brand` | P1 | eyebrow + `h1` + mô tả + vùng action |
| `StatTile` | `components/brand` | P1 | Nhãn Barlow + số + chênh lệch |
| `StatusBadge` | `components/brand` | P1 | Map enum → màu (mục 4.6) |
| `EmptyState` | `components/brand` | P1 | Tiêu đề, một dòng mô tả, CTA |
| `ConfirmDialog` | `components/brand` | P1 | Dùng cho xóa, khóa; nút hành động dùng `destructive` |
| `RatingInput` / `RatingStars` | `components/brand` | P1 | Nhập 1–5 bằng chuột và phím mũi tên; bản chỉ đọc hiển thị điểm TB |
| `ProductCard` | `components/brand` | P1 | Ảnh vuông, tên, giá thấp nhất, sao TB; slot `reason` cho `ReasonChip`; slot action |
| `ReasonChip` | `components/brand` | P1 | Chip Barlow nền be, tối đa 2 chip/thẻ |
| `SurveyStepper` | `features/surveys` | P1 | Một câu một bước, thanh tiến độ, Quay lại/Tiếp, màn xem lại trước khi gửi |
| `FeedbackThread` | `components/brand` | P1 | Dòng thời gian trạng thái + nội dung khách + trả lời của staff; dùng ở C5, M6 và S2 |
| `DataTable` | `components/data` | P1 | Tìm kiếm, sắp xếp, lọc, phân trang qua URL search params; skeleton, empty, error |
| `ChartCard` | `components/data` | P2 | Bọc Recharts, màu lấy từ `--chart-*`, có bảng số liệu thay thế cho trình đọc màn hình |
| `SegmentFilterBuilder` | `components/data` | P2 | Bộ lọc phân khúc (tuổi, giới tính, sở thích, danh mục đã mua, mua gần đây, đã đánh giá thấp). Dùng chung cho M9 gửi khảo sát và M14 kế hoạch gợi ý; hiện số khách khớp |
| `ScoreBreakdown` | `features/recommendations` | P2 | Thanh ngang 6 thành phần điểm (mục 7.2) |
| `QuestionEditor` | `features/surveys` | P2 | Một khối cho 4 loại `QuestionType`; mỗi lựa chọn gắn được một sở thích |

Primitive đã có trong `components/ui`: badge, button, card, dropdown-menu, separator, sheet, skeleton, table, tabs. Cần thêm qua `npx shadcn add`: input, label, textarea, select, checkbox, radio-group, dialog, alert-dialog, form, sonner (toast), avatar, popover, command (chọn sản phẩm), progress, pagination, slider (khoảng tuổi), toggle-group (chip sở thích).

### 4.6 Bảng màu trạng thái

| Enum | Giá trị → token |
|---|---|
| `FeedbackStatus` | New → lotus, Accepted → beige, Assigned → turmeric, Replied → sage, Closed → gray |
| `SurveyStatus` | Draft → gray, Open → sage, Closed → beige |
| `RecipientStatus` | NotDone → turmeric, Done → sage |
| `OrderStatus` | Completed → sage, Cancelled → gray, Returned → turmeric |
| `ProductStatus` | Active → sage, Upcoming → lotus ("Sắp ra mắt"), Inactive → gray |
| `RecommendationPlanStatus` | Draft → gray, Active → sage, Ended → beige |
| Tài khoản | Active → sage, Locked (`LockoutEnd` > now hoặc `IsActive=false`) → danger |
| `AccountRole` | Admin → mực đặc, Manager → beige, Staff → gray, Customer → lotus |

Badge luôn có chữ, không chỉ dùng màu để truyền nghĩa.

### 4.7 Ngôn ngữ giao diện

Viết tiếng Việt, câu ngắn, động từ đứng đầu ở nút ("Đánh giá sản phẩm", "Làm khảo sát", "Gửi khảo sát"). Lỗi trình bày theo dạng "chuyện gì xảy ra + làm gì tiếp", lấy từ `ApiError.message` sẵn có. Không dùng "Vui lòng" ở nhãn nút. Ở cổng khách hàng, xưng "bạn"; lời chào dùng tên gọi (phần cuối `FullName`).

## 5. Cơ sở dữ liệu

### 5.1 Hiện trạng

Migration `InitialCreate` đã có 23 entity trong `src/Cocoon.Domain/Entities`. Bản cập nhật **giữ nguyên các bảng cũ**, thêm 5 bảng, sửa 4 bảng và 1 enum qua một migration mới `AddOrdersAndRecommendations` (P3 viết, P4 review). Sau khi chạy, xuất lại `db/schema.sql` theo README.

### 5.2 Ánh xạ ERD báo cáo → bảng thật

ERD hiện tại của nhóm khớp phần lớn với code. Bảng dưới là căn cứ để vẽ lại ERD cho báo cáo (P4).

| Thực thể trong ERD | Bảng thật | Ghi chú khi vẽ lại ERD |
|---|---|---|
| ACCOUNT (AccountID, username, password_hash, email, status) | `Account` | Đăng nhập bằng `Email`, bỏ `username`. `status` = `IsActive` + `LockoutEnd`. Thêm thuộc tính `Role` |
| ADMIN, MANAGER, STAFF | `Account` (`Role`) + `StaffProfile` (`FullName`, `Phone`, `Position`) | Gộp ADMIN, MANAGER, STAFF thành một thực thể STAFF_PROFILE nối 1–1 với ACCOUNT. `department` của MANAGER đổi thành `Position` |
| CUSTOMER (fullname, DOB, gender, hobby) | `CustomerProfile` | `hobby` tách thành quan hệ N–N CUSTOMER — PREFERENCE (`CustomerPreference`) |
| MANAGE (Manager–Staff) | Không lưu | Bỏ khỏi ERD; Manager giao việc qua FEEDBACK_ASSIGNMENT |
| PRODUCT (name, description, category, status) | `Product` + `Category` | `category` thành thực thể CATEGORY (1–N). Thêm quan hệ N–N PRODUCT — PREFERENCE (`ProductPreference`) |
| PRODUCT_VARIANT (quantity, size, price, imageURL) | `ProductVariant` | `size` → `Name` (ví dụ "140ml"). Bỏ `quantity`: tồn kho không thuộc CRM |
| FEEDBACK (content, rating, status, createdAt) | `Feedback` | Thêm quan hệ với ORDER_ITEM (đánh giá sau mua) |
| RESPONSE (text, createAt), WRITTEN BY Staff | `FeedbackReply` | Đổi tên thành FEEDBACK_REPLY để không trùng với khảo sát |
| *(chưa có)* | `FeedbackAssignment` | Thêm: Manager giao phản hồi cho Staff |
| SURVEY (title, status), CREATE bởi Manager | `Survey` | Thêm `Purpose`, `OpenAt`, `CloseAt`, quan hệ tùy chọn với PRODUCT (khảo sát ra mắt sản phẩm) |
| SURVEY_QUESTION (text) | `SurveyQuestion` + `QuestionOption` | Thêm `Type`, `IsRequired`, `SortOrder`; thực thể QUESTION_OPTION |
| SURVEY_SUBMITION (submittedAt), DO, SUBMIT | `SurveyResponse` | Một lần nộp của một khách cho một khảo sát |
| SURVEY_RESPONSE (text), RESPONSE | `SurveyAnswer` | Câu trả lời cho một câu hỏi: `OptionId` / `NumericValue` / `TextValue` |
| *(chưa có)* | `SurveyRecipient` | Thêm: khảo sát được gửi tới khách nào, đã làm chưa |
| *(chưa có)* | `Order`, `OrderItem` | Thêm: lịch sử mua hàng |
| *(chưa có)* | `Recommendation`, `RecommendationPlan`, `RecommendationPlanProduct` | Thêm: gợi ý và kế hoạch gợi ý |
| *(chưa có)* | `Notification` | Thêm: thông báo trong app |
| *(không vẽ)* | `ActivityLog` | Bảng có sẵn trong schema nhưng chưa dùng (audit log tạm bỏ, mục 10); không đưa vào ERD báo cáo |

### 5.3 Bảng mới

**`Order`**: đơn hàng (dữ liệu seed, chỉ đọc qua API)

| Cột | Kiểu | Ràng buộc |
|---|---|---|
| `Id` | int | PK |
| `Code` | varchar(20) | unique, dạng `CO-2026-000123` |
| `CustomerId` | int | FK → `CustomerProfile.AccountId` |
| `Channel` | enum `OrderChannel` { Website, Store, Marketplace } | |
| `Status` | enum `OrderStatus` { Completed, Cancelled, Returned } | |
| `TotalAmount` | numeric(12,0) | = tổng `OrderItem`, đơn vị VND |
| `OrderedAt` | timestamptz | index (`CustomerId`, `OrderedAt` desc) |

**`OrderItem`**: dòng đơn hàng

| Cột | Kiểu | Ràng buộc |
|---|---|---|
| `Id` | int | PK |
| `OrderId` | int | FK → `Order` (Restrict như mọi FK, giữ lịch sử) |
| `ProductVariantId` | int | FK → `ProductVariant`, index |
| `Quantity` | int | > 0 |
| `UnitPrice` | numeric(12,0) | giá tại thời điểm mua |

**`Recommendation`**: gợi ý đã tính cho từng khách

| Cột | Kiểu | Ràng buộc |
|---|---|---|
| `Id` | int | PK |
| `CustomerId` | int | FK, index (`CustomerId`, `Status`) |
| `ProductId` | int | FK |
| `Score` | numeric(5,4) | 0–1 |
| `Breakdown` | jsonb | `{ "preference": 0.24, "survey": 0.1, "category": 0.12, "coPurchase": 0.06, "rating": 0.08, "plan": 0.1 }` |
| `Reasons` | jsonb | mảng tối đa 2 phần tử `{ "code": "PREFERENCE", "label": "Hợp với sở thích Da dầu" }` |
| `PlanId` | int? | FK → `RecommendationPlan` khi điểm có thành phần kế hoạch |
| `Status` | enum `RecommendationStatus` { Active, Clicked, Dismissed, Expired } | |
| `GeneratedAt` | timestamptz | |
| `InteractedAt` | timestamptz? | |

Unique (`CustomerId`, `ProductId`) cho các dòng `Active`, dùng partial index `WHERE "Status" = 'Active'`. Khi tính lại, dòng `Active` cũ chuyển `Expired`. Dòng `Dismissed` giữ nguyên để không gợi ý lại sản phẩm đó trong 90 ngày.

**`RecommendationPlan`**: kế hoạch gợi ý của Manager

| Cột | Kiểu | Ràng buộc |
|---|---|---|
| `Id` | int | PK |
| `Name` | varchar(120) | |
| `Goal` | text? | mục tiêu, ví dụ "Đẩy dòng sen Hậu Giang cho khách da nhạy cảm" |
| `Segment` | jsonb | bộ lọc phân khúc, cùng schema với `SegmentFilter` (mục 6.3) |
| `Status` | enum `RecommendationPlanStatus` { Draft, Active, Ended } | |
| `StartAt`, `EndAt` | timestamptz | `EndAt` > `StartAt` |
| `CreatedBy` | int | FK → `Account` |
| `CreatedAt` | timestamptz | |

**`RecommendationPlanProduct`**: sản phẩm thuộc kế hoạch. PK (`PlanId`, `ProductId`), có `SortOrder`.

### 5.4 Bảng sửa

| Bảng | Thay đổi | Lý do |
|---|---|---|
| `Feedback` | Thêm `OrderItemId int?` FK, unique khi khác null | Một dòng đơn chỉ đánh giá một lần; nhãn "Đã mua". Phản hồi do Manager nhập hộ có thể để null |
| `CustomerPreference` | Thêm `Source` enum `PreferenceSource` { Declared, Survey } và `CreatedAt` | Phân biệt sở thích khách tự chọn với sở thích suy ra từ khảo sát |
| `QuestionOption` | Thêm `PreferenceId int?` FK | Khách chọn lựa chọn này thì ghi nhận sở thích tương ứng (`Source = Survey`) |
| `Survey` | Thêm `ProductId int?` FK | Khảo sát `Purpose = NewProduct` gắn sản phẩm sắp ra mắt |
| `ProductStatus` (enum) | Thêm `Upcoming` | Sản phẩm sắp ra mắt: hiện trong khảo sát, không xuất hiện trong gợi ý |

### 5.5 Đối tượng SQL hỗ trợ phân tích (P4 viết, nằm trong migration dạng raw SQL)

| Đối tượng | Nội dung |
|---|---|
| `mv_product_copurchase` (materialized view) | Cặp (`ProductA`, `ProductB`, `BothCount`, `ACount`, `Confidence = BothCount / ACount`) tính trên khách có đơn `Completed`; chỉ giữ cặp có `BothCount ≥ 3` |
| `v_customer_category_affinity` (view) | (`CustomerId`, `CategoryId`, `Share`) = tỷ lệ số lượng sản phẩm khách mua thuộc danh mục trong 12 tháng |
| `v_product_rating` (view) | (`ProductId`, `AvgRating`, `FeedbackCount`) trên phản hồi chưa bị xóa |
| `v_customer_low_rated_category` (view) | Danh mục mà khách có điểm TB ≤ 2 |

`POST recommendations/rebuild` chạy `REFRESH MATERIALIZED VIEW mv_product_copurchase` trước khi tính điểm.

### 5.6 Luật nghiệp vụ ở tầng dữ liệu và service

1. **Phản hồi:** chỉ tạo khi `OrderItem` thuộc đơn của chính khách, đơn ở trạng thái `Completed`, và dòng đơn đó chưa có phản hồi.
2. **Trạng thái phản hồi:** đi một chiều New → Accepted → Assigned → Replied → Closed. Manager có thể đóng từ Accepted hoặc Replied.
3. **Khảo sát:** chỉ sửa khi `Draft`. Chỉ nhận câu trả lời khi `Open`, trong khung `OpenAt`–`CloseAt`, và khách có trong `SurveyRecipient`. Mỗi khách nộp một lần.
4. **Sở thích từ khảo sát:** khi nộp khảo sát, mỗi `SurveyAnswer` có `OptionId` trỏ tới lựa chọn có `PreferenceId` thì thêm `CustomerPreference` với `Source = Survey`, nếu khách chưa có sở thích đó.
5. **Kế hoạch gợi ý:** chỉ sửa khi `Draft`. Kích hoạt thì tạo `Notification` (Type `recommendation`) cho khách khớp phân khúc và tính lại gợi ý cho nhóm khách đó.
6. **Xóa:** xóa mềm khách hàng (`Account.IsDeleted`); đơn hàng và phản hồi giữ lại cho báo cáo, tên hiển thị thành "Khách đã xóa".

## 6. API (`/api/v1`)

### 6.1 Quy ước

- **Định dạng:** JSON camelCase. Thời gian theo ISO 8601 UTC; FE hiển thị giờ Việt Nam.
- **Phân trang:** `?page=1&pageSize=20&search=&sort=field:asc&status=`, trả `{ items, total, page, pageSize }`.
- **Lỗi:** theo ProblemDetails (đã có), `code` là mã máy đọc được, ví dụ `FEEDBACK_ALREADY_EXISTS`, `SURVEY_NOT_OPEN`, `ORDER_NOT_COMPLETED`.
- **Phân quyền:** policy theo role ở controller. Endpoint `me/*` luôn lấy `AccountId` từ token, không nhận id khách qua URL.

### 6.2 Danh sách endpoint

**Auth và hồ sơ** (P3, ưu tiên A)

| Method + đường dẫn | Role | Mô tả |
|---|---|---|
| `POST auth/register` | public | Đăng ký khách hàng |
| `POST auth/login`, `auth/refresh`, `auth/logout` | public | Cookie JWT + refresh một lần (client đã có) |
| `GET/PUT me` | mọi role | Hồ sơ của chính mình |
| `GET preferences` | mọi role | Danh sách sở thích đang hoạt động |
| `GET/PUT me/preferences` | Customer | Sở thích tự chọn (`Source = Declared`) |

**Cổng khách hàng** (P3; ưu tiên A trừ các dòng gợi ý và thông báo)

| Method + đường dẫn | Mô tả | Ưu tiên |
|---|---|---|
| `GET me/home` | Gộp cho C0: `pendingSurveys` (tối đa 3), `reviewableItems` (tối đa 4), `recommendations` (tối đa 4), `unreadNotifications` | A (phần gợi ý trả mảng rỗng cho tới T3) |
| `GET me/orders`, `GET me/orders/{id}` | Đơn hàng của tôi; mỗi dòng có `feedbackId` nếu đã đánh giá | A |
| `GET me/reviewable-items` | Dòng đơn `Completed` chưa có phản hồi | A |
| `GET me/feedback`, `GET me/feedback/{id}` | Phản hồi của tôi, kèm lịch sử trạng thái và trả lời | A |
| `POST me/feedback` | Body `{ orderItemId, rating, content }`; `content` 20–1000 ký tự | A |
| `GET me/surveys` | Hộp khảo sát: `?status=NotDone\|Done` | A |
| `GET me/surveys/{id}` | Đề khảo sát (câu hỏi, lựa chọn) | A |
| `POST me/surveys/{id}/responses` | Body `{ answers: [{ questionId, optionIds?, numericValue?, textValue? }] }` | A |
| `GET products/{id}` | Chi tiết sản phẩm: biến thể, `avgRating`, `feedbackCount`, tag sở thích | A |
| `GET me/recommendations` | Gợi ý `Active`, sắp theo `score`, kèm `reasons` | B |
| `POST me/recommendations/{id}/click`, `.../dismiss` | Ghi tương tác | B |
| `GET me/notifications`, `POST me/notifications/{id}/read` | Thông báo trong app | B |

**Staff** (P3, A)

| Method + đường dẫn | Mô tả |
|---|---|
| `GET staff/feedback` | Phản hồi được giao cho tôi |
| `POST feedback/{id}/replies` | Trả lời; trạng thái chuyển `Replied` |

**Manager** (P3)

| Method + đường dẫn | Mô tả | Ưu tiên |
|---|---|---|
| `GET/POST customers`, `GET customers/{id}` | Danh sách, thêm, chi tiết | A |
| `POST customers/{id}/lock`, `.../unlock`, `DELETE customers/{id}` | Khóa, mở khóa, xóa mềm | A |
| `GET customers/{id}/orders`, `.../feedback`, `.../surveys` | Tab trong M4 | A |
| `GET customers/{id}/recommendations` | Gợi ý kèm `breakdown` | B |
| `GET feedback`, `GET feedback/{id}` | Hộp phản hồi, lọc `status`, `rating`, `productId`, `categoryId` | A |
| `POST feedback/{id}/accept`, `.../assign` (body `{ staffId }`), `.../close` | Chuyển trạng thái | A |
| `GET/POST surveys`, `GET/PUT/DELETE surveys/{id}` | Quản lý khảo sát; body câu hỏi gồm lựa chọn và `preferenceId` | A |
| `POST surveys/{id}/publish`, `.../close` | Mở, đóng | A |
| `POST segments/preview` | Body `SegmentFilter` → `{ count, sample: [5 khách] }` | A (dùng cho M9) |
| `POST surveys/{id}/recipients` | Body `SegmentFilter` hoặc `{ customerIds }`; tạo `SurveyRecipient` + `Notification` | A |
| `GET surveys/{id}/results` | Tỷ lệ hoàn thành, phân bố từng câu, điểm TB câu Rating, danh sách câu trả lời ngắn | A |
| `GET products`, `PATCH products/{id}/status`, `PUT products/{id}/preferences` | Danh sách sản phẩm, đổi trạng thái, gắn tag sở thích | B |
| `GET products/{id}/insights` | Điểm TB theo tháng, sản phẩm hay mua cùng, phân bố khách mua theo tuổi | B |
| `GET/POST recommendation-plans`, `GET/PUT/DELETE recommendation-plans/{id}` | Kế hoạch gợi ý | B |
| `POST recommendation-plans/{id}/activate`, `.../end` | Kích hoạt, kết thúc | B |
| `POST recommendations/rebuild` | Tính lại gợi ý cho mọi khách (đồng bộ, dự kiến < 5 giây với dữ liệu seed) | B |

**Báo cáo** (P3 tích hợp, SQL do P4 viết)

| Method + đường dẫn | Mô tả | Ưu tiên |
|---|---|---|
| `GET reports/overview` | Tổng khách, khách mới 30 ngày, phản hồi mới, điểm TB, khảo sát đang mở | A |
| `GET reports/customers/age`, `.../gender`, `.../preferences` | Báo cáo khách hàng (đề 4.1.5) | A |
| `GET reports/feedback/ratings` | Điểm TB theo danh mục, theo tháng; tỷ lệ phản hồi tiêu cực (≤ 2 sao) | A |
| `GET reports/purchases/categories` | Doanh số theo danh mục × nhóm tuổi | B |
| `GET reports/recommendations` | Độ phủ, tỷ lệ bấm, tỷ lệ bỏ qua, top sản phẩm được gợi ý, theo kế hoạch | B |

**Admin** (P3, A)

| Method + đường dẫn | Mô tả |
|---|---|
| `GET/POST admin/accounts` | Danh sách (lọc role, trạng thái), tạo tài khoản |
| `PATCH admin/accounts/{id}/role`, `.../status`, `DELETE admin/accounts/{id}` | Phân quyền, khóa, xóa mềm |

### 6.3 Payload chính

```jsonc
// SegmentFilter: dùng cho segments/preview, surveys/{id}/recipients, RecommendationPlan.Segment
{
  "ageMin": 18, "ageMax": 34,               // null = không giới hạn
  "genders": ["Nữ"],                         // rỗng = mọi giới tính
  "preferenceIds": [3, 7],                   // khách có ít nhất một sở thích trong danh sách
  "purchasedCategoryIds": [2],               // đã từng mua danh mục
  "lastPurchaseWithinDays": 90,              // null = bỏ qua
  "excludeLowRatedCategoryIds": [2]          // loại khách từng chấm ≤ 2 sao cho danh mục
}

// GET me/recommendations → items[]
{
  "id": 812, "score": 0.71,
  "product": { "id": 14, "name": "Nước sen Hậu Giang", "minPrice": 185000, "imageUrl": null, "avgRating": 4.6 },
  "reasons": [
    { "code": "PREFERENCE", "label": "Hợp với sở thích Da nhạy cảm" },
    { "code": "CO_PURCHASE", "label": "Khách mua Sữa rửa mặt sen cũng mua" }
  ]
}

// POST me/surveys/{id}/responses
{ "answers": [
  { "questionId": 41, "optionIds": [102] },              // SingleChoice
  { "questionId": 42, "optionIds": [105, 107] },         // MultiChoice
  { "questionId": 43, "numericValue": 4 },               // Rating 1–5
  { "questionId": 44, "textValue": "Mùi hương dễ chịu" } // ShortText
] }
```

## 7. Phân tích và gợi ý sản phẩm

### 7.1 Luồng tổng thể

1. **Thu thập:** sở thích khách tự chọn (C1), sở thích suy ra từ khảo sát (luật 5.6.4), lịch sử mua (`Order`), điểm đánh giá (`Feedback`).
2. **Phân tích (Manager, M1 tab Phân tích):** sở thích phổ biến theo nhóm tuổi; danh mục bán chạy theo nhóm tuổi; điểm TB và tỷ lệ phản hồi tiêu cực theo danh mục; cặp sản phẩm hay mua cùng.
3. **Lập kế hoạch (M14):** Manager chọn phân khúc bằng `SegmentFilterBuilder`, chọn sản phẩm muốn đẩy, đặt thời gian. Xem trước số khách khớp rồi kích hoạt.
4. **Tính điểm:** engine chấm điểm mọi cặp (khách, sản phẩm ứng viên) theo 7.2, lưu top 6 vào `Recommendation`.
5. **Hiển thị:** C0 (4 gợi ý), C8 (toàn bộ), M4 tab Gợi ý (kèm `ScoreBreakdown`).
6. **Đo lường (M13):** độ phủ, tỷ lệ bấm, tỷ lệ bỏ qua, theo kế hoạch. Dữ liệu tương tác lấy từ `click`/`dismiss`.

### 7.2 Công thức chấm điểm

Sản phẩm ứng viên cho khách *c*: `Status = Active`, chưa xóa, khách chưa mua trong 60 ngày, chưa bị khách `Dismissed` trong 90 ngày, không thuộc danh mục trong `v_customer_low_rated_category` của khách, và khách chưa từng chấm sản phẩm này ≤ 2 sao.

```
score(c, p) = 0.30 · Pref + 0.15 · Survey + 0.20 · Category + 0.15 · CoPurchase + 0.10 · Rating + 0.10 · Plan
```

| Thành phần | Cách tính (mỗi thành phần nằm trong 0–1) | Nhãn lý do |
|---|---|---|
| `Pref` | Số tag của *p* trùng sở thích `Declared` của *c* ÷ số tag của *p* | "Hợp với sở thích {tên sở thích}" |
| `Survey` | Như trên, với sở thích `Source = Survey` | "Từ câu trả lời khảo sát của bạn" |
| `Category` | `Share` của danh mục *p* trong `v_customer_category_affinity` | "Bạn hay chọn {danh mục}" |
| `CoPurchase` | Max `Confidence` trong `mv_product_copurchase` giữa *p* và các sản phẩm *c* đã mua | "Khách mua {sản phẩm} cũng mua" |
| `Rating` | (`AvgRating` − 1) ÷ 4; nếu `FeedbackCount` < 3 thì lấy 0.5 | "Được đánh giá {x}/5" |
| `Plan` | 1 nếu *p* thuộc kế hoạch `Active` mà *c* khớp `Segment`, ngược lại 0 | "{Tên kế hoạch}" |

Chỉ lưu sản phẩm có `score ≥ 0.25`, tối đa 6 sản phẩm mỗi khách. Lý do hiển thị là 2 thành phần có tích (trọng số × giá trị) lớn nhất. Trọng số đặt trong `appsettings.json` (mục `Recommendation:Weights`) để nhóm chỉnh khi demo, không cần sửa code.

Ví dụ cho báo cáo: khách 24 tuổi, sở thích "Da dầu", đã mua 3 lần danh mục "Làm sạch", đang thuộc kế hoạch "Ra mắt gel bí đao". Gel bí đao được Pref 1.0, Survey 0, Category 0.6, CoPurchase 0.4, Rating 0.9, Plan 1, nên score = 0.30 + 0 + 0.12 + 0.06 + 0.09 + 0.10 = **0.67**. Hai đóng góp lớn nhất là Pref (0.30) và Category (0.12), nên lý do hiển thị: "Hợp với sở thích Da dầu", "Bạn hay chọn Làm sạch". Khi hai thành phần bằng nhau, ưu tiên theo thứ tự trong bảng trên.

### 7.3 Khi nào tính lại

- Manager bấm "Tính lại gợi ý" ở M13: tính cho mọi khách.
- Kích hoạt hoặc kết thúc kế hoạch: tính cho khách khớp phân khúc.
- Khách lưu sở thích, nộp khảo sát hoặc gửi phản hồi: tính cho riêng khách đó, ngay trong request.

Không dùng job nền hay hàng đợi. Với dữ liệu seed (khoảng 80–100 khách, 24–30 sản phẩm), tính đồng bộ là đủ.

### 7.4 Kiểm thử engine (P3)

Viết unit test cho `RecommendationScorer` với dữ liệu dựng tay:
- Đúng từng thành phần điểm.
- Loại sản phẩm `Upcoming`, sản phẩm bị dismiss, danh mục bị chấm thấp.
- Chọn đúng 2 lý do có đóng góp lớn nhất.
- Bỏ sản phẩm có score dưới ngưỡng 0.25.

## 8. Kiến trúc frontend và danh sách màn hình

### 8.1 Route groups (`apps/web/app`), 31 màn

```
app/
  (public)/                   layout: PublicShell (brand thuần)
    page.tsx                  U1 Landing: giới thiệu CRM, CTA Đăng nhập / Đăng ký
    login/page.tsx            U2 Đăng nhập (mọi role, chuyển hướng theo role)
    register/page.tsx         U3 Đăng ký: thông tin + chọn sở thích ban đầu (bước 2)
  (customer)/account/         layout: CustomerShell
    page.tsx                  C0 Trang chủ khách hàng
    profile/page.tsx          C1 Hồ sơ và sở thích
    orders/page.tsx           C2 Đơn hàng của tôi (mở rộng từng đơn, nút "Đánh giá" mỗi dòng)
    feedback/page.tsx         C3 Phản hồi của tôi
    feedback/new/page.tsx     C4 Gửi phản hồi (?orderItemId=)
    feedback/[id]/page.tsx    C5 Chi tiết phản hồi + trả lời của Cocoon
    surveys/page.tsx          C6 Hộp khảo sát (Chờ làm | Đã làm)
    surveys/[id]/page.tsx     C7 Làm khảo sát (SurveyStepper)
    recommendations/page.tsx  C8 Gợi ý cho bạn
    products/[id]/page.tsx    C9 Chi tiết sản phẩm
  (staff)/staff/              layout: BackofficeShell variant=staff
    feedback/page.tsx         S1 Phản hồi được giao
    feedback/[id]/page.tsx    S2 Chi tiết + trả lời
  (manager)/manager/          layout: BackofficeShell variant=manager
    page.tsx                  M1 Dashboard (tab Tổng quan | Báo cáo khách hàng | Phân tích)
    customers/page.tsx        M2 Danh sách khách hàng
    customers/new/page.tsx    M3 Thêm khách hàng
    customers/[id]/page.tsx   M4 Chi tiết khách (tab Hồ sơ | Đơn hàng | Phản hồi | Khảo sát | Gợi ý); Khóa / Xóa
    feedback/page.tsx         M5 Hộp phản hồi
    feedback/[id]/page.tsx    M6 Tiếp nhận → giao → đóng
    surveys/page.tsx          M7 Danh sách khảo sát
    surveys/new, surveys/[id]/edit   M8 Trình tạo khảo sát
    surveys/[id]/send/        M9 Chọn phân khúc và gửi
    surveys/[id]/results/     M10 Kết quả khảo sát
    products/page.tsx         M11 Sản phẩm (lọc trạng thái, danh mục, chưa gắn tag)
    products/[id]/page.tsx    M12 Chi tiết sản phẩm: tag sở thích, trạng thái, insights
    recommendations/page.tsx  M13 Tổng quan gợi ý + danh sách kế hoạch + "Tính lại gợi ý"
    recommendations/plans/new, plans/[id]   M14 Soạn kế hoạch gợi ý
  (admin)/admin/              layout: BackofficeShell variant=admin
    page.tsx                  A1 Tài khoản (lọc role, trạng thái; xóa; đổi role)
    accounts/new/page.tsx     A2 Tạo tài khoản + gán role
```

`proxy.ts` giữ matcher hiện có (`/account`, `/staff`, `/manager`, `/admin`) và chuyển hướng về `/login` khi thiếu cookie hoặc sai role. Backend policy vẫn là nguồn sự thật.

### 8.2 Đặc tả màn trọng tâm: cổng khách hàng

| Màn | Bố cục | Hành vi chính | Trạng thái rỗng |
|---|---|---|---|
| **C0 Trang chủ** | Lời chào Vollkorn "Chào {tên}," + một dòng tóm tắt. Ba section xếp dọc, mỗi section có eyebrow Barlow và link "Xem tất cả": (1) **Khảo sát đang chờ**: tối đa 3 thẻ ngang (tiêu đề, số câu, hạn, nút "Làm khảo sát"); (2) **Sản phẩm chờ bạn đánh giá**: tối đa 4 `ProductCard` có nút "Đánh giá"; (3) **Gợi ý cho bạn**: 4 `ProductCard` có `ReasonChip` | Một lần gọi `GET me/home`. Thứ tự section cố định để khách quen mắt | Section rỗng thì ẩn. Cả ba rỗng thì hiện `EmptyState` "Bạn đã cập nhật hết", CTA "Cập nhật sở thích" |
| **C1 Hồ sơ** | Hai cột: form thông tin (họ tên, SĐT, ngày sinh, giới tính, địa chỉ, đồng ý xử lý dữ liệu) và lưới chip sở thích (`toggle-group`) | Lưu riêng từng khối; lưu sở thích thì tính lại gợi ý | Chưa chọn sở thích: dòng nhắc "Chọn sở thích để nhận gợi ý hợp hơn" |
| **C2 Đơn hàng** | Danh sách đơn (mã, ngày, kênh, tổng tiền, badge trạng thái), mở rộng thấy dòng sản phẩm | Dòng thuộc đơn `Completed` chưa đánh giá có nút "Đánh giá" → C4; đã đánh giá thì hiện sao và link "Xem phản hồi" → C5 | "Chưa có đơn hàng nào được ghi nhận" |
| **C3 Phản hồi của tôi** | Danh sách thẻ: ảnh sản phẩm, sao, trích nội dung, badge trạng thái, ngày | Bấm thẻ → C5 | "Bạn chưa gửi phản hồi nào", CTA → C2 |
| **C4 Gửi phản hồi** | Thẻ sản phẩm đã chọn (khóa, lấy từ `orderItemId`), `RatingInput` lớn, textarea có đếm ký tự, nút "Gửi đánh giá" | Kiểm tra 20–1000 ký tự ở client và server; gửi xong toast "Đã gửi đánh giá" → C5 | Không có `orderItemId` hợp lệ: chuyển về C2 kèm thông báo |
| **C5 Chi tiết phản hồi** | `FeedbackThread`: các bước trạng thái dạng dòng thời gian ngang, nội dung khách, trả lời của Cocoon (tên staff, thời gian) | Chỉ đọc | Chưa có trả lời: "Cocoon đã nhận phản hồi và sẽ trả lời sớm" |
| **C6 Hộp khảo sát** | Tabs Chờ làm / Đã làm; thẻ có badge mục đích (Hài lòng / Sản phẩm mới), hạn đóng | Thẻ khảo sát sản phẩm mới hiện tên sản phẩm `Upcoming` và nhãn "Sắp ra mắt" | "Hiện chưa có khảo sát nào" |
| **C7 Làm khảo sát** | `SurveyStepper`: một câu một màn, thanh tiến độ "Câu 3/8", nút Quay lại / Tiếp; màn cuối xem lại toàn bộ câu trả lời rồi "Gửi khảo sát" | Câu bắt buộc chưa trả lời thì báo lỗi ngay dưới câu, không cho sang câu tiếp. Câu trả lời giữ trong state; rời trang thì hỏi xác nhận | Khảo sát đóng hoặc đã làm: thông báo và nút về C6 |
| **C8 Gợi ý** | Lưới `ProductCard`, mỗi thẻ 1–2 `ReasonChip` và nút "Không quan tâm" | Bấm thẻ ghi `click` rồi mở C9; "Không quan tâm" ghi `dismiss`, thẻ biến mất kèm toast có "Hoàn tác" | "Chọn thêm sở thích để Cocoon gợi ý hợp hơn", CTA → C1 |
| **C9 Chi tiết sản phẩm** | Ảnh vuông, tên Vollkorn, danh mục, biến thể (dung tích, giá), sao TB và số đánh giá, công dụng, thành phần, cách dùng; chip sở thích phù hợp | Nếu khách đã mua và chưa đánh giá thì có nút "Đánh giá sản phẩm" | Sản phẩm `Inactive`: "Sản phẩm tạm ngừng kinh doanh" |

### 8.3 Đặc tả màn Manager mới hoặc thay đổi

| Màn | Nội dung |
|---|---|
| **M1 Dashboard** | Tab **Tổng quan**: 5 `StatTile` (tổng khách, khách mới 30 ngày, phản hồi mới, điểm TB, khảo sát đang mở) + biểu đồ phản hồi theo tuần. Tab **Báo cáo khách hàng**: cột nhóm tuổi, tròn giới tính, cột ngang top sở thích (đề 4.1.5). Tab **Phân tích**: điểm TB theo danh mục, tỷ lệ phản hồi ≤ 2 sao theo tháng, heatmap danh mục × nhóm tuổi theo doanh số, bảng top cặp sản phẩm mua cùng |
| **M4 Chi tiết khách** | Thêm tab Đơn hàng (bảng đơn), Khảo sát (đã nhận / đã làm), Gợi ý (danh sách gợi ý hiện tại + `ScoreBreakdown` + trạng thái bấm/bỏ qua) |
| **M8 Trình tạo khảo sát** | Thêm trường Mục đích; nếu là "Sản phẩm mới" thì chọn sản phẩm `Upcoming`. Mỗi lựa chọn câu SingleChoice / MultiChoice có ô tùy chọn "Gắn sở thích" |
| **M9 Gửi khảo sát** | `SegmentFilterBuilder` + số khách khớp + 5 khách mẫu; hoặc chọn tay từ bảng khách |
| **M10 Kết quả** | Tỷ lệ hoàn thành (đã làm / đã gửi), mỗi câu một `ChartCard` (cột cho lựa chọn, phân bố sao cho Rating, danh sách cho ShortText) |
| **M11 Sản phẩm** | `DataTable`: tên, danh mục, trạng thái, số tag, điểm TB, số phản hồi; lọc "Chưa gắn tag" |
| **M12 Chi tiết sản phẩm** | Chọn tag sở thích (lưu bằng `PUT products/{id}/preferences`), đổi trạng thái (Active / Upcoming / Inactive), insights: điểm TB theo tháng, sản phẩm hay mua cùng, nhóm tuổi khách mua |
| **M13 Gợi ý** | `StatTile`: độ phủ (% khách có ≥ 1 gợi ý), tỷ lệ bấm, tỷ lệ bỏ qua, số kế hoạch đang chạy. Bảng top sản phẩm được gợi ý. Bảng kế hoạch (tên, trạng thái, thời gian, số khách, tỷ lệ bấm). Nút "Tính lại gợi ý" (hiện thời điểm tính gần nhất) |
| **M14 Soạn kế hoạch** | Ba bước: (1) tên, mục tiêu, thời gian; (2) phân khúc bằng `SegmentFilterBuilder`, xem trước số khách; (3) chọn và sắp xếp sản phẩm (`command` tìm sản phẩm). Lưu nháp hoặc "Kích hoạt" (qua `ConfirmDialog`, nêu số khách sẽ nhận thông báo) |

### 8.4 Module tính năng (`apps/web/features`)

```
features/<module>/
  api.ts        React Query hooks gọi lib/api/client.ts, query key dạng ["customers", params]
  schemas.ts    zod schema cho form, suy từ types OpenAPI
  components/   component riêng module
  *.fixture.ts  dữ liệu mẫu cho giai đoạn UI tĩnh, xóa khi nối API
```

Có 11 module: `auth`, `profile`, `home`, `orders`, `accounts`, `customers`, `feedback`, `surveys`, `products`, `recommendations`, `reports`. Module `home` chỉ chứa C0 và hook `useHome`.

Quy tắc phụ thuộc:
- `app/**` chỉ import từ `features/**` và `components/**`.
- `features/A` không import `features/B`. Thứ gì dùng chung (ví dụ `ProductCard`, `FeedbackThread`, `SegmentFilterBuilder`) thì đưa lên `components/`.

### 8.5 Hợp đồng FE ↔ BE

1. P3 viết controller và DTO trước, có thể trả `501` ở phần thân, để `/swagger/v1/swagger.json` có đủ schema từ T1. Endpoint ưu tiên B có stub ngay từ T2.
2. FE chạy `npm run api:types` (`openapi-typescript http://localhost:5080/swagger/v1/swagger.json -o lib/api/schema.d.ts`) và commit file sinh ra.
3. Đổi contract phải mở PR gắn cả P1 và P2 làm reviewer.
4. Lỗi trả về theo ProblemDetails. FE map `errors` vào field của react-hook-form và map `code` sang câu tiếng Việt trong `lib/api/messages.ts`.

### 8.6 Trạng thái màn hình

Mọi màn có dữ liệu phải có đủ: loading (skeleton theo hình nội dung), empty (`EmptyState`), error (thông báo + "Thử lại"), success (toast). Hành động phá hủy (xóa, khóa, kích hoạt kế hoạch) luôn qua `ConfirmDialog`, nêu rõ đối tượng và hệ quả. Không dùng nút bị disable thay cho thông báo lỗi.

## 9. Phân công nhóm (theo tầng)

| Người | Vai trò | Sở hữu | Đầu ra cho báo cáo |
|---|---|---|---|
| **P1** | FE lead, cổng khách hàng | Token, font, `globals.css`; shell cho 5 route group; `components/brand` (gồm `ProductCard`, `ReasonChip`, `RatingInput`, `FeedbackThread`), `DataTable`, `SurveyStepper`; `proxy.ts`; U1–U3; **C0–C9**; A1–A2 | Mục "Thiết kế giao diện": design system và cổng khách hàng |
| **P2** | FE back-office | M1–M14, S1–S2; `ChartCard`, `SegmentFilterBuilder`, `ScoreBreakdown`, `QuestionEditor`; script `api:types` | Mục "Thiết kế giao diện": back-office và phân tích |
| **P3** | Backend | Migration `AddOrdersAndRecommendations`; controller và service mục 6.2; luật mục 5.6; `RecommendationScorer` + `RecommendationService` (mục 7); auth, khóa tài khoản; test API và unit test engine | Mục "Thiết kế CSDL" (phần bảng), "Cài đặt", mô tả thuật toán gợi ý |
| **P4** | DB + QA + Báo cáo | View và materialized view mục 5.5; SQL cho `reports/*`; seed (mục 9.1); vẽ lại ERD theo mục 5.2; sơ đồ chức năng, ngữ cảnh, DFD mức đỉnh; bảng khảo sát HTTT ≥ 15 câu; test thủ công theo checklist; chụp 31 màn; hướng dẫn cài đặt và sử dụng; `readme.txt` | Phần I của báo cáo (40đ) |

### 9.1 Dữ liệu seed (P4)

Seed phải đủ để gợi ý cho kết quả có ý nghĩa khi demo:

- **Tài khoản demo** theo README, mật khẩu `Demo@12345`.
- **Sở thích:** 10–12 mục, ví dụ Da dầu, Da khô, Da nhạy cảm, Mụn, Thâm nám, Tóc gãy rụng, Mùi thảo mộc, Thuần chay, Chống nắng, Dưỡng thể.
- **Sản phẩm:** ≥ 24 sản phẩm thuộc 5–6 danh mục, mỗi sản phẩm 1–3 biến thể và 2–3 tag sở thích. Có ≥ 2 sản phẩm `Upcoming`.
- **Khách hàng:** ≥ 80, rải đủ các nhóm tuổi và giới tính, mỗi khách 2–4 sở thích.
- **Đơn hàng:** ≥ 300 đơn trải trong 12 tháng. Tạo theo quy luật: khách thường mua sản phẩm có tag trùng sở thích (khoảng 70%); cố ý tạo vài cặp hay mua cùng (ví dụ sữa rửa mặt sen + nước sen) để `mv_product_copurchase` có dữ liệu.
- **Phản hồi:** ≥ 60, đủ 5 trạng thái, có cả phản hồi ≤ 2 sao để kiểm tra luật loại danh mục.
- **Khảo sát:** ≥ 3 (một hài lòng, một sản phẩm mới gắn sản phẩm `Upcoming`, một khác), có lựa chọn gắn sở thích, ≥ 40 lượt nộp.
- **Kế hoạch gợi ý:** 1 kế hoạch `Active`, 1 `Draft`.

Seed chạy bằng lệnh idempotent, ví dụ `dotnet run --project src/Cocoon.Api -- seed`, hoặc script SQL `db/seed.sql`. Không xóa dữ liệu ngoài phạm vi seed.

### 9.2 Timeline

| Tuần | P1 | P2 | P3 | P4 |
|---|---|---|---|---|
| **T1** 15–21/10 | Token, font, shell, `DataTable`, badge, dialog, `ProductCard`; UI tĩnh U1–U3, C0, C2, C4 | UI tĩnh M1, M2, M5, M8 với fixture | Contract stub mọi controller ưu tiên A; Auth thật, `/me`; migration `AddOrdersAndRecommendations` | ERD cập nhật; seed v1 (tài khoản, sở thích, sản phẩm, khách, đơn hàng); sơ đồ phân tích |
| **T2** 22–28/10 | Nối Auth, `proxy.ts`, C0–C5, C9; A1–A2 | Nối M2–M6; S1–S2; UI tĩnh M9–M12 | Customers, Orders, Feedback, Products, `me/home`; stub endpoint ưu tiên B | Views mục 5.5; SQL báo cáo; seed v2 (phản hồi) |
| **T3** 29/10–04/11 | C6–C8, `SurveyStepper`; nối gợi ý ở C0 | M7–M10, M1 đủ 3 tab; M11–M14 | Surveys (gồm luật sở thích từ khảo sát), Reports, engine gợi ý + test, kế hoạch gợi ý | Seed v3 (khảo sát, kế hoạch); test luồng theo checklist; ghi bug |
| **T4** 05–08/11 | Sửa bug, rà responsive, chụp ảnh | Sửa bug, chụp ảnh | Sửa bug, xuất `db/schema.sql` | Hoàn thiện báo cáo (gồm mục thuật toán gợi ý), hướng dẫn, đóng gói nộp |

Thứ tự bàn giao của BE khớp thứ tự nối API của FE: Auth → Customers/Orders/Feedback/`me/home` → Surveys → Reports → Recommendations. Nếu một endpoint trễ quá 2 ngày, FE tiếp tục với fixture và báo trong kênh nhóm.

### 9.3 Quy ước làm việc

- **Branch:** `feat/<người>-<module>`. PR nhỏ theo màn hoặc theo endpoint, cần 1 reviewer. P1 review mọi thay đổi ở `components/**` và `globals.css`. P4 review mọi migration.
- **Commit:** Conventional Commits theo lịch sử repo (`feat(web): ...`, `feat(api): ...`, `feat(db): ...`).
- **Definition of done cho một màn:**
  - Đủ 4 trạng thái ở mục 8.6.
  - Không có màu hard-code; mọi màu lấy từ token.
  - Thao tác được bằng bàn phím.
  - `npm run lint` và `npm run typecheck` đều xanh.
  - Đã có ảnh chụp cho báo cáo.
- **Definition of done cho một endpoint:**
  - Có trong OpenAPI.
  - Có policy role.
  - Có test cho luồng chính và một lỗi phân quyền.
  - Có dữ liệu seed để demo.

## 10. Ngoài phạm vi

Không làm: giỏ hàng, đặt hàng, thanh toán trên cổng khách; tồn kho (`quantity` trong ERD); mô hình học máy hoặc huấn luyện; job nền / hàng đợi; dark mode; đa ngôn ngữ (chỉ tiếng Việt); email thật (thông báo dùng bảng `Notification` trong app); tải file / ảnh sản phẩm thật; quên mật khẩu qua email (bảng `PasswordResetToken` để dành cho sau); MSW; Storybook.

Tạm bỏ (quyết định 19/10/2026, làm lại khi cần):
- **Sao lưu và phục hồi CSDL:** không có script `pg_dump`/`pg_restore` và không có mục này trong báo cáo.
- **Audit log (nhật ký thao tác):** không có màn A3, không có endpoint `admin/activity-logs`, service không ghi vào bảng `ActivityLog`. Bảng vẫn giữ trong schema để khỏi phải viết thêm migration.

## 11. Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Phạm vi tăng từ 22 lên 31 màn | Chia ưu tiên A/B (mục 1); thứ tự cắt khi trễ: M14 → M13 → M12 |
| Đề mục II.1 yêu cầu "phương án sao lưu và phục hồi CSDL trong báo cáo" (5đ), nhưng phần này đang tạm bỏ | Nếu muốn lấy 5đ, viết lại trước T4: một script `pg_dump`/`pg_restore` và một trang trong báo cáo, khoảng 3 point cho P4 |
| Backend chỉ có 1 người, thêm engine gợi ý | P4 viết toàn bộ view và SQL phân tích; engine chỉ là truy vấn + cộng có trọng số; stub ưu tiên B từ T2 |
| Gợi ý vô nghĩa do seed ngẫu nhiên | Seed theo quy luật mục 9.1; demo bằng một khách được chuẩn bị sẵn kèm ví dụ ở 7.2 |
| ERD báo cáo lệch code | Vẽ lại ERD theo bảng 5.2 ngay T1, P3 xác nhận |
| FE bị chặn khi không có mock | Fixture cạnh component; FE luôn đi trước BE một module |
| `docs/PRD.md` và `docs/DECISIONS.md` mà README nhắc tới không có trong repo | P1 viết lại từ spec này trong T1, hoặc sửa link trong README |
| Next.js 16 khác bản cũ (`proxy.ts`, `LayoutProps`) | Đọc `node_modules/next/dist/docs/` trước khi viết route, theo `apps/web/AGENTS.md` |
| Font tiếng Việt lỗi dấu | Bắt buộc subset `vietnamese` cho cả 3 font; kiểm bằng chuỗi "Ữ ỹ ặ ẵ" trên mọi kiểu chữ |
