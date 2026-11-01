# COC-42 — Contract SQL cho phân tích và gợi ý

Nguồn nghiệp vụ: Cocoon_plan_v2.pdf §5.5/§7.2, Jira COC-42. Migration `20261101061301_AddAnalyticsViews` tạo ba view và một materialized view trong schema `public`. Chỉ bổ sung đối tượng SQL; không sửa bảng/entity, seed, quyền API hoặc Docker Compose. Nhánh độc lập từ develop, không cần COC-38.

## Dữ liệu trả về

Tên view dùng lowercase; tên cột giữ PascalCase có dấu ngoặc kép theo schema hiện tại. ID là PostgreSQL integer/C# int, count là bigint/long, tỷ lệ và điểm là numeric/decimal.

| View | Cột | Quy tắc |
|---|---|---|
| `mv_product_copurchase` | ProductA, ProductB, BothCount, ACount, Confidence | Mỗi khách từng mua A/B trong các đơn Completed được đếm một lần. BothCount ≥3; A≠B; Confidence=BothCount/ACount theo chiều A→B. |
| `v_customer_category_affinity` | CustomerId, CategoryId, Share | Tỷ trọng **số lượng** mua Completed theo danh mục trong 12 tháng UTC đến thời điểm đọc. Tổng Share theo khách xấp xỉ1. |
| `v_product_rating` | ProductId, AvgRating, FeedbackCount | Điểm trung bình và số phản hồi đã lưu; không lọc theo trạng thái xử lý feedback. |
| `v_customer_low_rated_category` | CustomerId, CategoryId, AvgRating, FeedbackCount | Trung bình trên từng phản hồi của khách trong danh mục ≤2, bao gồm đúng2. Không lấy trung bình các trung bình sản phẩm. |

Co-purchase tính trên tập sản phẩm từng được cùng khách mua, có thể ở các đơn khác nhau; không giới hạn 12 tháng. Đơn/biến thể/số lượng lặp không nhân số khách. ACount tính cả khách chỉ mua A; A→B và B→A có thể khác confidence. Loại đơn Cancelled/Returned và đơn tương lai. Bản ghi không có dữ liệu không xuất hiện trong view; không tự tạo AvgRating=0 hoặc Share=0.

Affinity dùng khoảng đóng `[now UTC - 12 tháng lịch, now UTC]`, không phải365ngày. Dữ liệu quantity luôn dương theo CHECK hiện có. Hai view có CustomerId chỉ trả Customer đang active, chưa xóa và ConsentPersonalData=true; rút consent/khóa/xóa/đổi role có hiệu lực ngay khi đọc, không cần refresh. Số liệu tổng hợp sản phẩm vẫn giữ lịch sử mua/feedback của khách đã khóa/xóa; không trả tên/email/điện thoại. Xóa mềm Product/Variant cũng không làm mất lịch sử. Schema Feedback hiện không có IsDeleted; v_product_rating dùng toàn bộ dòng còn lưu, không tự thêm cột hoặc xóa dữ liệu.

Đây là nguồn tín hiệu, chưa phải kết quả gợi ý. COC-43 vẫn phải kiểm tra account/consent tại request, chọn sản phẩm Active/chưa xóa và thực hiện đầy đủ luật loại ứng viên trước khi lưu/hiển thị; không phục vụ lại Recommendation cache khi khách rút consent. Đánh giá thấp từng sản phẩm riêng lẻ vẫn phải kiểm tra theo spec ngoài view danh mục.

## Migration và refresh

Chạy trong bộ Compose hiện có, chỉ trên DB local đã xác minh:

```powershell
rtk docker compose exec api dotnet ef database update -p src/Cocoon.Infrastructure -s src/Cocoon.Api
rtk docker compose exec -T db sh /workspace/db/verify-analytics.sh
```

Migration tạo materialized view WITH DATA để đọc được ngay, kèm unique index `(ProductA, ProductB)`. Nếu seed/chỉnh đơn sau migration, dữ liệu mua cùng sẽ cũ cho đến lần refresh kế tiếp. COC-43 phải chạy câu lệnh tĩnh sau **trước khi tính điểm** trong luồng recommendations/rebuild:

```sql
REFRESH MATERIALIZED VIEW public.mv_product_copurchase;
```

Unique index cũng cho phép REFRESH MATERIALIZED VIEW CONCURRENTLY nếu sau này cần giữ lượt đọc trong khi refresh; các lượt refresh cùng view vẫn được PostgreSQL thực hiện tuần tự. Task này chưa thêm endpoint rebuild hoặc job định kỳ. Ba view thường luôn phản ánh dữ liệu tại snapshot transaction đọc. Consumer phải parameterize CustomerId/ProductId, không nối SQL từ input, và tự ORDER BY khi cần thứ tự.

`db/schema.sql` được xuất từ EF migrations để dựng DB mới trống. Migration Down chỉ bỏ bốn view/index đi kèm, không dùng CASCADE hoặc xóa dòng nguồn; chỉ kiểm thử rollback trên DB tạm. Không chạy schema.sql đè DB đã migrate. Materialized view/SQL interval là phụ thuộc PostgreSQL được yêu cầu trong COC-42; migration fail rõ với provider khác, không cam kết đổi sang SQL Server chỉ bằng connection string. AppDbContext/model snapshot không thêm mapping view; consumer có thể đọc DTO bằng Database.SqlQuery và gọi refresh bằng SQL tĩnh.

## Kiểm chứng

`AnalyticsViewsTests` dùng database tạm trên db hiện có: DB trống; distinct buyers/threshold/chiều confidence; stale/refresh thường và concurrently; UTC/cận12tháng/quantity; weighted rating/cận2sao; consent/account eligibility; tổng seed đối chiếu dữ liệu nguồn; rollback/reapply/idempotence không mất đơn. Không thêm service/container test. `verify-analytics.sql` chạy transaction READ ONLY và đối chiếu cả bốn kết quả với bảng nguồn; cả bốn *_mismatches phải bằng0. Không tự seed hoặc refresh trong script chỉ đọc.

Tài liệu kỹ thuật đã đối chiếu:

- [EF Core: raw SQL trong migration rỗng](https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/managing#arbitrary-changes-via-raw-sql).
- [PostgreSQL18: CREATE MATERIALIZED VIEW và WITH DATA](https://www.postgresql.org/docs/18/sql-creatematerializedview.html).
- [PostgreSQL18: REFRESH, unique index và CONCURRENTLY](https://www.postgresql.org/docs/18/sql-refreshmaterializedview.html).
- [EF Core: SQL queries và parameterization](https://learn.microsoft.com/en-us/ef/core/querying/sql-queries).
