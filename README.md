# Cocoon CRM

Monorepo đồ án HTTTDN 841065: Next.js trên host, ASP.NET Core .NET 10 và PostgreSQL 18 trong Docker Compose. Yêu cầu sản phẩm: [docs/PRD.md](docs/PRD.md); quyết định triển khai: [docs/DECISIONS.md](docs/DECISIONS.md).

## Trạng thái

Giai đoạn 0B: Docker Compose, health API, JWT bearer từ cookie, policy bốn vai trò, CORS, ProblemDetails, log Serilog và OpenAPI/Scalar.

Phần GPT của 0C: 23 entity, DbContext, `InitialCreate`, script schema, fetch client có refresh một lần và rewrite API. UI, shadcn và layout năm nhóm route được bàn giao cho Antigravity. Scaffold chưa có đăng nhập, endpoint refresh, seed hay tính năng CRM; cấu hình JWT hiện chỉ là nền tảng. Kiểm tra tài khoản trong DB mỗi request được triển khai ở Giai đoạn 1 trước khi có endpoint nghiệp vụ.

## Yêu cầu máy

- Docker Desktop chạy Linux containers; image `postgres:18` và `mcr.microsoft.com/dotnet/sdk:10.0` có sẵn. Compose không pull lại PostgreSQL.
- Node.js 24 LTS + npm (đã kiểm tra Node `24.11.1`, npm `11.6.2`). Không cần SDK .NET trên Windows.
- RTK; chạy mọi lệnh từ gốc repo trừ bước frontend. Chạy lệnh .NET trong container để giữ đầu ra Linux riêng.

## Chạy local trên Windows

```powershell
rtk proxy powershell -NoProfile -File scripts/init-local-env.ps1
rtk docker compose up -d --build
rtk docker compose exec api dotnet ef database update -p src/Cocoon.Infrastructure -s src/Cocoon.Api
```

Script đầu tiên chỉ tạo `.env` khi chưa có, sinh mật khẩu DB và khóa JWT độc lập, không in giá trị. Nếu đã có `.env`, giữ nguyên các giá trị và kiểm tra đủ tên biến trong `.env.example`. Mặc định database `cocoon`, host container `db`, DB host port `5432`, API `5080`, web `3000`. Không đưa `.env` vào Git. Compose tự ghép chuỗi kết nối, không cần lưu chuỗi này trong env example.

Trong `apps/web`:

```powershell
rtk npm ci --ignore-scripts
rtk npm run dev
```

- Web: <http://localhost:3000> (hiện còn giao diện template, chờ Antigravity).
- Health: <http://localhost:5080/api/v1/health>.
- API docs: <http://localhost:5080/swagger/>; JSON: <http://localhost:5080/swagger/v1/swagger.json>.
- API qua Next.js: <http://localhost:3000/api/v1/health>.

Next.js dùng `API_URL` của môi trường chạy frontend, mặc định `http://localhost:5080`. Nếu đổi cổng API, đặt `API_URL` trong `apps/web/.env.local`; không dùng biến `NEXT_PUBLIC_` cho cấu hình riêng. Đổi origin/cổng web thì cập nhật `WEB_ORIGIN` ở `.env` gốc và tạo lại container API.

## Migration và kiểm thử

```powershell
rtk docker compose exec api dotnet build
rtk docker compose exec api dotnet test
rtk docker compose exec api dotnet ef migrations script -p src/Cocoon.Infrastructure -s src/Cocoon.Api --output db/schema.sql
```

Database test chỉ chạy với connection host `db`, database `cocoon` trong Compose local. Fixture tạo database riêng `cocoon_tests` khi chưa có, áp dụng migration vào đó và rollback từng transaction. Không xóa hoặc reset database local chính. Test HTTP dùng host in-memory và controller chỉ tồn tại trong assembly test; không thêm endpoint kiểm thử vào API chạy thật.

Trong `apps/web`:

```powershell
rtk npm test
rtk npm run lint
rtk npm run typecheck
rtk npx tsc --noEmit
rtk npm run build
```

Nếu API không chạy, dùng one-off container:

```powershell
rtk docker compose run --rm --no-deps api sh scripts/ef.sh database update -p src/Cocoon.Infrastructure -s src/Cocoon.Api
rtk docker compose run --rm --no-deps api dotnet test
```

`scripts/ef.sh` restore local tool manifest trước khi chạy EF vì resolver state không được giữ giữa các one-off container. Container API cũng tự restore tool khi khởi động. Không chạy nhiều build/EF/test đồng thời trên cùng thư mục đầu ra. Dừng server bằng `rtk docker compose stop`; giữ volume dữ liệu.

`db/schema.sql` được xuất từ migration, dùng để dựng **database mới trống**, không chạy đè database đã migrate. Không sửa trực tiếp schema SQL để tạo lịch sử schema khác với EF.

## Tài khoản demo và giới hạn

Chưa có seed hoặc tài khoản đăng nhập. Theo PRD, các giai đoạn sau sẽ tạo `admin@cocoon.demo`, `manager@cocoon.demo`, `staff1@cocoon.demo`, `staff2@cocoon.demo`, `customer01@cocoon.demo`… với mật khẩu demo `Demo@12345`. Không sử dụng các giá trị demo ở production.

Sao lưu/phục hồi, seed dữ liệu, state machine phản hồi, chuẩn hóa tìm kiếm và tính năng auth/CRM được thực hiện ở các giai đoạn sau. `proxy.ts` hiện là khung pass-through, không kiểm tra role; backend vẫn áp dụng authorization cho controller không public. Next.js 16 đã đổi convention `middleware.ts` thành `proxy.ts` theo tài liệu đi kèm package.

Audit dependency production không có cảnh báo tại lần kiểm tra 12/10/2026. Dependency ESLint còn advisory `GHSA-vfj7-8cjw-p6xm` ở `braces <=3.0.3`, chưa có bản stable mới hơn khi kiểm tra. Chuỗi này dùng cho glob file local của lint, không xử lý request/người dùng trong runtime web; không hạ Next.js để làm mất cảnh báo. Bàn giao có ghi việc theo dõi bản vá.
