# COC-50 — Seed v1 local

Theo [COC-50](https://nguyenquoccuong07122004.atlassian.net/browse/COC-50), spec §9.1: tài khoản, sở thích, sản phẩm, khách hàng và đơn mua mô phỏng. Feedback được bổ sung bằng [seed v2 — COC-52](SEED_V2.md); khảo sát và kế hoạch gợi ý thuộc COC-55.

## Chạy seed

Từ repo root với `.env` local hiện có, khi container API **chưa** chạy:

```powershell
rtk docker compose up -d api db
rtk docker compose exec api sh scripts/ef.sh database update -p src/Cocoon.Infrastructure -s src/Cocoon.Api
rtk docker compose exec api dotnet build
rtk docker compose exec api dotnet run --project src/Cocoon.Api --no-build --no-launch-profile -- seed
```

Nếu API đã chạy và build xong, chỉ cần:

```powershell
rtk docker compose exec api dotnet ef database update -p src/Cocoon.Infrastructure -s src/Cocoon.Api
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
| ProductVariant | 35; mỗi sản phẩm 1–3 quy cách có thật |
| ProductPreference | 60; mỗi sản phẩm 2–3 tag |
| Order | 320: 288 Completed, 16 Cancelled, 16 Returned |
| OrderItem | 640; mỗi đơn 2 dòng |
| **Tổng thêm** | **1.519 bản ghi** |

Mốc sinh dữ liệu là ngày UTC lúc tạo mới. Đơn trải đủ 12 tháng gần nhất và ba kênh Website/Store/Marketplace; tổng tiền bằng tổng Quantity × UnitPrice (VND). Chỉ mua sản phẩm Active. 70% dòng mua trùng ít nhất một sở thích; có các cặp được nhiều khách cùng mua để phục vụ task phân tích sau.

Khách có đủ nhóm `<18`, `18–24`, `25–34`, `35–44`, `≥45`, 7 người thiếu DOB, 8 người không consent và 3 giá trị giới tính. Báo cáo/cá nhân hóa vẫn phải lọc consent ở service. Tên sản phẩm, quy cách, giá và ảnh lấy từ website Cocoon chính thức, đối chiếu ngày **05/11/2026**. Giá là snapshot tại thời điểm đối chiếu, không tự cập nhật theo khuyến mãi. Khách hàng, đơn, sở thích, tag và trạng thái bán hàng vẫn là dữ liệu demo; không phải dữ liệu kinh doanh của Cocoon.

## Catalog chính thức — cập nhật 05/11/2026

Đã thay toàn bộ 24 nhóm sản phẩm bằng sản phẩm có thật và 35 quy cách tương ứng; không tạo mới placeholder. [Bảng thay thế và 35 trang nguồn](COCOON_CATALOG.md) ghi rõ tên cũ → tên mới, quy cách, giá và link ảnh chính thức. Snapshot nằm trong `src/Cocoon.Infrastructure/Seeding/cocoon-catalog.json`, được nhúng vào assembly Infrastructure: seed không gọi mạng, không tải ảnh hoặc phụ thuộc thư mục FE lúc chạy.

Ảnh là `og:image` của đúng trang sản phẩm/quy cách trên `cocoonvietnam.com`, được phục vụ từ `image.cocoonvietnam.com`. Đã GET kiểm tra cả 35 URL: HTTP 200, MIME ảnh và signature JPEG/PNG/WebP hợp lệ. Không suy diễn ảnh từ nguyên liệu hoặc lấy một ảnh chung cho cả danh mục. Thành phần/công dụng/cách dùng trỏ người dùng tới nguồn chính thức thay vì giữ nội dung tự bịa trong seed cũ.

Chạy lại `seed`/`seed-v2`/`seed-v3` sẽ nhận diện nhóm bằng SKU `COC-V1-001-*`…`COC-V1-024-*`, giữ nguyên ProductId/VariantId/SKU và các liên kết hiện có. Chỉ thay trường còn khớp chính xác default seed cũ: tên/normalized/category/mô tả, tên quy cách/giá và SVG hoặc 4 URL ảnh của bản sửa trước. Giữ tên/mô tả/giá/ảnh tự chỉnh, SVG khác, ảnh null, bản ghi đã xóa mềm và variant thủ công. Không đổi trạng thái demo của sản phẩm, tài khoản hoặc sở thích.

Seed cũ có 48 variant, gồm 13 quy cách 100/200/300ml tự sinh không có trang nguồn phù hợp. Chỉ **xóa mềm** quy cách thừa khi nó còn nguyên tên/giá/ảnh seed cũ và chưa được bất kỳ OrderItem nào dùng. Không hard delete hoặc đổi ID/SKU. Nếu có lịch sử, chỉnh sửa hoặc đã xóa mềm thì giữ nguyên, không ép dữ liệu team về baseline. Vì vậy DB nâng cấp nguyên bản còn 48 hàng vật lý: 35 đang dùng, 13 đã ngừng dùng; DB trống mới chỉ có 35. Giá/Quantity/UnitPrice/tổng tiền và ngày đơn cũ không được tính lại theo giá mới. Tên sản phẩm hiển thị qua liên kết hiện tại sẽ theo catalog mới.

CLI chỉ đếm insert; trên DB cũ có thể báo thêm 0 nhưng vẫn nâng cấp metadata. Chạy lần tiếp theo không đổi dữ liệu đã nâng cấp. Trạng thái 21 Active/1 Inactive/2 Upcoming được giữ để demo workflow; không diễn giải là thông báo ngừng bán/sắp ra mắt thực tế của thương hiệu. Tag sản phẩm vẫn là quy luật demo để kiểm thử gợi ý, không phải phân loại chính thức của Cocoon.

## Seed và kiểm thử luồng

Seed là chuẩn bị bộ dữ liệu ban đầu có thể chạy lặp. Ghi trực tiếp qua EF Core là cách hợp lệ; không cần xóa DB rồi tạo mọi bản ghi qua UI/API. Bộ dữ liệu hiện tại phục vụ demo và phủ tình huống, không phải dữ liệu hoạt động thật của Cocoon. Xem [EF Core data seeding](https://learn.microsoft.com/en-us/ef/core/modeling/data-seeding).

Seed không chứng minh feature hoạt động: COC-56 vẫn cần đăng nhập đúng role, tạo phản hồi mới, tiếp nhận/giao/trả lời, gửi và nộp khảo sát, rebuild gợi ý rồi kiểm tra dữ liệu phát sinh qua API/DB. Nên thực hiện trên dữ liệu seed hiện có hoặc DB test riêng, không reset dữ liệu team đang dùng. Khi người dùng đã thao tác, không ép counts/tỷ lệ về baseline của DB mới.

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
- Giữ password hash, trạng thái khóa/xóa mềm, profile, các trường tự chỉnh và dữ liệu ngoài seed. Ngoại lệ nâng cấp default catalog cũ được mô tả ở trên; IgnoreQueryFilters giúp nhận ra bản ghi đã có, không khôi phục bản ghi bị xóa mềm.
- Chỉ khởi tạo sở thích/tag khi thêm profile/product mới; giữ lựa chọn người dùng đã sửa hoặc bỏ.
- Đơn đã có giữ nguyên dòng, giá và ngày mua; không tính lại giá lịch sử theo giá catalog mới.
- Vai trò của email demo khác dự kiến, SKU mâu thuẫn hoặc catalog/preference đã chỉnh khiến không sinh được đơn theo quy luật: dừng, không tự sửa dữ liệu để chạy tiếp.
- Một lượt nằm trong một transaction; lỗi giữa chừng rollback lượt đó. Không xóa/reset dữ liệu có trước.

Số lượng và tỷ lệ trên mô tả database trống mới seed; không ép dữ liệu đã sửa về trạng thái ban đầu. Trên bộ seed đầy đủ, chưa chỉnh sửa, chạy lần hai báo thêm **0 bản ghi**.

## Kiểm chứng catalog ngày 05/11/2026

- Seed mới trên database test trống: 24 Product/35 ProductVariant, thêm 1.519 bản ghi v1; mỗi sản phẩm 1–3 quy cách, toàn bộ tên/giá/quy cách/ảnh khớp snapshot nguồn.
- Kiểm nâng cấp 48 variant cũ: giữ IDs/SKUs/lịch sử đơn, 13 quy cách thừa xóa mềm; giữ custom/null/manual/deleted/variant đã có lịch sử; chạy lặp không đổi dữ liệu.
- Seed-focused 12/12 và toàn backend 148/148 pass, không skip; Release 0 warning/0 error. Không thay UI, schema, API hoặc Docker Compose.
- DB local: 24 sản phẩm, 35 quy cách đang dùng, 13 quy cách cũ xóa mềm, không còn placeholder. Hai lượt seed thêm 0/0; fingerprints 22 bảng ngoài catalog giữ nguyên, lần hai không đổi dữ liệu. API chi tiết 24/24 sản phẩm trả HTTP 200 và metadata đúng DB.
- SQL local: 320 đơn/640 dòng, 12 tháng, 0 tổng tiền sai và 0 dòng mua không hợp lệ. Tỷ lệ trùng sở thích 78,59% do v3 đã bổ sung tag Survey; nâng cấp catalog không sửa tag hoặc lịch sử.

## Kiểm chứng lịch sử ngày 23/10/2026

Các số 48 variant/1.532 bản ghi dưới đây thuộc catalog mô phỏng trước khi chuẩn hóa; baseline mới ở bảng phía trên.

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
