# Sao lưu và phục hồi CSDL — COC-54 / NFR-07

Phương án sao lưu và phục hồi cho PostgreSQL 18 của Cocoon CRM. Phạm vi: môi trường local trong Docker
Compose của đồ án. Ba nguyên tắc không thay đổi:

1. Sao lưu chỉ đọc database nguồn.
2. Phục hồi luôn vào một **database mới**; script từ chối ghi lên database chính.
3. Mỗi lần phục hồi đều tự đối chiếu bản phục hồi với kiểm kê lưu lúc sao lưu và trả về PASS/FAIL, nên
   vẫn dùng được khi database chính đã hỏng hoặc không còn.

## 1. Thành phần

| File | Chạy ở đâu | Việc |
|---|---|---|
| [scripts/backup-db.sh](../scripts/backup-db.sh), [scripts/backup-db.ps1](../scripts/backup-db.ps1) | host | Điểm vào sao lưu; tạo `./backups` rồi gọi script trong container |
| [scripts/restore-db.sh](../scripts/restore-db.sh), [scripts/restore-db.ps1](../scripts/restore-db.ps1) | host | Điểm vào phục hồi |
| [db/backup.sh](backup.sh) | container `db` | `pg_dump`, lưu kiểm kê và luật giữ 7 bản |
| [db/restore.sh](restore.sh) | container `db` | `createdb` + `pg_restore` + đối chiếu |
| [db/verify-restore.sql](verify-restore.sql) | container `db` | Kiểm kê chỉ đọc, chạy lúc sao lưu và lúc phục hồi |

Container `db` phải có mount ghi được `./backups:/workspace/backups` (khai báo trong
[docker-compose.yml](../docker-compose.yml)). Sau khi thêm mount cần `rtk docker compose up -d db` để
container được tạo lại; việc này không xóa volume dữ liệu.

Script không nhận mật khẩu từ dòng lệnh. Chúng chạy trong container và đọc `POSTGRES_USER` /
`POSTGRES_DB` từ environment của container, kết nối qua Unix socket nội bộ.

## 2. Lệnh

```text
rtk docker compose up -d db

rtk sh scripts/backup-db.sh                       # sao lưu database chính
rtk sh scripts/backup-db.sh cocoon_restore_demo   # sao lưu một database khác

rtk sh scripts/restore-db.sh                                  # bản mới nhất của database chính, đích tự sinh
rtk sh scripts/restore-db.sh latest cocoon_restore_demo        # bản mới nhất của database chính, đích chỉ định
rtk sh scripts/restore-db.sh cocoon-20261107-171033.dump cocoon_restore_demo
```

Trên PowerShell dùng `rtk powershell -File scripts\backup-db.ps1` và
`rtk powershell -File scripts\restore-db.ps1` với cùng tham số. Hai bản `.sh` và `.ps1` chỉ là wrapper;
toàn bộ logic nằm trong `db/backup.sh` và `db/restore.sh` nên hai hệ điều hành cho kết quả giống nhau.

Xóa một database đã phục hồi sau khi kiểm tra xong:

```text
rtk docker compose exec -T db sh -lc 'dropdb --username "$POSTGRES_USER" cocoon_restore_demo'
```

## 3. Bản sao lưu

- Định dạng `pg_dump --format=custom --compress=9`, kèm `--no-owner --no-acl` để nạp được dưới role
  bất kỳ. Một file chứa schema, dữ liệu, index, ràng buộc, sequence, ba view, materialized view
  `mv_product_copurchase` và bảng `__EFMigrationsHistory`.
- Tên file `<database>-<YYYYMMDD>-<HHMMSS>.dump` theo giờ **UTC**, nên thứ tự chữ cái trùng thứ tự
  thời gian. Bộ seed v1+v2+v3 hiện cho file khoảng 113 KB.
- Mỗi bản có file kiểm kê cùng tên, đuôi `.inventory`, là kết quả của `db/verify-restore.sql` tại thời
  điểm sao lưu. File dump và file kiểm kê được giữ và xóa cùng nhau.
- Ghi ra `.<tên>.part` rồi `mv`, nên một lần chạy bị ngắt không để lại file dở dang.
- Script kiểm kê trước và sau `pg_dump`. Hai bản khác nhau nghĩa là có ghi dữ liệu trong lúc sao lưu;
  khi đó bản sao lưu bị hủy, script thoát mã 3 và yêu cầu dừng `api` rồi chạy lại.
- Nơi lưu: `./backups` ở gốc repo. Thư mục này nằm trong `.gitignore` và `.dockerignore`, nên bản sao
  lưu chứa dữ liệu demo không đi vào Git hay image.

**Giữ 7 bản gần nhất.** Sau mỗi lần sao lưu thành công, script xóa các file cũ hơn 7 bản mới nhất của
cùng database. Bản sao lưu của các database khác không bị tính chung.

Chu kỳ đề nghị cho giai đoạn chấm đồ án: chạy sao lưu trước mỗi lần chạy migration, chạy seed lại,
hoặc trước mỗi buổi demo. Không có cron trong đồ án này; sao lưu là lệnh người vận hành gọi.

## 4. Phục hồi

`db/restore.sh` làm đúng thứ tự: chọn file dump, chọn tên database đích, kiểm tra các chốt an toàn,
`createdb`, `pg_restore --exit-on-error`, rồi đối chiếu.

Mặc định đích là `<POSTGRES_DB>_restore_<timestamp UTC>`, luôn là một database chưa tồn tại. `latest`
chỉ xét bản của `POSTGRES_DB`; bản của database khác phải gọi đúng tên file.

Các trường hợp bị từ chối, không có cách bỏ qua bằng tham số:

| Trường hợp | Thoát | Thông báo |
|---|---|---|
| Đích là database chính | 2 | `Từ chối: cocoon là database chính. Phục hồi phải vào database mới.` |
| Đích đã tồn tại | 2 | `Từ chối: database <tên> đã tồn tại. Chọn tên khác hoặc xóa nó bằng tay.` |
| Tên đích không khớp `^[a-z][a-z0-9_]{2,62}$` | 2 | `Tên database đích không hợp lệ: <tên>` |
| Không thấy file dump | 1 | `Không thấy /workspace/backups/<tên>.` |
| `latest` nhưng database chính chưa có bản nào | 1 | `Chưa có bản sao lưu nào của cocoon trong /workspace/backups; chạy backup trước.` |
| Tên file là đường dẫn | 2 | `Chỉ nhận tên file trong /workspace/backups: <tên>` |

Khi `pg_restore` lỗi, `--exit-on-error` dừng ngay và script trả mã khác 0; database đích lỗi được giữ
lại để điều tra, database chính không bị tác động trong mọi nhánh.

## 5. Đối chiếu

`db/verify-restore.sql` chạy lúc sao lưu để tạo file `.inventory`, rồi chạy lại trên bản phục hồi và
`diff` hai kết quả. Database chính không tham gia phép so sánh, nên nó hỏng hay mất đều không ảnh
hưởng. Bốn phần:

1. Mọi bảng, view, materialized view trong schema `public` kèm số dòng đếm thực.
2. Tổng số đối tượng, index và ràng buộc theo loại (PK, FK, unique, check, not-null).
3. Tên và `last_value` của từng sequence, để `INSERT` sau phục hồi không đụng khóa đã dùng.
4. Danh sách `MigrationId`, để bản phục hồi ở đúng phiên bản schema của nguồn.

Truy vấn chỉ đọc tên đối tượng và số lượng. Không đọc cột dữ liệu khách hàng, mật khẩu hay token, nên
output dán được vào báo cáo.

Kết quả cuối của script:

| Thoát | Dòng kết quả | Ý nghĩa |
|---|---|---|
| 0 | `PASS` | Bản phục hồi khớp kiểm kê |
| 3 | `FAIL` | Bản phục hồi lệch; giữ lại để điều tra |
| 4 | `CHƯA ĐỐI CHIẾU` | Không có file kiểm kê và database nguồn không còn; dữ liệu đã nạp nhưng chưa được xác nhận |

Bản sao lưu tạo trước khi có file kiểm kê được so với database nguồn hiện tại nếu nó còn; dòng PASS ghi
rõ cơ sở so sánh. Trong `./backups` hiện có 6 bản như vậy, chúng tự hết khi luật giữ 7 bản xóa dần.

## 6. Kết quả đã chạy

Ngày 08/11/2026, giờ Việt Nam (tên file theo UTC nên hiện `20261107`), trên container `db` của repo
với dữ liệu seed v1+v2+v3. Các tình huống hỏng chạy trên database tạm mang tên `chk54_*`; `cocoon` chỉ
được đọc và kiểm kê của nó giống hệt trước và sau khi chạy.

| Kiểm | Kết quả |
|---|---|
| `scripts/backup-db.sh` trên `cocoon` | `cocoon-20261107-173740.dump` (113558 bytes) và file `.inventory` 65 dòng |
| `scripts/restore-db.sh latest cocoon_restore_demo` | PASS trên 65 dòng kiểm kê, thoát 0 |
| Database nguồn bị xóa 70 dòng `Notification` sau khi sao lưu | PASS, bản phục hồi có đủ 70 dòng |
| Database nguồn bị xóa hẳn sau khi sao lưu | PASS, `latest` vẫn chọn đúng bản |
| File kiểm kê bị sửa lệch một số dòng | FAIL, thoát 3, `diff` chỉ đúng dòng `Notification` |
| Không có file kiểm kê và database nguồn không còn | `CHƯA ĐỐI CHIẾU`, thoát 4 |
| `latest` khi có bản của `cocoon_chk54` với thời gian mới hơn | Vẫn chọn bản của `cocoon` |
| Có ghi dữ liệu liên tục trong lúc sao lưu | Hủy bản sao lưu, thoát 3, không để lại file |
| Giữ 7 bản | Chạy 9 lần: còn 7 dump và 7 file kiểm kê; bản của `cocoon` không bị tính chung |
| Sáu chốt từ chối ở mục 4 | Đúng thông báo và mã thoát |
| `scripts/backup-db.ps1`, `scripts/restore-db.ps1` | Sao lưu thành công, phục hồi PASS, thiếu file thoát 1 |
| Lệnh `dropdb` do script in ra, chạy nguyên văn từ host | Xóa đúng database đã phục hồi |
| Các bước đổi tên ở mục 7 | `verify-seed-v3.sql` chạy trên bản đổi tên cho kết quả giống hệt `cocoon` (80 dòng) |
| API chạy trên bản phục hồi | Đăng nhập Manager 200; `reports/overview`, `reports/customers/age`, `reports/customers/preferences` 200; không có cookie 401 |
| So từng dòng của 29 bảng giữa `cocoon` và bản phục hồi | Hash giống nhau ở cả 29 bảng |

Số liệu khớp giữa kiểm kê lúc sao lưu và bản phục hồi, trong đó 28 bảng nghiệp vụ cùng
`__EFMigrationsHistory`, 3 view, materialized view `mv_product_copurchase` 36 dòng, 83 index, 44 khóa
ngoại, 23 sequence và 3 migration. Các bảng dữ liệu chính: Account 87, CustomerProfile 83,
CustomerPreference 325, Order 320, OrderItem 640, Feedback 60, SurveyAnswer 200, SurveyResponse 40,
SurveyRecipient 70, Notification 70.

Các database dùng để kiểm chứng đã được xóa sau khi đối chiếu xong; chạy lại script sẽ tạo bản mới.

## 7. Phục hồi khi database chính hỏng

Script không ghi lên database chính, nên quy trình thay thế là: phục hồi vào database mới, kiểm PASS,
rồi đổi tên để bản phục hồi mang tên `cocoon`. Giữ nguyên tên này vì `.env`, lệnh seed và
`db/verify-seed-v3.sh` đều gắn với nó. Cần người vận hành xác nhận trước bước 3, vì bước này tác động lên
database chính.

1. `rtk docker compose stop api` để không có ghi mới.
2. `rtk sh scripts/restore-db.sh latest cocoon_phuc_hoi` và đọc dòng PASS cùng bảng kiểm kê.
3. Đổi tên trong một lệnh. Nếu database chính đã mất thì bỏ phần `-c` đầu tiên:

   ```text
   rtk docker compose exec -T db sh -lc 'psql --username "$POSTGRES_USER" --dbname postgres -c "ALTER DATABASE cocoon RENAME TO cocoon_hong" -c "ALTER DATABASE cocoon_phuc_hoi RENAME TO cocoon"'
   ```

4. `rtk docker compose up -d api` rồi kiểm lại bằng
   `rtk docker compose exec -T db sh /workspace/db/verify-seed-v3.sh`.

Giữ `cocoon_hong` cho tới khi bản phục hồi được chấp nhận.

## 8. Giới hạn

- Phạm vi local Docker Compose. Không có sao lưu ngoài máy, không mã hóa file dump, không cron. Bản
  dump chứa dữ liệu demo và hash mật khẩu demo, nên không để nó ra khỏi máy phát triển.
- `pg_dump --format=custom` và `pg_restore` là công cụ của PostgreSQL. Đổi sang SQL Server sẽ cần công
  cụ sao lưu khác; đây là phụ thuộc đã ghi ở PRD §16 D8.
- Script sao lưu một database, không sao lưu cả cluster, không gồm role hay cấu hình server. Role ứng
  dụng được dựng lại bằng [db/create-app-role.sh](create-app-role.sh).
- Không có sao lưu tăng dần và không có WAL archiving, nên mốc phục hồi là lần sao lưu gần nhất.
- Kiểm kê so số dòng và cấu trúc, không so nội dung từng dòng; phép so hash ở mục 6 là kiểm tra làm tay.
