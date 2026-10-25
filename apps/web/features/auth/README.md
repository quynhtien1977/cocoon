# Đăng nhập

## Đăng ký khách hàng

- `/register` dùng pop-up cùng chiều rộng 500px và bố cục gọn như đăng nhập. Bước 1 bắt buộc tên, email, mật khẩu, xác nhận mật khẩu. Enter hoặc mũi tên tiếp tục kiểm tra thông tin rồi chuyển bước, chưa gửi API.
- Bước 2 gồm ba dropdown chọn nhiều: 6 loại da, 5 dòng sản phẩm, 4 tiêu chí. Tất cả tùy chọn; mũi tên quay lại giữ dữ liệu. Nút đăng ký chỉ nằm ở bước 2. Không có lựa chọn role hoặc đăng ký nhân sự/admin.
- Gửi `POST /api/v1/auth/register` theo contract hiện có. Nếu chọn sở thích, đọc `GET /api/v1/preferences` để đối chiếu tên và lấy ID thật; không tự gán ID, không bỏ qua lựa chọn khi API lỗi. API hiện trả 501 nên chưa thể tạo tài khoản thật; giao diện báo rõ, chỉ hiển thị thành công sau response thành công.
- Script kiểm tra trình duyệt có giả lập cả lỗi 501 và thành công, kiểm tra Enter, quay lại, dropdown, đóng bằng Esc và kích thước ở 1366px/390px/320px; không ghi dữ liệu backend.

## Đăng nhập chung và quản trị

- `/login`: pop-up màu kem trên landing, dùng chung Customer/Staff/Manager. Route interception giữ trang nền và vị trí cuộn khi mở từ landing; đóng bằng X/Esc/nền tối hoặc Back, Forward mở lại. Mở trực tiếp `/login` cũng hiển thị pop-up, đóng về `/`. `/admin/login`: trang quản trị xanh đậm riêng, ngoài AdminShell và PublicShell thông thường.
- Dùng email thay số điện thoại vì `LoginRequest` hiện nhận `Email`, `Password`. Chỉ kiểm tra email hợp lệ và mật khẩu không rỗng khi đăng nhập; quy tắc tạo mật khẩu không áp dụng lại cho mật khẩu đã có.
- Gọi `POST /api/v1/auth/login` qua API client, rồi `GET /api/v1/me` để đọc `role`; không chọn role ở client. Đích: Customer → `/account`, Staff → `/staff/feedback`, Manager → `/manager`, Admin → `/admin`. Cổng sai role hoặc không đọc được hồ sơ sẽ gọi logout và báo lỗi.
- Backend hiện chỉ có stub, trả 501 cho các route này; giao diện hiển thị dịch vụ chưa kích hoạt, không mô phỏng đăng nhập thành công. Response `/me` chưa có DTO hoàn chỉnh; adapter hiện đọc thuộc tính `role` dạng tên hoặc số theo `AccountRole`. Cần đối chiếu lại contract khi backend triển khai.
- Quên mật khẩu/Apple/Google/Facebook chưa có endpoint, hiển thị disabled kèm giải thích.
- Checkbox chỉ lưu email sau đăng nhập thành công, riêng từng cổng. Không lưu mật khẩu/token trong localStorage. Cookie và phân quyền phải do backend quyết định; trang admin riêng không thay thế kiểm tra quyền ở server. Proxy scaffold hiện chưa bảo vệ các route quản trị.
- Có nhãn trường, lỗi theo trường, trạng thái đang gửi, thông báo lỗi API, hiện/ẩn mật khẩu và chuyển hướng sau xác thực. Không sửa backend.
- Kiểm tra: `npm test`, `npm run lint`, `npm run build`; trên Windows có Edge, chạy `node scripts/check-login.mjs` sau build để kiểm tra pop-up và lưu ảnh ở `.next/login-previews`. Kiểm tra trình duyệt giả lập response 501, không gửi thông tin đăng nhập đến backend.
