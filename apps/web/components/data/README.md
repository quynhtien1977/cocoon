# DataTable

Client component: truyền toàn bộ tập dữ liệu vào `data`; bảng tìm kiếm, lọc, sắp xếp và phân trang ở trình duyệt. Không truyền một trang API đã phân trang vì số kết quả sẽ không phản ánh toàn bộ dữ liệu. Feature chịu trách nhiệm gọi API, trạng thái `loading`, `error` và callback `onRetry`.

```tsx
"use client";
import { DataTable } from "@/components/data/data-table";

const columns = [
  { id: "name", header: "Họ tên", value: (row: Customer) => row.name, sortable: true },
  { id: "status", header: "Trạng thái", value: (row: Customer) => row.status },
];
// Customer là kiểu dữ liệu của feature sử dụng bảng.
<DataTable data={customers} columns={columns} getRowId={(row) => row.id}
  caption="Khách hàng" paramPrefix="customers."
  filters={[{ id: "status", label: "Trạng thái",
    options: [{ value: "Active", label: "Hoạt động" }],
    matches: (row, value) => row.status === value }]} />
```

`cell(row)` tùy biến nội dung ô; `value(row)` phục vụ tìm kiếm/sắp xếp. Đặt `searchable: false` để loại cột khỏi tìm kiếm. Sắp xếp số theo giá trị, chuỗi theo tiếng Việt, null ở cuối. Tìm kiếm không phân biệt hoa/thường và dấu tiếng Việt.

URL: `q`, `sort`, `dir=asc|desc`, `page`, `size=10|20|50`, `filter.<id>`. `paramPrefix` mặc định rỗng, dùng prefix riêng nếu có nhiều bảng. Tham số của phần khác và hash được giữ nguyên. Gõ tìm kiếm dùng replaceState để tránh tạo lịch sử cho từng ký tự; đổi lọc, sắp xếp, phân trang dùng pushState, hỗ trợ Back/Forward. Các thay đổi điều kiện đặt trang về 1; trang vượt giới hạn được sửa khi tải dữ liệu xong. Giá trị URL không hợp lệ dùng mặc định an toàn. Bảng tự bọc Suspense cho useSearchParams.

# ChartCard

Client component bọc Recharts cho các biểu đồ M1 và M10. `type`: `bar`, `horizontal-bar`, `line`, `pie`. Màu series lấy theo thứ tự `--chart-1`…`--chart-5` (spec 4.1), lặp lại sau năm series; pie tô từng lát theo thứ tự dòng và chỉ dùng series đầu tiên. Không truyền mã màu trực tiếp.

```tsx
"use client";
import { ChartCard } from "@/components/data/chart-card";

<ChartCard title="Phản hồi theo tuần" type="line" data={weeks}
  categoryKey="week" categoryLabel="Tuần"
  series={[{ key: "total", label: "Phản hồi" }, { key: "low", label: "≤ 2 sao" }]}
  loading={isPending} error={error?.message} onRetry={refetch} />
```

SVG được ẩn khỏi trình đọc màn hình; thay vào đó là bảng `sr-only` có cùng tiêu đề, cột đầu là `categoryLabel`. Số định dạng `vi-VN`, đổi bằng `formatValue` (ví dụ phần trăm). Trạng thái loading, empty (`emptyTitle`, `emptyDescription`), error + "Thử lại" giống `DataTable`. `action` là vùng nút ở góc phải tiêu đề.
