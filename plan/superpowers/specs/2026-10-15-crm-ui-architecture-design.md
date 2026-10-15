# Cocoon CRM: Thiết kế giao diện, kiến trúc codebase và phân công nhóm

- Ngày: 15/10/2026
- Phạm vi: đồ án HTTTDN 841065, phần **II.2 Giao diện Admin** và **III.4 Mô phỏng hệ thống CRM**
- Mốc chấm: tuần 10–11 (09/11/2026 – 22/11/2026). Code đóng băng ngày 08/11/2026.
- Trạng thái: đã duyệt hội thoại, chờ review spec

## 1. Mục tiêu và tiêu chí thành công

Mục tiêu: dựng giao diện CRM cho bốn role (Admin, Manager, Staff, Customer). Giao diện lấy cảm hứng từ nhận diện của cocoonvietnam.com, đủ chức năng đề yêu cầu, và chia việc rõ cho nhóm 4 người theo tầng kỹ thuật.

Thành công khi:

1. Mọi chức năng trong bảng yêu cầu dưới đây chạy được end-to-end trên dữ liệu seed.
2. Admin có shell và điều hướng tách biệt khỏi Manager/Staff (đề II.2).
3. Mỗi màn hình chụp được ảnh và có mô tả cho mục "Thiết kế giao diện" (5đ) của báo cáo.
4. Mọi cặp màu chữ/nền đạt WCAG 2.2 AA (bảng ở mục 4.2).
5. Mỗi thành viên có phần việc độc lập, đo được để chấm % khối lượng.

| Mã | Yêu cầu đề | Màn hình | Role |
|---|---|---|---|
| II.2 | Admin thêm, xóa, phân quyền account | A1, A2 | Admin |
| 4.1.1 | Thêm khách hàng mới | M3 | Manager |
| 4.1.2 | Xóa khách hàng | M4 | Manager |
| 4.1.3 | Khóa tài khoản khách hàng | M4 | Manager |
| 4.1.4 | Tiếp nhận phản hồi | M5, M6 (+ S1, S2) | Manager, Staff |
| 4.1.5 | Báo cáo khách hàng: độ tuổi, sở thích | M1 (tab Báo cáo) | Manager |
| 4.1.6 | Tạo khảo sát, gửi đến tài khoản khách hàng | M8, M9 | Manager |
| 4.1.7 | Thống kê kết quả khảo sát | M10 | Manager |
| 4.3.1, 4.3.8 | Đăng ký, đăng nhập | U2, U3 | Customer |
| 4.3.2 | Chỉnh sửa thông tin | C1 | Customer |
| 4.3.3 | Gửi phản hồi về sản phẩm | C2, C3 | Customer |
| 4.3.4 | Nhận và thực hiện khảo sát | C4, C5 | Customer |

## 2. Quyết định đã chốt

| Chủ đề | Quyết định | Lý do |
|---|---|---|
| Hướng thương hiệu | **Lai (B)**: back-office dùng sidebar màu mực, nền kem, card trắng bo 4px; cổng khách hàng và trang public dùng ngôn ngữ thuần Cocoon (góc vuông, serif) | Bảng dày đặc cần độ tương phản và ranh giới rõ; phía khách hàng cần cảm xúc thương hiệu |
| Chia việc | Theo **tầng kỹ thuật**: 2 FE, 1 BE, 1 DB+QA+báo cáo | Theo lựa chọn của nhóm |
| Mock API | **Không dùng MSW.** FE dựng UI tĩnh trước, dữ liệu mẫu đặt cứng trong file `*.fixture.ts` cạnh component, rồi nối API khi BE bàn giao | Giảm công cụ phải học; thứ tự bàn giao BE được xếp khớp FE |
| Dark mode | **Bỏ.** Xóa khối `.dark` trong `globals.css` | Đề không yêu cầu; giảm một nửa công kiểm contrast |
| Staff portal | **Giữ** (2 màn) | Domain đã có `FeedbackAssignment`, `FeedbackStatus.Assigned`; luồng tiếp nhận phản hồi hoàn chỉnh hơn khi demo |

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

Chỉ lấy màu, font và nhịp bố cục. Không sao chép logo raster, ảnh sản phẩm hay copy marketing của trang. Logo trong app là wordmark chữ "cocoon" dựng bằng Barlow Condensed màu vàng.

## 4. Design system

### 4.1 Token màu (`apps/web/app/globals.css`, khối `:root`)

Giữ tên biến của shadcn để component có sẵn tự nhận màu. Viết giá trị hex để dễ đối chiếu với báo cáo.

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
  --status-lotus-bg: #FCE8EE;   --status-lotus-fg: #A3324F;
  --status-turmeric-bg: #FBF0DF; --status-turmeric-fg: #8A5A14;
  --status-sage-bg: #E8F0E6;    --status-sage-fg: #3D6338;
  --status-beige-bg: #EDE0CC;   --status-beige-fg: #6B5530;
  --status-gray-bg: #EFEDE8;    --status-gray-fg: #55524C;
  --status-danger-bg: #FBE9E7;  --status-danger-fg: #B33A32;

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
| `--font-heading` | Vollkorn 400/500 | `h1` tiêu đề trang, tiêu đề hero ở cổng khách hàng |
| `--font-label` | Barlow Condensed 500, `uppercase`, `tracking-wide` | Eyebrow, nhãn KPI, nhãn cột nhóm |

Thang cỡ chữ:
- **Back-office:** body 14px, bảng 14px, `h1` 28px Vollkorn, nhãn KPI 13px Barlow.
- **Cổng khách hàng:** body 16px, `h1` 40px Vollkorn (dưới 640px giảm còn 32px).

### 4.4 Mật độ và lưới

- **Back-office:** sidebar 248px (thu còn icon 64px khi dưới 1024px, dạng `Sheet` khi dưới 768px); nội dung tối đa 1280px, padding 24px; dòng bảng 44px.
- **Cổng khách hàng:** topnav cao 64px kiểu Cocoon (logo ở giữa, nav trái và phải), thanh thông báo nền mực phía trên; nội dung tối đa 1080px.
- **Khoảng cách:** thang Tailwind mặc định, chỉ dùng 1, 2, 3, 4, 6, 8, 12.

### 4.5 Component dùng chung

| Component | Vị trí | Chủ | Ghi chú |
|---|---|---|---|
| `Logo` | `components/brand` | P1 | Wordmark "cocoon" + "CRM", hai biến thể: trên kem, trên mực |
| `BackofficeShell` | `components/shell` | P1 | Nhận `nav: NavItem[]`, `variant: "admin" \| "manager" \| "staff"`. Admin có nhãn "ADMIN CONSOLE" và nav riêng |
| `CustomerShell` | `components/shell` | P1 | Topnav + footer, đặt `data-portal="customer"` |
| `PageHeader` | `components/brand` | P1 | eyebrow + `h1` + mô tả + vùng action |
| `StatTile` | `components/brand` | P1 | Nhãn Barlow + số + chênh lệch |
| `StatusBadge` | `components/brand` | P1 | Map enum → màu (mục 4.6) |
| `EmptyState` | `components/brand` | P1 | Tiêu đề, một dòng mô tả, CTA |
| `ConfirmDialog` | `components/brand` | P1 | Dùng cho xóa, khóa; nút hành động dùng `destructive` |
| `DataTable` | `components/data` | P1 | Tìm kiếm, sắp xếp, lọc, phân trang qua URL search params; hiển thị skeleton, empty và error |
| `ChartCard` | `components/data` | P2 | Bọc Recharts, màu lấy từ `--chart-*`, có bảng số liệu thay thế cho trình đọc màn hình |
| `QuestionEditor` | `features/surveys` | P2 | Một khối cho 4 loại `QuestionType` |
| `RatingInput` | `components/brand` | P1 | 1–5, điều khiển được bằng bàn phím |

Primitive đã có trong `components/ui`: badge, button, card, dropdown-menu, separator, sheet, skeleton, table, tabs. Cần thêm qua `npx shadcn add`: input, label, textarea, select, checkbox, radio-group, dialog, alert-dialog, form, sonner (toast), avatar, popover, command (chọn sản phẩm), progress, pagination.

### 4.6 Bảng màu trạng thái

| Enum | Giá trị → token |
|---|---|
| `FeedbackStatus` | New → lotus, Accepted → beige, Assigned → turmeric, Replied → sage, Closed → gray |
| `SurveyStatus` | Draft → gray, Open → sage, Closed → beige |
| `RecipientStatus` | NotDone → turmeric, Done → sage |
| Tài khoản | Active → sage, Locked (`LockoutEnd` > now hoặc `IsActive=false`) → danger |
| `AccountRole` | Admin → mực đặc, Manager → beige, Staff → gray, Customer → lotus |

Badge luôn có chữ, không chỉ dùng màu để truyền nghĩa.

### 4.7 Ngôn ngữ giao diện

Viết tiếng Việt, câu ngắn, động từ đứng đầu ở nút ("Thêm khách hàng", "Gửi khảo sát"). Lỗi trình bày theo dạng "chuyện gì xảy ra + làm gì tiếp", lấy từ `ApiError.message` sẵn có. Không dùng "Vui lòng" ở nhãn nút.

## 5. Kiến trúc frontend

### 5.1 Route groups (`apps/web/app`)

```
app/
  (public)/            layout: PublicShell (brand thuần)
    page.tsx           U1 Landing
    login/page.tsx     U2 Đăng nhập (mọi role, chuyển hướng theo role)
    register/page.tsx  U3 Đăng ký khách hàng
  (customer)/account/  layout: CustomerShell
    page.tsx           C1 Hồ sơ + sở thích
    feedback/page.tsx  C2 Phản hồi của tôi
    feedback/new/      C3 Gửi phản hồi
    surveys/page.tsx   C4 Hộp khảo sát
    surveys/[id]/      C5 Làm khảo sát
  (staff)/staff/       layout: BackofficeShell variant=staff
    feedback/page.tsx  S1 Phản hồi được giao
    feedback/[id]/     S2 Chi tiết + trả lời
  (manager)/manager/   layout: BackofficeShell variant=manager
    page.tsx           M1 Dashboard (tab Tổng quan | Báo cáo khách hàng)
    customers/page.tsx M2 Danh sách khách hàng
    customers/new/     M3 Thêm khách hàng
    customers/[id]/    M4 Chi tiết, khóa, xóa
    feedback/page.tsx  M5 Hộp phản hồi
    feedback/[id]/     M6 Tiếp nhận → giao → đóng
    surveys/page.tsx   M7 Danh sách khảo sát
    surveys/new/, surveys/[id]/edit/   M8 Trình tạo khảo sát
    surveys/[id]/send/ M9 Chọn người nhận và gửi
    surveys/[id]/results/ M10 Kết quả
  (admin)/admin/       layout: BackofficeShell variant=admin
    page.tsx           A1 Danh sách tài khoản (lọc role, trạng thái; xóa; đổi role)
    accounts/new/      A2 Tạo tài khoản + gán role
    activity/page.tsx  A3 Nhật ký hoạt động
```

Tổng cộng 22 màn. `proxy.ts` giữ matcher hiện có (`/account`, `/staff`, `/manager`, `/admin`) và chuyển hướng về `/login` khi thiếu cookie hoặc sai role. Backend policy vẫn là nguồn sự thật.

### 5.2 Module tính năng (`apps/web/features`)

```
features/<module>/
  api.ts        React Query hooks gọi lib/api/client.ts, query key dạng ["customers", params]
  schemas.ts    zod schema cho form, suy từ types OpenAPI
  components/   component riêng module
  *.fixture.ts  dữ liệu mẫu cho giai đoạn UI tĩnh, xóa khi nối API
```

Có 7 module: `auth`, `profile`, `accounts`, `customers`, `feedback`, `surveys`, `reports`.

Quy tắc phụ thuộc:
- `app/**` chỉ import từ `features/**` và `components/**`.
- `features/A` không import `features/B`. Thứ gì dùng chung thì đưa lên `components/` hoặc `lib/`.

### 5.3 Hợp đồng FE ↔ BE

1. P3 viết controller và DTO trước, có thể trả `501` ở phần thân, để `/swagger/v1/swagger.json` có đủ schema ngay từ T1.
2. FE chạy `npm run api:types` (`openapi-typescript http://localhost:5080/swagger/v1/swagger.json -o lib/api/schema.d.ts`) và commit file sinh ra.
3. Đổi contract phải mở PR có gắn cả P1 và P2 làm reviewer.
4. Lỗi trả về theo ProblemDetails (đã có). FE map `errors` vào field của react-hook-form.

### 5.4 Endpoint đề xuất (`/api/v1`)

| Module | Endpoint | Role |
|---|---|---|
| auth | `POST auth/register`, `auth/login`, `auth/refresh`, `auth/logout` | public |
| profile | `GET/PUT me`, `GET/PUT me/preferences`, `GET preferences` | mọi role đã đăng nhập |
| accounts | `GET/POST admin/accounts`, `PATCH admin/accounts/{id}/role`, `PATCH admin/accounts/{id}/status`, `DELETE admin/accounts/{id}`, `GET admin/activity-logs` | Admin |
| customers | `GET/POST customers`, `GET customers/{id}`, `POST customers/{id}/lock`, `POST customers/{id}/unlock`, `DELETE customers/{id}` | Manager |
| products | `GET products?search=` | Customer, Manager |
| feedback | `GET/POST me/feedback` | Customer |
| | `GET feedback`, `GET feedback/{id}`, `POST feedback/{id}/accept`, `POST feedback/{id}/assign`, `POST feedback/{id}/close` | Manager |
| | `GET staff/feedback`, `POST feedback/{id}/replies` | Staff, Manager |
| surveys | `GET/POST surveys`, `GET/PUT/DELETE surveys/{id}`, `POST surveys/{id}/publish`, `POST surveys/{id}/close`, `POST surveys/{id}/recipients` (body: bộ lọc tuổi, giới tính, sở thích), `GET surveys/{id}/results` | Manager |
| | `GET me/surveys`, `GET me/surveys/{id}`, `POST me/surveys/{id}/responses` | Customer |
| reports | `GET reports/overview`, `GET reports/customers/age`, `GET reports/customers/gender`, `GET reports/customers/preferences` | Manager |

Danh sách có phân trang dùng `?page=&pageSize=&search=&sort=&status=` và trả `{ items, total, page, pageSize }`.

Nhóm tuổi trong báo cáo: dưới 18, 18–24, 25–34, 35–44, 45 trở lên, chưa khai báo.

### 5.5 Trạng thái màn hình

Mọi màn có dữ liệu phải có đủ: loading (skeleton theo hình nội dung), empty (`EmptyState`), error (thông báo + "Thử lại"), success (toast). Hành động phá hủy (xóa, khóa) luôn qua `ConfirmDialog`, nêu rõ tên đối tượng. Không dùng nút bị disable thay cho thông báo lỗi.

## 6. Phân công nhóm (theo tầng)

| Người | Vai trò | Sở hữu | Đầu ra cho báo cáo |
|---|---|---|---|
| **P1** | FE lead | Token, font, `globals.css`; shell cho 5 route group; `components/brand`, `components/data/DataTable`; `proxy.ts`; U1–U3 (public/auth); C1–C5 (cổng KH); A1–A3 (admin) | Mục "Thiết kế giao diện": phần design system |
| **P2** | FE | M1–M10 (manager), S1–S2 (staff); `ChartCard`, `QuestionEditor`; script `api:types` | Mục "Thiết kế giao diện": phần nghiệp vụ |
| **P3** | Backend | Toàn bộ controller/service ở mục 5.4; state machine `FeedbackStatus` (New → Accepted → Assigned → Replied → Closed); luật khảo sát (chỉ sửa khi Draft, chỉ nhận trả lời khi Open và trong khung giờ `OpenAt`–`CloseAt`); xác thực, khóa tài khoản; test API | Mục "Thiết kế CSDL", "Cài đặt" |
| **P4** | DB + QA + Báo cáo | Seed (tài khoản demo theo README, ≥ 60 khách hàng đủ nhóm tuổi, ≥ 20 sản phẩm, ≥ 40 phản hồi đủ trạng thái, ≥ 3 khảo sát); script sao lưu/phục hồi `pg_dump`/`pg_restore`; truy vấn SQL cho `reports/*` (giao P3 tích hợp); sơ đồ chức năng, ngữ cảnh, DFD mức đỉnh; bảng khảo sát HTTT ≥ 15 câu; test thủ công theo checklist; chụp 22 màn; hướng dẫn cài đặt và sử dụng; `readme.txt` | Phần I của báo cáo (40đ), mục sao lưu (5đ) |

### 6.1 Timeline

| Tuần | P1 | P2 | P3 | P4 |
|---|---|---|---|---|
| **T1** 15–21/10 | Token, font, shell, `DataTable`, badge, dialog; UI tĩnh U1–U3, A1 | UI tĩnh M1, M2, M5, M8 với fixture | Contract tất cả controller (stub), Auth thật, `/me` | Seed v1 (tài khoản, khách hàng, sản phẩm); sơ đồ phân tích |
| **T2** 22–28/10 | Nối Auth, `proxy.ts`, Admin A1–A3, C1 | Nối M2–M6, UI tĩnh S1–S2 | Accounts, Customers, Feedback | Script backup/restore; SQL báo cáo; seed v2 (phản hồi) |
| **T3** 29/10–04/11 | C2–C5 | M7–M10, M1 báo cáo, S1–S2 | Surveys, Reports, Activity log | Seed v3 (khảo sát, câu trả lời); test luồng; ghi bug |
| **T4** 05–08/11 | Sửa bug, rà responsive, chụp ảnh | Sửa bug | Sửa bug, xuất `db/schema.sql` | Hoàn thiện báo cáo, hướng dẫn, đóng gói nộp |

Thứ tự bàn giao của BE khớp với thứ tự nối API của FE: Auth → Accounts/Customers → Feedback → Surveys → Reports. Nếu một endpoint trễ quá 2 ngày so với lịch, FE tiếp tục với fixture và ghi vào kênh nhóm. Không chặn việc.

### 6.2 Quy ước làm việc

- **Branch:** `feat/<người>-<module>`. PR nhỏ theo màn hoặc theo endpoint, cần 1 reviewer. P1 review mọi thay đổi ở `components/**` và `globals.css`.
- **Commit:** Conventional Commits, theo lịch sử repo (`feat(web): ...`, `feat(api): ...`).
- **Definition of done cho một màn:**
  - Đủ 4 trạng thái ở mục 5.5.
  - Không có màu hard-code; mọi màu lấy từ token.
  - Thao tác được bằng bàn phím.
  - `npm run lint` và `npm run typecheck` đều xanh.
  - Đã có ảnh chụp cho báo cáo.
- **Definition of done cho một endpoint:**
  - Có trong OpenAPI.
  - Có policy role.
  - Có test cho luồng chính và một lỗi phân quyền.
  - Có dữ liệu seed để demo.

## 7. Ngoài phạm vi

Không làm: dark mode, đa ngôn ngữ (chỉ tiếng Việt), email thật (thông báo khảo sát dùng bảng `Notification` hiển thị trong app), tải file, quên mật khẩu qua email (bảng `PasswordResetToken` để dành cho giai đoạn sau), MSW, Storybook.

## 8. Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Backend chỉ có 1 người | P4 nhận SQL báo cáo và seed; contract stub xong ở T1 |
| FE bị chặn khi không có mock | Fixture cạnh component; FE luôn đi trước BE một module |
| `docs/PRD.md` và `docs/DECISIONS.md` mà README nhắc tới không có trong repo | P1 viết lại hai file từ spec này trong T1, hoặc sửa link trong README |
| Next.js 16 khác bản cũ (`proxy.ts`, `LayoutProps`) | Đọc `node_modules/next/dist/docs/` trước khi viết route, theo `apps/web/AGENTS.md` |
| Font tiếng Việt lỗi dấu | Bắt buộc subset `vietnamese` cho cả 3 font; kiểm bằng chuỗi "Ữ ỹ ặ ẵ" trên mọi kiểu chữ |
