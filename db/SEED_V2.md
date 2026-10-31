# COC-52 — Seed v2: phản hồi

Theo [COC-52](https://nguyenquoccuong07122004.atlassian.net/browse/COC-52): ít nhất 60 phản hồi, đủ 5 trạng thái và có đánh giá ≤2 sao. Dữ liệu tiếng Việt phục vụ demo, gắn các dòng đơn Completed của chính khách trong [seed v1](SEED_V1.md).

## Chạy bằng Docker hiện có

Từ repo root với `.env` local đã cấu hình:

```powershell
rtk docker compose up -d api db
rtk docker compose exec api dotnet build
rtk docker compose exec api dotnet run --project src/Cocoon.Api --no-build --no-launch-profile -- seed-v2
rtk docker compose exec -T db sh /workspace/db/verify-seed-v2.sh
```

Chỉ dùng hai service `api`/`db` hiện có. `seed-v2` là tiến trình CLI kết thúc sau khi seed trong container `api`, không mở cổng HTTP hoặc thêm service/volume/network. Giữ guard Development/host `db`/port5432/database `cocoon` của seed v1. Database phải được migrate trước; seed không tự migrate.

`seed` vẫn chỉ chạy v1. `seed-v2` chạy v1 rồi thêm phản hồi trong cùng transaction, nên dùng được trên database trống đã migrate và database đã có v1. Không cần chạy lại v1 riêng. Chạy tuần tự từng lệnh.

## Dữ liệu bổ sung ban đầu

| Bảng | Số lượng thêm khi chưa có phản hồi |
|---|---:|
| Feedback | 60; 12 New, 12 Accepted, 12 Assigned, 12 Replied, 12 Closed |
| FeedbackAssignment | 36, phân công cho cả hai Staff demo |
| FeedbackReply | 24, do Staff được giao trả lời |
| **Tổng** | **120** |

Có 60 khách khác nhau và đủ rating1–5; rating1/2 mỗi loại15 dòng, rating3/4/5 mỗi loại10 dòng. Mỗi phản hồi trỏ đến một OrderItem duy nhất, Product/Customer khớp đơn Completed. Chỉ dùng sản phẩm Active, variant chưa xóa và khách đang hoạt động khi thêm mới.

Accepted trở đi có Manager tiếp nhận; Assigned trở đi có lịch sử giao việc; Replied/Closed có câu trả lời; Closed có ngày đóng. Thời gian UTC theo thứ tự mua → tạo → tiếp nhận → giao → trả lời → đóng, không vượt mốc seed. Lịch sử được tạo theo luồng đủ 5 bước, không dùng đường tắt đóng từ Accepted. Phản hồi20–1000 ký tự, trả lời10–500 ký tự để tương thích API hiện tại.

## Chạy lặp và bảo toàn dữ liệu

- Dùng 60 mã đơn v1 cố định, lấy một dòng theo SKU trong mỗi đơn, không gán ID cứng. Dòng đã có phản hồi được bỏ qua, kể cả phản hồi do người dùng tự tạo.
- Giữ nội dung/rating/trạng thái, lịch sử phân công, câu trả lời và mọi thao tác sau seed. Không tự khôi phục lịch sử đã bị sửa/xóa. Lần hai trên bộ đầy đủ thêm0 dòng.
- Nếu đơn/dòng/sản phẩm/khách chưa có phản hồi không còn hợp lệ, hoặc thiếu Manager/Staff demo đang hoạt động, dừng và rollback lượt đó; không đổi dữ liệu để vượt kiểm tra.
- Không thêm schema, migration, endpoint, khảo sát hoặc kế hoạch gợi ý. Các API có thể tiếp tục được kiểm thử với bộ seed này.

Các số trên áp dụng bộ demo chưa chỉnh sửa. [SQL đối chiếu](verify-seed-v2.sql) chỉ đọc counts, trạng thái và tính nhất quán; có dữ liệu người dùng thật hoặc lịch sử phân công lại thì cần đọc kết quả theo bối cảnh, không ép DB về số mẫu.

## Kiểm chứng ngày 31/10/2026

- Docker Compose chỉ có `api` và `db`, dùng container và volume hiện có. DB local trước lượt v2 đã đủ v1 và có0 phản hồi.
- Trong chính `api`: CLI lượt1 thêm120 bản ghi, lượt2 thêm0; v1 sau đó giữ nguyên toàn bộ counts,12 tháng,70% trùng sở thích và0 tổng tiền sai.
- SQL v2:60 phản hồi,12 mỗi trạng thái;36 assignment,24 reply;0 sai liên kết đơn,0 sai trường/thời gian trạng thái,0 sai lịch sử giao việc,0 sai trả lời.
- Test chạy trên database trống được fixture tạo trong chính `db`: đủ dữ liệu, giữ user edits/lịch sử khi chạy lại, rollback khi đơn không hợp lệ. Full backend suite56/56 pass, không skip; Release build0 warning/error; frontend lint/typecheck pass.
- Có lỗi `dotnet watch` polling (`ArgumentException`, trùng key file `.pdb` dưới `bin-docker`) khi file build thay đổi. Đã khởi động lại container `api` hiện có và hoàn tất kiểm thử/CLI; chưa sửa cơ chế watcher trong task seed. Nếu lặp lại, giữ volume và khởi động lại `api`, xử lý watcher bằng task riêng.
