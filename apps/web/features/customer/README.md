# Customer screens

## Đơn hàng — `/account/orders`

- Sáu bộ lọc: Tất cả, Đã giao, Đang giao, Chờ xác nhận, Đã đánh giá, Chờ đánh giá. Đang giao và Chờ xác nhận bị disabled (domain hiện chỉ có Completed/Cancelled/Returned).
- Đánh giá được lọc theo **từng sản phẩm** của đơn Completed. Đơn đánh giá một phần xuất hiện ở cả hai bộ lọc; tổng tiền luôn là tổng đơn gốc và có ghi số sản phẩm đang hiển thị.
- Gọi GET `/api/v1/me/orders?page=…&pageSize=20`, tải đủ trang rồi tìm/lọc client; hiển thị tối đa 5 đơn/trang. Không dùng dữ liệu mẫu thay cho API thành công/lỗi. Khi API chưa khả dụng có nút **Xem giao diện mẫu**, nhãn minh họa luôn hiện. Sản phẩm mẫu chưa đánh giá mở biểu mẫu ở chế độ xem thử, không gửi API. Không lưu dữ liệu mẫu vào tài khoản.
- `orders-service.ts` cô lập adapter vì backend mới có stub, chưa có response DTO. Contract frontend đề xuất: `{ items: CustomerOrder[], totalCount: number }` hoặc array đầy đủ. Mỗi đơn gồm `id, code, orderedAt, status, totalAmount, items`; mỗi item gồm `id, name, variant, imageUrl, quantity, unitPrice, review: null | { id, rating }`, và `productSlug` tùy chọn. Đây chưa phải contract backend đã triển khai. Thiếu review state, trang lặp hoặc thiếu dữ liệu báo lỗi; không suy diễn là chưa đánh giá hay không có đơn hàng.
- Liên kết thật dùng `/account/feedback/new?orderItemId=…` hoặc `/account/feedback/[id]` hiện có. Trang xem chi tiết đánh giá `[id]` vẫn là scaffold.
- Test logic: `node --import tsx --test tests/orders-service.test.mjs`. Browser: `node scripts/check-login.mjs` sau build, giả lập API, kiểm tra desktop/mobile và lưu ảnh trong `.next/login-previews/orders-*.png`.

## Đánh giá sản phẩm — `/account/feedback/new`

- Chọn 1–5 sao bằng `RatingInput`, nhận xét bắt buộc, tối đa 1000 ký tự theo giới hạn cột Feedback.Content.
- Cho chọn tối đa 5 ảnh JPG/PNG/WebP, mỗi ảnh tối đa 5 MB; kiểm tra ảnh đọc được, tránh trùng cùng tệp, có thumbnail, bỏ từng ảnh và xem ảnh trong bản xem trước. Object URL được thu hồi khi bỏ ảnh, đổi sản phẩm hoặc rời trang. Không lưu tệp vào localStorage.
- Đây là chọn ảnh cục bộ, chưa upload server: request backend chưa hỗ trợ tệp hoặc image IDs. Nếu có ảnh trong chế độ thật, form báo chưa thể gửi ảnh và không POST văn bản riêng gây mất ảnh âm thầm. Cần backend hỗ trợ lưu/đính kèm ảnh trước khi bật gửi đánh giá có ảnh; chưa sửa backend.
- Đọc `GET /api/v1/me/reviewable-items`; chỉ cho gửi sản phẩm có orderItemId trong danh sách, kiểm tra lại trước mỗi POST `/api/v1/me/feedback`. Payload đúng `CreateFeedbackRequest`: `{ orderItemId, rating, content }`; không truyền customerId hoặc role. Chặn gửi trùng khi đang xử lý, giữ nội dung khi lỗi; chỉ thông báo đã gửi sau response thành công.
- Backend hiện chưa triển khai response DTO. Adapter frontend đề xuất array hoặc `{ items: [...] }` với `orderItemId, name, variant, imageUrl: string|null, orderCode`. Không suy diễn quyền đánh giá từ URL. Nếu thiếu metadata thì báo lỗi và chờ đối chiếu DTO thật, không sửa backend.
- Không có orderItemId thì chọn từ danh sách hợp lệ. Link sai ID, không đủ điều kiện hoặc đã đánh giá không mở form gửi. ID không tìm thấy không tự đổi sang sản phẩm khác.
- `?preview=1&item=1` mở sản phẩm minh họa tương ứng trong `orders-preview.ts`. Chỉ xem trước/chỉnh sửa, không GET/POST feedback, không thông báo gửi thành công giả và không lưu nháp vào localStorage.
- Test logic: `node --import tsx --test tests/review-service.test.mjs`. Browser kiểm tra validation, eligibility, 501, success, duplicate-submit và mobile; ảnh `.next/login-previews/product-review-*.png`.
