# Brand components

Các component trình bày nhận dữ liệu qua props. Chúng không tự tải dữ liệu hay gọi API thay đổi trạng thái. Màn hình/feature chịu trách nhiệm gọi API hiện có rồi truyền kết quả vào component.

`Logo` và `PageHeader` đã đáp ứng đặc tả nên được giữ nguyên. Các file nghiệp vụ ngoài phạm vi yêu cầu vẫn trống.

| Component | Props chính | Hành vi |
| --- | --- | --- |
| `Logo` | `href`, `tagline="CRM"`, `tone="cream" \| "ink"` | Wordmark trên nền kem/mực. |
| `PageHeader` | `eyebrow`, `title`, `description`, `actions` | Một `h1` và vùng action. |
| `StatTile` | `label`, `value`, `change?`, `className?` | Nhãn Barlow, định dạng số vi-VN, số chênh lệch có dấu. `change` nhận `value`, `suffix`, `label`, `tone`. Tone phản ánh ý nghĩa tốt/xấu, độc lập tăng/giảm. |
| `StatusBadge` | `kind`, `status`, `className?` | Chữ Việt + màu theo mục 4.6. TypeScript giới hạn status theo domain; giá trị lạ ở runtime hiện “Không xác định”. |
| `EmptyState` | `title`, `description`, `action?`, `icon?` | Tiêu đề `h2`, mô tả, slot CTA. |
| `ConfirmDialog` | `title`, `description`, `trigger?`, `open?`, `onOpenChange?`, `onConfirm`, `portal?` | Focus ban đầu vào Hủy; Escape/hủy không thực thi callback. Nút xác nhận destructive. Chờ callback async, chặn gửi lặp/đóng khi đang xử lý; giữ mở và hiển thị lỗi nếu callback thất bại. |
| `RatingInput` | `label`, `name?`, `value?`, `defaultValue?`, `onValueChange?`, `disabled?`, `required?`, `error?` | Chọn số nguyên 1–5 bằng chuột/phím mũi tên; radio group có tên truy cập, tích hợp FormData. `null` là chưa chọn. |
| `RatingStars` | `value`, `className?` | Chỉ đọc, hiển thị điểm thập phân và phần sao; null/0 là chưa có đánh giá. |
| `ProductCard` | `name`, `href?`, `imageUrl?`, `imageAlt?`, `minPrice`, `avgRating?`, `reason?`, `action?` | Ảnh vuông có fallback, giá VND thấp nhất, sao trung bình. CTA không nằm trong link. `minPrice=null` hiện chưa có giá. |
| `ReasonChip` | `children: string`, `className?` | Nhãn Barlow, nền be. ProductCard chỉ hiển thị tối đa hai phần tử trong slot reason. |

`StatusBadge.kind`: `feedback`, `survey`, `recipient`, `order`, `product`, `recommendationPlan`, `account`, `role`. Enum dùng đúng PascalCase của đặc tả, ví dụ `Closed`, `Upcoming`, `Locked`. Feature chuyển `IsActive`/`LockoutEnd` sang trạng thái tài khoản trước khi truyền vào badge.

```tsx
<StatTile label="Khách hàng" value={1280}
  change={{ value: 12.5, suffix: "%", label: "so với tháng trước", tone: "positive" }} />
<StatusBadge kind="feedback" status="Assigned" />
<EmptyState title="Chưa có phản hồi" description="Chia sẻ trải nghiệm của bạn."
  action={<Link href="/account/orders">Xem đơn hàng</Link>} />
<RatingInput label="Điểm đánh giá" name="rating" value={rating} onValueChange={setRating} required />
<ProductCard name={product.name} href={`/account/products/${product.id}`}
  imageUrl={product.imageUrl} minPrice={product.minPrice} avgRating={product.avgRating}
  reason={reasons.map((reason) => <ReasonChip key={reason.code}>{reason.label}</ReasonChip>)}
  action={<Button onClick={openFeedback}>Đánh giá</Button>} />
<ConfirmDialog title="Khóa tài khoản?" description="Tài khoản sẽ không thể truy cập hệ thống."
  trigger={<Button variant="outline">Khóa tài khoản</Button>}
  confirmLabel="Khóa tài khoản" portal="admin" onConfirm={handleLockAccount} />
```

Các ví dụ có callback phải nằm trong Client Component (`"use client"`). `handleLockAccount` là callback do feature cung cấp, không có API khóa/xóa nào được gọi tự động bởi thư viện component.

Truyền `portal` cho ConfirmDialog để giữ token màu và bo góc khi popup được đưa vào `document.body`. Trigger là một button (HTML hoặc `Button`), không dùng link. Với chế độ controlled, truyền cả `open` và `onOpenChange`. Lỗi từ callback phải được throw/reject để dialog giữ mở và cho phép thử lại.

Slot `reason` nhận một hoặc nhiều `ReasonChip` (array/fragment). Không gói nhiều chip bên trong một div/component tùy biến, vì slot chỉ đếm các phần tử trực tiếp và fragment. Ảnh sản phẩm tải trực tiếp, lazy-load, có kích thước cố định để tránh dịch chuyển bố cục; chưa giả định CDN hay proxy ảnh.

Kiểm tra: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` từ `apps/web`. Tests dùng DOM giả lập và tương tác chuột/bàn phím thật của Testing Library; không thay thế các primitive bằng mock.
