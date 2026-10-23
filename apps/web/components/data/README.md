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
