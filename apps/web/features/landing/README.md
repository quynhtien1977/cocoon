# Cocoon landing page

Trang `/` dựng theo bố cục và hình ảnh công khai tại https://cocoonvietnam.com/, tham khảo ngày 23/10/2026. Nội dung lời dẫn được viết lại để kết nối với dự án Cocoon CRM.

- Header/logo, 3 banner tự động chuyển mỗi 2 giây và vẫn hỗ trợ chuyển bằng mũi tên (không chấm hoặc số trang), khối dầu gội bồ kết, chứng nhận, sản phẩm, nguyên liệu, bài viết, kết nối và footer.
- `ProductSpotlight` thay khối “Vẻ đẹp từ những điều thuần túy”, theo video tham khảo: tiêu đề, ba lớp ảnh PNG trong suốt, mô tả và nút Mua ngay. Các lớp chuyển động theo cuộn bằng `requestAnimationFrame`, có làm mượt, dọn listener khi unmount và tắt chuyển động khi `prefers-reduced-motion`. Mobile xếp ảnh/nội dung dọc; liên kết mua mở đúng dầu gội bồ kết trên website Cocoon.
- Menu mobile dùng Sheet; tìm kiếm và danh mục lọc dữ liệu mẫu ở client. Banner quay lại slide đầu sau slide cuối; bộ đếm 2 giây bắt đầu lại khi đổi slide và được dọn khi rời trang.
- Logo lớn hơn; logo ở header/footer và tên Cocoon CRM ở footer cuộn về đầu trang, có hỗ trợ bàn phím và chế độ giảm chuyển động.
- `ProductCarousel` giữ kiểu thẻ và bốn cột desktop/hai cột mobile, thêm ảnh phụ chuyển mờ khi hover hoặc focus. Danh sách gồm năm sản phẩm bán chạy tham khảo Cocoon; hỗ trợ vuốt ngang, mũi tên từng sản phẩm và thanh kéo có thể dùng bàn phím. Lọc/tìm kiếm đặt lại vị trí đầu; ẩn điều hướng khi kết quả vừa khung.
- Đăng nhập/đăng ký dùng route dự án. Xem sản phẩm/bài viết mở website thương hiệu; không có giỏ hàng, đặt hàng hoặc gửi email giả.
- Hình ảnh được lưu local. Nguồn từng tệp ở `public/images/landing/sources.json`. Giá là dữ liệu tham khảo tại thời điểm dựng trang, không phải API tồn kho/giá trực tiếp.
- CSS Modules chỉ áp dụng landing. Rule Tailwind trong `next.config.ts` giới hạn ở `globals.css`; rule `*.css` cũ làm mất exports class của CSS Modules.
- `PublicShell` giữ layout cũ cho login/register và để landing tự sở hữu header/main/footer ở `/`.

Chạy `npm run dev`, mở `/`. Kiểm tra `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.

Kiểm tra trình duyệt tùy chọn trên Windows có Microsoft Edge: chạy `node scripts/check-landing.mjs` từ `apps/web` sau build. Script dùng cổng 3191/9291, tạo profile thử nghiệm riêng và tự đóng server/browser; ảnh chụp ở `.next/landing-previews`. Nếu đường dẫn checkout khác, cập nhật đường dẫn profile trong script.
