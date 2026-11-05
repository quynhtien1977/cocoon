# COC-55 — Seed v3: khảo sát và kế hoạch gợi ý

Theo [COC-55](https://nguyenquoccuong07122004.atlassian.net/browse/COC-55): ít nhất 3 khảo sát và 40 lượt nộp, kèm kế hoạch gợi ý. Mọi nội dung là dữ liệu mô phỏng tiếng Việt, không phải kết quả khảo sát thực tế của Cocoon.

## Chạy trên Docker hiện có

Từ repo root, sau khi database local đã áp dụng các EF migration của nhánh:

```powershell
rtk docker compose exec api dotnet build
rtk docker compose exec api dotnet run --project src/Cocoon.Api --no-build --no-launch-profile -- seed-v3
rtk docker compose exec -T db sh /workspace/db/verify-seed-v3.sh
```

`seed-v3` chạy v1, v2 và v3 trong cùng transaction; dùng được trên database trống đã migrate và DB demo hiện có. Lệnh `seed` và `seed-v2` giữ phạm vi cũ. Không tự seed lúc API khởi động, không tự migrate, không thêm service/container/volume hoặc HTTP server. Giữ guard Development/host `db`/port `5432`/database `cocoon`; không in secrets. Chạy tuần tự từng lệnh seed.

## Bộ dữ liệu ban đầu

| Nhóm | Số lượng / nội dung |
|---|---|
| Survey | 3: Draft/Other, Open/Satisfaction, Closed/NewProduct |
| SurveyQuestion / QuestionOption | 12 câu, 18 lựa chọn; mỗi khảo sát đủ SingleChoice/MultiChoice/Rating/ShortText |
| SurveyRecipient | 70: Open gửi customer01–40; Closed gửi customer21–50 |
| SurveyResponse / SurveyAnswer | 40 / 200: mỗi khảo sát Open và Closed có 20 lượt nộp |
| Notification | 70 thông báo khảo sát; 40 đã đọc tương ứng lượt đã nộp |
| RecommendationPlan / RecommendationPlanProduct | 3 / 9: Draft, Active, Ended; mỗi plan 3 sản phẩm Active |
| CustomerPreference | Chỉ thêm tag Survey chưa có cho người đã consent, suy từ option được chọn |

Khảo sát NewProduct gắn sản phẩm Upcoming từ v1. Mỗi lượt nộp có 1 SingleChoice, 2 lựa chọn MultiChoice khác nhau, 1 rating nguyên 1–5 và 1 ShortText; question/option cùng survey. Recipient Done có CompletedAt bằng SubmittedAt. Các mốc UTC theo thứ tự tạo → mở → gửi → nộp → đóng nếu Closed.

`customer01@cocoon.demo` có khảo sát Open chưa làm để demo. Survey Open và plan Active kết thúc sau 90 ngày kể từ mốc seed lần đầu; chạy lại không gia hạn thời gian. Khi đã hết hạn cần tạo dữ liệu mới bằng chức năng ứng dụng; không xóa DB hay reset bộ seed để kéo dài lịch.

Plan dùng JSON SegmentFilter camelCase: Draft cho tuổi 18–44, Active không giới hạn segment, Ended cho sở thích Da dầu. Không thêm Recommendation cache hoặc điểm giả; dùng chức năng rebuild hiện có nếu cần sinh gợi ý bằng thuật toán thật.

## Chạy lại và bảo toàn dữ liệu

- Survey dành riêng IDs `5500001..5500003`; Plan `5500011..5500013`. Đây là **ngoại lệ local-demo** để nhận diện sau khi đổi tiêu đề/mô tả/tên/mục tiêu, không thêm cột hoặc bảng seed. IDs dương tương thích route và client; không dùng dải này cho dữ liệu ngoài seed. Các child và mọi dữ liệu v1/v2 vẫn dùng identity DB; không đổi sequence.
- Có đủ sáu bản ghi gốc thì bỏ qua toàn bộ phần v3, kể cả survey xóa mềm; không thêm lại câu hỏi, answer, link sản phẩm, notification hoặc tag đã bị sửa/xóa. Bài nộp mới của người demo được giữ.
- Có một phần IDs dành riêng thì dừng và rollback lượt chạy, không tự repair hoặc ghi đè. Xóa vật lý một plan demo cũng dẫn đến trường hợp này. Không tự sửa dữ liệu để vượt guard.
- Không đặt lại credentials, mở khóa account, đổi consent hoặc ghi đè sở thích Declared. Rút consent sau seed không bị đảo ngược.
- Khi tạo mới, 50 Customer demo đầu phải active và Manager demo phải active; sản phẩm khảo sát phải Upcoming và sản phẩm plan phải Active/chưa xóa.
- Nhận diện v3 dựa trên dải IDs dành riêng; sáu bản ghi ngoài seed cố tình dùng toàn bộ dải này không được phân biệt. Không dùng bộ seed này cho môi trường thật.

Số lượng áp dụng DB demo chưa chỉnh sửa. Sau thao tác người dùng, SQL đối chiếu có thể khác baseline; không ép dữ liệu về số mẫu.

## Kiểm chứng

`SurveySeedTests` chạy trên database local trống riêng do fixture tạo và migrate, kiểm số lượng/quan hệ/thời gian/consent/plan segment, bảo toàn dữ liệu khi chạy lại và rollback khi xung đột ID. `verify-seed-v3.sql` dùng transaction READ ONLY; các `invalid_*` phải bằng 0 trên bộ ban đầu, `customer01_pending_open_surveys` bằng 1. Exit code chỉ báo lỗi thực thi SQL, cần đọc các counts để kết luận hợp lệ. Không đọc thông tin khách hoặc secrets trong output.

Seed v3 không chứng minh UI đã nối API. COC-33/40 phải có trên nhánh chạy ứng dụng để dùng khảo sát Customer và reports; kiểm thử toàn bộ demo thuộc COC-56 sau khi các thay đổi cần thiết được tích hợp.

### Kết quả ngày 04/11/2026

- Database trống riêng: 3/3 seed-v3 integration tests pass; toàn backend 104/104 pass, không skip. Có RED trước triển khai.
- Release build 0 warning/0 error; frontend 169/169 test pass, lint/typecheck pass. Không sửa UI.
- DB Compose local trước v3 đã đủ v1/v2. CLI lần đầu thêm502 bản ghi, lần hai thêm0. Toàn bộ8 chỉ số invalid của SQL bằng0; customer01 có1 khảo sát Open chưa làm.
- V3 thêm77 tag Survey;248 tag Declared giữ nguyên, tổng325. Tỷ lệ đơn trùng sở thích trong verify v1 có thể đổi khi sở thích hiện tại được mở rộng; v3 không sửa đơn hoặc giá lịch sử.
- Runtime Manager: danh sách survey200, hai results200 và20 lượt nộp mỗi survey, danh sách plan200/3plan; anonymous401 và Customer gọi results Manager403. Kết quả option/rating/text khớp40responses/200answers đã lưu.
- Docker vẫn chỉ api/db có sẵn. Không tạo dịch vụ seed, migration hoặc thay dữ liệu ngoài phạm vi demo. COC-33/40 còn ở PR riêng; chưa nghiệm thu toàn luồng UI của COC-56.
