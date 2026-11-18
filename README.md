# Cocoon CRM

Monorepo đồ án HTTTDN 841065: Next.js chạy trên host, ASP.NET Core .NET 10 và PostgreSQL 18 chạy trong Docker Compose. Thiết kế giao diện, CSDL, API và phân công: [spec 15/10/2026](plan/superpowers/specs/2026-10-15-crm-ui-architecture-design.md); backlog: [plan/jira-backlog-cocoon.csv](plan/jira-backlog-cocoon.csv).

## Cấu trúc

| Thư mục | Nội dung |
|---|---|
| `apps/web` | Next.js 16: 5 route group `(public)`, `(customer)`, `(staff)`, `(manager)`, `(admin)`; `components`, `features`, `lib`, `proxy.ts` |
| `src/Cocoon.Api` | Controller `/api/v1`, auth JWT, CLI seed (`Seeding/LocalSeedCommand.cs`) |
| `src/Cocoon.Domain` | Entity và enum |
| `src/Cocoon.Infrastructure` | `AppDbContext`, EF migration, dữ liệu seed (`Seeding/`) |
| `tests/Cocoon.Tests` | Test backend (xUnit, database `cocoon_tests`) |
| `db` | `schema.sql` xuất từ migration, `openapi.json`, tài liệu và SQL kiểm chứng seed, `create-app-role.sh`, `backup.sh`/`restore.sh`/`verify-restore.sql` (mount vào container `db` tại `/workspace/db`) |
| `scripts` | `init-local-env.ps1`, `start-api.sh`, `ef.sh`, `backup-db.sh`/`.ps1`, `restore-db.sh`/`.ps1` |
| `backups` | File `.dump` do sao lưu tạo ra, giữ 7 bản gần nhất; không theo dõi trong Git |

## Trạng thái

- **Hạ tầng (0B):** Docker Compose, health API, JWT bearer từ cookie, policy bốn vai trò, CORS, ProblemDetails, log Serilog, OpenAPI/Scalar.
- **CSDL:** migration `InitialCreate` và `AddOrdersAndRecommendations`. Auth có đăng ký, đăng nhập, refresh, logout, hồ sơ/sở thích và kiểm tra tài khoản mỗi request.
- **API CRM:** route và policy đã có trong OpenAPI theo hướng contract-first; phần lớn endpoint Customers, Products, Feedback, Surveys, Reports và cổng khách hàng (`me/*`) vẫn trả `501 Not Implemented`.
- **Seed:** [seed v1 — COC-50](db/SEED_V1.md) gồm tài khoản, sở thích, sản phẩm, khách hàng và đơn mua mô phỏng. Seed phản hồi, khảo sát, kế hoạch gợi ý (v2/v3) làm ở task sau. Bộ seed không chứng minh endpoint stub đã hoàn thành.
- **Web:** shell cho 5 vai trò; cổng khách hàng có sản phẩm, giỏ, đơn, phản hồi, khảo sát, hồ sơ và gợi ý. Màn chưa có API thật dùng dữ liệu xem trước.

## Yêu cầu máy

- Docker Desktop chạy Linux containers. Compose tự pull `postgres:18` khi máy chưa có image (`pull_policy: missing`); image `mcr.microsoft.com/dotnet/sdk:10.0` dùng cho container API.
- Node.js 24 LTS + npm (đã kiểm tra Node `24.11.1`, npm `11.6.2`). Không cần SDK .NET trên Windows.
- RTK; chạy mọi lệnh từ gốc repo trừ bước frontend. Chạy lệnh .NET trong container để giữ đầu ra Linux riêng (`bin-docker/`, `obj-docker/`).

## Cổng và kết nối

| Dịch vụ | Từ máy host | Trong mạng Compose |
|---|---|---|
| PostgreSQL | `localhost:5433` (`DB_HOST_PORT`) | `db:5432` |
| API | <http://localhost:5080> (`API_HTTP_PORT`) | `api:8080` |
| Web | <http://localhost:3000> | chạy trên host, không nằm trong Compose |
| MinIO (ảnh phản hồi) | API S3 `localhost:9010`, console <http://localhost:9011> (`MINIO_HOST_PORT`, `MINIO_CONSOLE_PORT`) | `minio:9000` |

Các cổng chỉ bind `127.0.0.1`. Cổng DB mặc định là `5433` để không đụng PostgreSQL cài sẵn trên Windows ở `5432`. Đổi `DB_HOST_PORT` chỉ đổi cổng ra host; container API luôn nối `db:5432` và Compose tự ghép chuỗi kết nối, không cần lưu chuỗi này trong `.env`. Công cụ DB trên host (DBeaver, pgAdmin, `psql`) nối `localhost:5433` với `POSTGRES_USER`/`POSTGRES_PASSWORD` trong `.env`.

Container `db` có `restart: unless-stopped`: tự bật lại cùng Docker Desktop cho tới khi bạn dừng nó bằng `docker compose stop`.

## Chạy local trên Windows

```powershell
rtk proxy powershell -NoProfile -File scripts/init-local-env.ps1
rtk docker compose up -d --build
rtk docker compose exec api dotnet ef database update -p src/Cocoon.Infrastructure -s src/Cocoon.Api
```

Script đầu tiên chỉ tạo `.env` từ `.env.example` khi chưa có, sinh mật khẩu DB và khóa JWT độc lập, không in giá trị. Nếu đã có `.env`, script giữ nguyên giá trị; bạn tự đối chiếu đủ tên biến với `.env.example`. Mặc định database `cocoon`, DB host port `5433`, API `5080`, web `3000`. Giữ `POSTGRES_DB=cocoon`: seed và database test chỉ chạy với database tên `cocoon`. Không đưa `.env` vào Git.

Đã có `.env` cũ từ trước khi có MinIO? Thêm `MINIO_ROOT_USER=cocoon` và `MINIO_ROOT_PASSWORD=<chuỗi ngẫu nhiên dài>` (xem `.env.example`), nếu không `docker compose` báo thiếu biến. Ảnh phản hồi nằm trong bucket `MINIO_BUCKET` (mặc định `cocoon-feedback`, API tự tạo khi upload lần đầu) và volume `minio-data`; MinIO không mở ra ngoài, ảnh chỉ đọc được qua `GET /api/v1/feedback-photos/{id}` sau khi API kiểm tra quyền. Image MinIO chính thức trên Docker Hub/quay.io không còn kéo được nên Compose dùng bản build của Chainguard, ghim theo digest.

Đã có `.env` cũ với `DB_HOST_PORT=5432`? Sửa thành `5433` (hoặc xóa dòng để dùng mặc định) rồi chạy `rtk docker compose up -d` để tạo lại container. Volume `postgres-data` giữ nguyên dữ liệu. Gặp lỗi kết nối xem [Xử lý sự cố](#xử-lý-sự-cố).

Trong `apps/web`:

```powershell
rtk npm ci --ignore-scripts
rtk npm run dev
```

- Web: <http://localhost:3000>.
- Health: <http://localhost:5080/api/v1/health>.
- API docs: <http://localhost:5080/swagger/>; JSON: <http://localhost:5080/swagger/v1/swagger.json>.
- API qua Next.js: <http://localhost:3000/api/v1/health>.

Next.js dùng `API_URL` của môi trường chạy frontend, mặc định `http://localhost:5080`. Nếu đổi cổng API, đặt `API_URL` trong `apps/web/.env.local`; không dùng biến `NEXT_PUBLIC_` cho cấu hình riêng. Đổi origin/cổng web thì cập nhật `WEB_ORIGIN` ở `.env` gốc và tạo lại container API.

## Seed dữ liệu demo

Chi tiết dữ liệu, quy tắc chạy lặp và kiểm chứng: [db/SEED_V1.md](db/SEED_V1.md).

Seed chạy trong chính container `api`, không tạo container seed riêng. Khi container API chưa chạy:

```powershell
rtk docker compose up -d api db
rtk docker compose exec api sh scripts/ef.sh database update -p src/Cocoon.Infrastructure -s src/Cocoon.Api
rtk docker compose exec api dotnet build
rtk docker compose exec api dotnet run --project src/Cocoon.Api --no-build --no-launch-profile -- seed
```

Khi API đang chạy và đã build xong:

```powershell
rtk docker compose exec api dotnet ef database update -p src/Cocoon.Infrastructure -s src/Cocoon.Api
rtk docker compose exec api dotnet run --project src/Cocoon.Api --no-build --no-launch-profile -- seed
```

Kiểm chứng số liệu (chỉ đọc, không in credentials):

```powershell
rtk docker compose exec -T db sh /workspace/db/verify-seed-v1.sh
```

Seed chỉ chạy ở `Development` với host `db`, port `5432` trong mạng Compose và database `cocoon`; sai một điều kiện thì dừng trước khi ghi. Seed không tự chạy khi mở API, không reset dữ liệu và chạy lặp giữ dữ liệu đã có. Trên database trống, seed thêm 87 tài khoản (83 Customer), 12 sở thích, 24 sản phẩm/48 biến thể và 320 đơn/640 dòng — tổng 1.532 bản ghi; lượt thứ hai thêm 0.

| Email | Vai trò |
|---|---|
| `admin@cocoon.demo` | Admin |
| `manager@cocoon.demo` | Manager |
| `staff1@cocoon.demo`, `staff2@cocoon.demo` | Staff |
| `customer01@cocoon.demo` … `customer80@cocoon.demo` | Customer |

Mật khẩu demo `Demo@12345` khi mới tạo. `customer81`, `customer82` bị khóa; `customer83` đã xóa mềm. Không sử dụng các giá trị demo ở production.

## Migration và kiểm thử

```powershell
rtk docker compose exec api dotnet build
rtk docker compose exec api dotnet test
rtk docker compose exec api dotnet ef migrations script -p src/Cocoon.Infrastructure -s src/Cocoon.Api --output db/schema.sql
```

Database test chỉ chạy với connection host `db`, database `cocoon` trong Compose local. Fixture tạo database riêng `cocoon_tests` khi chưa có, áp dụng migration vào đó và rollback từng transaction. Không xóa hoặc reset database local chính. Test HTTP dùng host in-memory và controller chỉ tồn tại trong assembly test; không thêm endpoint kiểm thử vào API chạy thật.

Nếu API không chạy, dùng one-off container (`db` phải đang chạy vì có `--no-deps`):

```powershell
rtk npm test
rtk npm run lint
rtk npm run typecheck
rtk npx tsc --noEmit
rtk npm run build
```

Nếu API chưa chạy, khởi động hai service hiện có rồi dùng `exec`:

```powershell
rtk docker compose up -d api db
rtk docker compose exec api sh scripts/ef.sh database update -p src/Cocoon.Infrastructure -s src/Cocoon.Api
rtk docker compose exec api dotnet test
```

`scripts/ef.sh` restore local tool manifest trước khi chạy EF. Container API cũng tự restore tool khi khởi động. Các lệnh migration/test/seed dùng chung container `api`; không cần service hoặc container seed riêng. Không chạy nhiều build/EF/test đồng thời trên cùng thư mục đầu ra. Dừng server bằng `rtk docker compose stop`; giữ volume dữ liệu.

`db/schema.sql` được xuất từ migration, dùng để dựng **database mới trống**, không chạy đè database đã migrate. Không sửa trực tiếp schema SQL để tạo lịch sử schema khác với EF.

COC-42 bổ sung [bốn view phân tích](db/ANALYTICS_VIEWS.md) qua migration `AddAnalyticsViews`. Sau khi thay đổi dữ liệu đơn/seed, COC-43 cần refresh `mv_product_copurchase` trước khi tính lại gợi ý. Dùng `rtk docker compose exec -T db sh /workspace/db/verify-analytics.sh` để đối chiếu các view với dữ liệu nguồn; không cần thêm service Docker.

## Sao lưu và phục hồi

```powershell
rtk powershell -File scripts\backup-db.ps1
rtk powershell -File scripts\restore-db.ps1
```

Trên Git Bash hoặc Linux dùng `rtk sh scripts/backup-db.sh` và `rtk sh scripts/restore-db.sh` với cùng tham số.

Sao lưu chạy `pg_dump --format=custom` trong container `db`, ghi file `cocoon-<YYYYMMDD>-<HHMMSS>.dump` theo giờ UTC kèm file kiểm kê `.inventory` vào `./backups` và giữ **7 bản gần nhất**. Thư mục `backups/` nằm trong `.gitignore` và `.dockerignore`.

Phục hồi luôn tạo **database mới** rồi tự đối chiếu với kiểm kê lưu lúc sao lưu trên bảng, view, số dòng, index, ràng buộc, sequence và lịch sử migration, kết thúc bằng PASS hoặc FAIL, nên vẫn dùng được khi database chính đã hỏng hoặc không còn. Script từ chối ghi lên database chính và từ chối một database đích đã tồn tại; không có cờ bỏ qua. Service `db` cần mount ghi được `./backups:/workspace/backups`, nên lần đầu phải `rtk docker compose up -d db` để container được tạo lại; volume dữ liệu không bị ảnh hưởng.

Phương án đầy đủ, các chốt an toàn và kết quả đã chạy: [db/BACKUP_RESTORE.md](db/BACKUP_RESTORE.md).

## Tài khoản demo và giới hạn

Chạy [seed v1 — COC-50](db/SEED_V1.md) để tạo tài khoản demo và dữ liệu nền. Lệnh chỉ chạy trong Compose Development local, không tự chạy khi mở API và không reset dữ liệu:

```powershell
rtk docker compose up -d api db
rtk docker compose exec api dotnet build
rtk docker compose exec api dotnet run --project src/Cocoon.Api --no-build --no-launch-profile -- seed
```

Database phải chạy và đã áp dụng migration theo hướng dẫn local bên trên. Trên database trống, seed thêm 87 tài khoản (83 Customer), 12 sở thích, 24 sản phẩm/48 biến thể và 320 đơn/640 dòng. Chạy lặp giữ dữ liệu đã có. Tài khoản `admin@cocoon.demo`, `manager@cocoon.demo`, `staff1@cocoon.demo`, `staff2@cocoon.demo`, `customer01@cocoon.demo`… dùng mật khẩu demo `Demo@12345` khi mới tạo. Không sử dụng các giá trị demo ở production.

[Seed v2 — COC-52](db/SEED_V2.md) bổ sung 60 phản hồi đủ 5 trạng thái, 36 lịch sử phân công và 24 câu trả lời. Chạy trong chính container API sau khi build:

```powershell
rtk docker compose exec api dotnet run --project src/Cocoon.Api --no-build --no-launch-profile -- seed-v2
rtk docker compose exec -T db sh /workspace/db/verify-seed-v2.sh
```

`seed-v2` cũng thêm dữ liệu v1 còn thiếu và giữ các bản ghi đã có; `seed` vẫn chỉ chạy v1. Khảo sát/kế hoạch gợi ý thuộc COC-55. Backend áp dụng authorization cho controller không public. Next.js 16 dùng convention `proxy.ts` theo tài liệu đi kèm package.

Audit dependency production không có cảnh báo tại lần kiểm tra 12/10/2026. Dependency ESLint còn advisory `GHSA-vfj7-8cjw-p6xm` ở `braces <=3.0.3`, chưa có bản stable mới hơn khi kiểm tra. Chuỗi này dùng cho glob file local của lint, không xử lý request/người dùng trong runtime web; không hạ Next.js để làm mất cảnh báo. Bàn giao có ghi việc theo dõi bản vá.

Cập nhật 23/10/2026: audit production hiện báo critical cho `next@16.4.0`; chi tiết và giới hạn đối chiếu tại [ghi chú COC-50](db/SEED_V1.md#vấn-đề-ngoài-coc-50). Chưa cập nhật dependency trong task seed.
