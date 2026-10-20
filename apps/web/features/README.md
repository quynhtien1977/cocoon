# features/

Một thư mục cho mỗi module (spec mục 8.4): `auth`, `profile`, `home`, `orders`, `accounts`, `customers`, `feedback`, `surveys`, `products`, `recommendations`, `reports`.

```
features/<module>/
  api.ts        React Query hooks gọi lib/api/client.ts; query key dạng ["customers", params]
  schemas.ts    zod schema cho form, suy từ types OpenAPI (lib/api/schema.d.ts)
  components/   component riêng của module
  *.fixture.ts  dữ liệu mẫu cho giai đoạn UI tĩnh; xóa khi nối API thật
```

Quy tắc:

- `app/**` chỉ import từ `features/**`, `components/**` và `lib/**`.
- `features/A` không import `features/B`. Thứ dùng chung (ví dụ `ProductCard`, `SegmentFilterBuilder`) đặt ở `components/`.
- Mỗi trang trong `app/` hiện là placeholder `ScreenPlaceholder` với mã màn (U1, C0, M4...) khớp `lib/screens.ts`, spec 8.1 và task trên Jira COC. Thay placeholder bằng component thật của module, giữ mã màn trong `PageHeader` để ảnh chụp map đúng vào báo cáo.
