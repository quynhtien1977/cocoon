# COC-50 — Seed v1 local

Theo [COC-50](https://nguyenquoccuong07122004.atlassian.net/browse/COC-50), spec §9.1: tài khoản, sở thích, sản phẩm, khách hàng và đơn mua mô phỏng. Feedback được bổ sung bằng [seed v2 — COC-52](SEED_V2.md); khảo sát và kế hoạch gợi ý thuộc COC-55.

## Chạy seed

Từ repo root với `.env` local hiện có:

```powershell
rtk docker compose up -d api db
rtk docker compose exec api sh scripts/ef.sh database update -p src/Cocoon.Infrastructure -s src/Cocoon.Api
rtk docker compose exec api dotnet build
rtk docker compose exec api dotnet run --project src/Cocoon.Api --no-build --no-launch-profile -- seed
```

Nếu API đã chạy và build xong, chỉ cần:

```powershell
rtk docker compose exec api dotnet run --project src/Cocoon.Api --no-build --no-launch-profile -- seed
```

Lệnh dùng chính container `api` đang chạy và database trong `db`; không tạo service/container seed riêng. Tiến trình kết thúc sau khi seed, không mở thêm HTTP server và không yêu cầu JWT. Chỉ chấp nhận `Development`, host container `db`, port `5432`, database `cocoon`; kiểm tra trước kết nối/ghi. Không in connection string, mật khẩu hoặc token. Database còn migration chưa áp dụng thì seed dừng. Seed không tự chạy khi mở API; chạy từng lượt, không chạy đồng thời nhiều tiến trình seed.

## Dữ liệu ban đầu trên database trống

| Bảng / nhóm | Số lượng |
|---|---:|
| Account | 87: 1 Admin, 1 Manager, 2 Staff, 83 Customer |
| StaffProfile | 4, gồm Admin và Manager |
| CustomerProfile | 83: 80 active, 2 khóa, 1 xóa mềm |
| Preference | 12 |
| CustomerPreference | 248; mỗi khách 2–4 sở thích Declared |
| Category | 6 |
| Product | 24: 21 Active, 1 Inactive, 2 Upcoming |
| ProductVariant | 48; mỗi sản phẩm 1–3 biến thể |
| ProductPreference | 60; mỗi sản phẩm 2–3 tag |
| Order | 320: 288 Completed, 16 Cancelled, 16 Returned |
| OrderItem | 640; mỗi đơn 2 dòng |
| **Tổng thêm** | **1.532 bản ghi** |

Mốc sinh dữ liệu là ngày UTC lúc tạo mới. Đơn trải đủ 12 tháng gần nhất và ba kênh Website/Store/Marketplace; tổng tiền bằng tổng Quantity × UnitPrice (VND). Chỉ mua sản phẩm Active. 70% dòng mua trùng ít nhất một sở thích; có các cặp được nhiều khách cùng mua để phục vụ task phân tích sau.

Khách có đủ nhóm `<18`, `18–24`, `25–34`, `35–44`, `≥45`, 7 người thiếu DOB, 8 người không consent và 3 giá trị giới tính. Báo cáo/cá nhân hóa vẫn phải lọc consent ở service. Tên/giá/thành phần sản phẩm là dữ liệu mô phỏng. Ảnh giữ chỗ là SVG cố định mã hóa trong ImageUrl, gồm màu danh mục và tên; không tải ảnh bên ngoài.

## Tài khoản demo

Mật khẩu **chỉ dùng cho local demo** khi tạo mới: `Demo@12345`.

| Email | Vai trò / trạng thái ban đầu |
|---|---|
| admin@cocoon.demo | Admin |
| manager@cocoon.demo | Manager |
| staff1@cocoon.demo, staff2@cocoon.demo | Staff |
| customer01@cocoon.demo … customer80@cocoon.demo | Customer active |
| customer81@cocoon.demo, customer82@cocoon.demo | Customer khóa |
| customer83@cocoon.demo | Customer xóa mềm |

PasswordHasher<Account> hash mật khẩu như auth. Chạy lại không đặt lại mật khẩu đã đổi hoặc mở khóa tài khoản.

## Chạy lặp và giữ dữ liệu

- Tái sử dụng email demo, tên danh mục/sở thích, SKU `COC-V1-001-1`… và mã đơn `CO-V1-000001`…; không gán ID cứng hoặc đổi sequence.
- Giữ password hash, trạng thái khóa/xóa mềm, profile, tên/trạng thái sản phẩm, giá biến thể và dữ liệu ngoài seed. IgnoreQueryFilters chỉ để nhận ra bản ghi đã có.
- Chỉ khởi tạo sở thích/tag khi thêm profile/product mới; giữ lựa chọn người dùng đã sửa hoặc bỏ.
- Đơn đã có giữ nguyên dòng, giá và ngày mua; không tính lại giá lịch sử theo giá catalog mới.
- Vai trò của email demo khác dự kiến, SKU mâu thuẫn hoặc catalog/preference đã chỉnh khiến không sinh được đơn theo quy luật: dừng, không tự sửa dữ liệu để chạy tiếp.
- Một lượt nằm trong một transaction; lỗi giữa chừng rollback lượt đó. Không xóa/reset dữ liệu có trước.

Số lượng và tỷ lệ trên mô tả database trống mới seed; không ép dữ liệu đã sửa về trạng thái ban đầu. Trên bộ seed đầy đủ, chưa chỉnh sửa, chạy lần hai báo thêm **0 bản ghi**.

## Kiểm chứng ngày 23/10/2026

[verify-seed-v1.sql](verify-seed-v1.sql) chỉ đọc counts, trạng thái, tổng tiền, số tháng, tỷ lệ trùng sở thích và cặp mua cùng; không chọn password hash/token. Wrapper lấy database/tài khoản từ môi trường local, không in credentials:

```powershell
rtk docker compose exec -T db sh /workspace/db/verify-seed-v1.sh
```

Script dùng để đối chiếu database trống mới seed; dữ liệu khác có thể làm tổng thay đổi.

- PostgreSQL18 kiểm thử riêng, migrate từ trống; fixture seed có database riêng và chỉ dọn database nó tạo.
- Full backend suite **51/51 pass**, không skip; Release build **0 warning / 0 error**.
- Có RED trước khi triển khai dữ liệu seed và guard target. Test kiểm counts/role/hash/normalization/tuổi/catalog/đơn/70%/cặp mua cùng, giữ user edits khi chạy lặp và rollback khi lỗi.
- CLI từ chối database chưa migrate. Sau migrate: lượt1 thêm **1.532**, lượt2 thêm **0**.
- SQL: **12 tháng**, **0** tổng tiền sai, **0** dòng mua không hợp lệ, **70,00%** trùng sở thích; **7** cặp có ít nhất3 khách mua Completed.
- Đã áp dụng các EF migration hiện có còn thiếu vào database Compose local của project và chạy seed thực tế: lần đầu thêm **1.532**, lần hai thêm **0**; SQL local khớp kết quả trên. Container/network kiểm thử riêng và file chứa secret tạm đã dọn; database local giữ lại để demo.
- Frontend lint và typecheck pass sau khi cài node_modules đúng lockfile; không sửa manifest/lockfile. `npm audit --omit=dev` phát hiện Next16.4.0 có advisory critical hiện có, xem ghi chú bên dưới.

COC-50 không thêm schema hoặc endpoint. Bộ seed không chứng minh các endpoint CRM còn stub đã được triển khai.

## Vấn đề ngoài COC-50

Ngày23/10/2026, audit production báo1 package critical: `next@16.4.0`, gồm [GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw), [GHSA-673q-mjm6-r5xr](https://github.com/advisories/GHSA-673q-mjm6-r5xr) và advisory high [GHSA-p3m5-59mp-jv5r](https://github.com/advisories/GHSA-p3m5-59mp-jv5r). Đây là phiên bản đã có trong manifest/lockfile trước task seed. Audit gợi ý16.4.3; chưa nâng dependency trong COC-50. Cần xử lý bằng task cập nhật dependency riêng trước triển khai thực tế; không coi build/typecheck pass là dependency audit pass.

Đối chiếu giới hạn ảnh hưởng: lockfile hiện có `sharp@0.35.5`, khớp workaround mà GHSA-2464-fhr4-w9xw nêu; `next.config.ts` hiện không bật `cacheComponents`. Đây là hai điều kiện cấu hình đã kiểm, không phải kết luận mọi đường khai thác đều an toàn hoặc cảnh báo Next đã hết.
