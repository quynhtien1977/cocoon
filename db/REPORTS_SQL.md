# SQL đối chiếu báo cáo — COC-53

`db/verify-reports.sql` tính trực tiếp từ bảng nguồn để đối chiếu các API báo cáo dành cho Manager. API sử dụng các aggregate được EF Core tham số hóa trong `ReportService`; script PostgreSQL này là phép kiểm tra độc lập, không phải migration hoặc nguồn SQL thứ hai mà ứng dụng phải nạp khi chạy.

Script chạy trong một transaction `REPEATABLE READ READ ONLY`, theo UTC. Không seed, refresh view, tạo đối tượng hoặc thay đổi dữ liệu. Chỉ dùng container `db` trong Docker Compose hiện có.

## API thống kê gợi ý

`GET /api/v1/reports/recommendations?from=<ISO8601>&to=<ISO8601>` chỉ dành cho Manager. Hai cận đều tùy chọn; cận sai định dạng hoặc hai cận tường minh không tăng trả `400 VALIDATION_ERROR`, chưa đăng nhập `401`, sai role `403`. Contract có schema trong `db/openapi.json`.

Response gồm `eligibleCustomers`, `coveredCustomers`, `coverage`, `recommendationCount`, `clickedCount`, `dismissedCount`, `clickRate`, `dismissRate`, `activePlans`, `lastBuiltAt`, `topProducts`, `byPlan`. Trong summary API dùng `clickedCount`/`dismissedCount`; trong từng hàng và SQL dùng `clicks`/`dismissals`.

`topProducts[]` có `id,name,recommendationCount,clicks,dismissals,clickRate,dismissRate`. `byPlan[]` có `planId,planName,customerCount,recommendationCount,clicks,dismissals,clickRate,dismissRate`. Dữ liệu rỗng trả count/rate bằng 0, hai mảng rỗng và `lastBuiltAt=null`; các snapshot khách/plan hiện tại vẫn tính độc lập. API chỉ trả số liệu tổng hợp, không trả hồ sơ khách hoặc lý do gợi ý cá nhân.

M13 hiện dùng fixture; Anti cần nối contract này và xử lý `lastBuiltAt=null`. API không cung cấp impression/events, weekly interaction log hay tag hiển thị giả. Kết quả từng câu khảo sát tiếp tục dùng `/api/v1/surveys/{id}/results` đã có.

## Chạy trên database local đang có

Từ thư mục gốc repo trong PowerShell:

```powershell
rtk docker compose exec -T db sh -c 'exec psql -X --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --file /workspace/db/verify-reports.sql'
```

Chọn kỳ báo cáo, ví dụ tháng 10/2026:

```powershell
rtk docker compose exec -T db sh -c 'exec psql -X --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set report_from=2026-10-01T00:00:00Z --set report_to=2026-11-01T00:00:00Z --file /workspace/db/verify-reports.sql'
```

Các biến trên được đọc bên trong container; không cần in `.env`, connection string hoặc mật khẩu. Có thể thêm `--csv` vào `psql` để thu kết quả đối chiếu tự động.

`report_from` và `report_to` nhận timestamp ISO 8601 có offset. Khoảng thời gian là **`[from, to)`**: gồm đầu, loại cuối; offset được quy về UTC. Bỏ `from` nghĩa là không có cận dưới; bỏ `to` nghĩa là thời điểm bắt đầu transaction hiện tại. Hai cận tường minh bằng nhau/đảo ngược hoặc timestamp sai sẽ làm script thất bại, không xuất các result set. `ON_ERROR_STOP` bật sẵn; lỗi SQL kết thúc `psql` với mã 3.

## Các result set theo thứ tự cố định

Bảy result set đầu giữ nguyên thứ tự và cột của bản COC-40; năm result set sau hoàn thiện đối chiếu COC-53. Tên được ghi bằng comment `Result set NN` trong script.

| # | Tên | API / phần dữ liệu | Các cột SQL |
| --- | --- | --- | --- |
| 01 | `customers_age` | `/reports/customers/age` | `age_group, customers, total_customers` |
| 02 | `customers_gender` | `/reports/customers/gender` | `gender, customers` |
| 03 | `customers_preferences` | `/reports/customers/preferences` | `preference_id, preference, customers, consenting_customers, percentage` |
| 04 | `overview` | `/reports/overview` | `total_customers, new_customers_30d, new_customers_this_month, new_feedback, avg_rating, rating_count, open_surveys, completed_responses` |
| 05 | `ratings_distribution` | `/reports/feedback/ratings.distribution` | `rating, feedback_count` |
| 06 | `ratings_by_month` | `/reports/feedback/ratings.byMonth` | `month, feedback_count, avg_rating, low_rating_rate` |
| 07 | `purchases_categories` | `/reports/purchases/categories` | `category_id, category, age_bucket, revenue, quantity, order_count` |
| 08 | `ratings_by_product` | `/reports/feedback/ratings.byProduct` | `product_id, product, feedback_count, avg_rating` |
| 09 | `ratings_by_category` | `/reports/feedback/ratings.byCategory` | `category_id, category, feedback_count, avg_rating` |
| 10 | `recommendations_summary` | `/reports/recommendations` | `eligible_customers, covered_customers, recommendation_count, clicks, dismissals, coverage, click_rate, dismiss_rate, active_plans, last_built_at` |
| 11 | `recommendations_top_products` | `/reports/recommendations.topProducts` | `id, name, recommendation_count, clicks, dismissals, click_rate, dismiss_rate` |
| 12 | `recommendations_by_plan` | `/reports/recommendations.byPlan` | `plan_id, plan_name, customer_count, recommendation_count, clicks, dismissals, click_rate, dismiss_rate` |

Tất cả API có tiền tố `/api/v1`; ký hiệu `.distribution`, `.byMonth`… trong bảng chỉ trường JSON, không phải endpoint con.

## Định nghĩa số liệu

- **Cơ cấu khách:** chỉ Account `Role=Customer`, đang active và chưa xóa. Tuổi tính theo sinh nhật tại ngày UTC hiện tại; sáu nhóm `<18`, `18–24`, `25–34`, `35–44`, `≥45`, `Chưa cung cấp`. Tổng các nhóm bằng tổng khách hợp lệ. `age_bucket` trong kết quả mua hàng tương ứng chỉ số 0–5 của sáu nhóm này.
- **Sở thích:** cùng nhóm khách active nhưng phải có `ConsentPersonalData=true`. Mẫu số gồm cả khách consent chưa chọn tag. Đa lựa chọn có thể làm tổng phần trăm vượt 100%; không chia theo tổng lượt chọn. Query không có hàng khi không có tag, trong khi API vẫn trả `consentingCustomers` đúng.
- **Feedback:** lọc kỳ theo `CreatedAt`, giữ lịch sử sau khi customer/product bị khóa hoặc xóa mềm. Phân bố luôn có năm hàng 1–5; tổng bằng `overview.ratingCount` trong cùng kỳ. Trung bình sản phẩm/danh mục là trung bình từng phản hồi, không phải trung bình của các trung bình. `low_rating_rate` là số phản hồi ≤2 sao / tổng phản hồi tháng, dưới dạng 0–1.
- **Mua hàng:** chỉ đơn `Completed`, lọc theo `OrderedAt`, dùng `Quantity × UnitPrice` đã lưu trên dòng đơn; không lấy giá hiện tại. Giữ lịch sử customer/product/variant đã xóa mềm. Tuổi dùng ngày xem hiện tại. `order_count` là số đơn distinct trong mỗi ô danh mục × tuổi; một đơn nhiều danh mục có thể được tính ở nhiều ô.
- **Overview:** số khách hiện tại, khách mới, khảo sát đang mở là snapshot hiện tại; kỳ sự kiện chỉ áp dụng feedback và submission. Kết quả từng câu khảo sát tiếp tục lấy từ `/surveys/{id}/results`, không thêm endpoint báo cáo khảo sát trùng.

## Gợi ý sản phẩm: mẫu số và giới hạn

Tập recommendation trong kỳ được lọc **theo `GeneratedAt`**, không theo `InteractedAt`. Đếm tất cả trạng thái `Active`, `Clicked`, `Dismissed`, `Expired`, giữ cả lịch sử khách/catalog đã khóa hoặc xóa mềm và các plan `Ended`.

- `recommendationCount`: số hàng recommendation được tạo trong kỳ.
- `clicks` / `dismissals`: số hàng có **trạng thái đang lưu** lần lượt là `Clicked` / `Dismissed` trong tập đó.
- `clickRate` / `dismissRate`: các số trên chia cho `recommendationCount`. Đây là tỷ lệ trạng thái của tập được tạo, không phải CTR theo impression hoặc tổng số sự kiện tương tác.
- `eligibleCustomers`: số khách hiện tại active, chưa xóa, có `Role=Customer` và consent.
- `coveredCustomers`: số khách distinct trong `eligibleCustomers` đã có ít nhất một recommendation trong kỳ, kể cả hàng hiện `Expired`. `coverage = coveredCustomers / eligibleCustomers`, biểu thị đã được tạo gợi ý trong kỳ, không bảo đảm hiện còn gợi ý `Active`.
- `activePlans`: số plan hiện `Active` và `StartAt <= now < EndAt`, độc lập kỳ sự kiện.
- `lastBuiltAt`: `MAX(GeneratedAt)` trong tập kỳ; null khi chưa có recommendation. Đây là thời điểm hàng mới nhất được lưu, không phải nhật ký mọi lần gọi rebuild, vì rebuild không tạo hàng không thể suy ra từ bảng này.
- `topProducts`: tối đa 10 sản phẩm, sắp `clicks` giảm dần, `recommendationCount` giảm dần, `id` tăng dần. Tên lấy từ catalog kể cả đã xóa mềm. Không bịa tag sở thích hoặc click chưa được lưu.
- `byPlan`: nhóm theo `PlanId`, gồm cả nhóm organic có `planId=null, planName=null`. `customerCount` là số khách distinct từng nhóm, không phải quy mô segment hiện tại; một khách có thể ở nhiều nhóm. Sắp `planId` tăng dần, nhóm null trước.

`coverage`, `clickRate`, `dismissRate` là tỷ lệ **0–1**, làm tròn 6 chữ số thập phân; mẫu số 0 trả 0. Các trung bình giữ độ chính xác từ dữ liệu nguồn. Không hardcode số liệu seed vào query.

Schema hiện chỉ lưu một `Status` và một `InteractedAt` mỗi recommendation. Nếu khách bấm rồi bỏ qua, trạng thái cuối là `Dismissed`: lần bấm trước đó không còn suy ra được. Script/API không tuyên bố phục hồi lịch sử tương tác đó; muốn đo event thực sự cần một thiết kế riêng.

## Nghiệm thu

Đối chiếu API với đủ 12 result set trên cùng bộ dữ liệu và cùng cận thời gian; số liệu snapshot hiện tại có thể thay đổi nếu demo đang được thao tác. Các kiểm tra cần bao gồm dữ liệu rỗng, sinh nhật/thiếu DOB, consent và khách không có tag, biên UTC `[from,to)`, giá mua lịch sử, soft delete, tất cả trạng thái recommendation, một khách có nhiều hàng, top 10/tie-break, nhóm organic/plan Ended và mẫu số 0. Riêng endpoint Manager cần kiểm tra anonymous 401 và sai role 403.

Nguồn kỹ thuật: [PostgreSQL 18 psql](https://www.postgresql.org/docs/18/app-psql.html) cho cách quote biến, `ON_ERROR_STOP`, `\gset` và `\if`; [transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html) cho snapshot `REPEATABLE READ`.
