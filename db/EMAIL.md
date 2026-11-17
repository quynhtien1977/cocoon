# Gửi email mật khẩu tạm & mã đặt lại mật khẩu (OTP)

API gửi email trong hai nhóm trường hợp:

| Khi nào | Nội dung email | Cơ chế & hiệu lực |
|---|---|---|
| Quản lý thêm khách hàng (`POST /customers`, gửi lại `POST /customers/{id}/invitation`) | **Mật khẩu tạm** + link `/login` | Dùng để đăng nhập lần đầu (`MustChangePassword = true`); đăng nhập xong hệ thống đưa tới trang Hồ sơ để bắt buộc đổi mật khẩu mới. Bấm gửi lại (tối đa 1 lần/phút, 5 lần/giờ) sẽ cấp mật khẩu tạm mới và hủy mật khẩu tạm cũ chưa dùng. |
| Quản trị viên tạo tài khoản (`POST /admin/accounts`, gửi lại `POST /admin/accounts/{id}/invitation`) | **Mật khẩu tạm** + link `/login` (hoặc `/admin/login` với vai trò Admin) | Ẩn mật khẩu khỏi màn hình Admin A2 và response API (`temporaryPassword` không còn trả về). Khi đăng nhập lần đầu bằng mật khẩu tạm, hệ thống chuyển tới trang Hồ sơ của vai trò để buộc đổi mật khẩu mới. |
| Người dùng bấm "Quên mật khẩu" (`POST /auth/password/forgot`) | **Mã OTP 6 chữ số** + link `/reset-password?email=…` | Hiệu lực 15 phút, tối đa 5 lần thử (`POST /auth/password/verify` → `POST /auth/password/reset`). Tối đa 1 mã mỗi phút và 5 mã mỗi giờ cho mỗi tài khoản. |

## Mặc định: hộp thư Mailpit trên máy

Không cần cấu hình gì. `docker compose up -d` chạy thêm service `mailpit`, API gửi mọi email vào đó và **không email nào ra
Internet**. Xem thư ở <http://localhost:8025>. Hợp cho demo với tài khoản `*@cocoon.demo` (địa chỉ không có thật).

## Gửi thật qua Gmail cá nhân

Gmail không cho đăng nhập SMTP bằng mật khẩu thường; cần **App Password** (mật khẩu ứng dụng 16 ký tự).

1. Bật **Xác minh 2 bước** cho tài khoản Google: <https://myaccount.google.com/signinoptions/twosv>.
2. Tạo App Password: <https://myaccount.google.com/apppasswords> → đặt tên, ví dụ `Cocoon CRM` → Tạo → chép chuỗi 16 ký tự
   (bỏ khoảng trắng). Chuỗi này chỉ hiện một lần.
3. Thêm vào `.env` ở gốc repo (không commit file này):

   ```text
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_ENABLE_SSL=true
   SMTP_USERNAME=<địa chỉ Gmail của bạn>
   SMTP_PASSWORD=<App Password 16 ký tự>
   SMTP_FROM=<cùng địa chỉ Gmail>
   ```

4. Tạo lại container API để nhận biến mới: `rtk docker compose up -d api`.
5. Thử: Quản lý thêm một khách bằng **email thật** của bạn (không dùng `@cocoon.demo`), hoặc bấm "Quên mật khẩu" với
   email đó. Thư có thể vào mục Spam/Quảng cáo ở lần đầu.

Quay lại Mailpit: xóa hoặc để trống các dòng `SMTP_*` rồi `rtk docker compose up -d api`.

### Lưu ý

- `SMTP_FROM` phải là chính Gmail đã đăng nhập; Gmail thay địa chỉ khác bằng địa chỉ của bạn.
- Gmail cá nhân giới hạn khoảng 500 email/ngày, đủ cho demo.
- App Password có quyền gửi mail thay bạn: chỉ để trong `.env`, không dán vào chat, tài liệu hay commit. Thu hồi ở trang
  App Password khi xong đồ án hoặc nếu lộ.
- Lỗi đăng nhập SMTP (sai App Password, chưa bật xác minh 2 bước) làm API trả `invitationSent: false` khi tạo khách,
  `503 EMAIL_SEND_FAILED` khi gửi lại; log API chỉ ghi loại lỗi, không ghi mã hay mật khẩu.
