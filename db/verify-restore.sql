-- COC-54 / NFR-07: kiểm kê chỉ đọc, dùng để đối chiếu database đã phục hồi với database nguồn.
-- Chỉ lấy tên đối tượng và số lượng; không đọc cột dữ liệu khách hàng, mật khẩu hay token.
-- db/backup.sh lưu kết quả của file này thành <bản sao lưu>.inventory; db/restore.sh chạy lại nó trên
-- database đã phục hồi rồi diff, nên mọi kết quả phải có thứ tự cố định.
-- Điều kiện: không ghi dữ liệu vào database nguồn trong lúc sao lưu; db/backup.sh kiểm kê trước và
-- sau pg_dump, thấy khác nhau thì hủy bản đó.

-- 1. Bảng, view, materialized view trong schema public kèm số dòng thực đếm.
SELECT kind, object_name, row_count
FROM (
  SELECT CASE c.relkind WHEN 'r' THEN 'table' WHEN 'v' THEN 'view' WHEN 'm' THEN 'matview' END AS kind,
         c.relname AS object_name,
         (xpath('/row/c/text()',
                query_to_xml(format('SELECT count(*) AS c FROM %I.%I', n.nspname, c.relname),
                             false, true, '')))[1]::text::bigint AS row_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'v', 'm')
) objects
ORDER BY kind, object_name;

-- 2. Tổng hợp schema: số đối tượng, index và ràng buộc theo loại (p=PK, f=FK, u=unique, c=check).
SELECT metric, total
FROM (
  SELECT 'objects' AS metric, count(*)::bigint AS total
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'v', 'm')
  UNION ALL
  SELECT 'indexes', count(*)::bigint FROM pg_indexes WHERE schemaname = 'public'
  UNION ALL
  SELECT 'constraint_' || con.contype::text, count(*)::bigint
  FROM pg_constraint con JOIN pg_namespace n ON n.oid = con.connamespace
  WHERE n.nspname = 'public'
  GROUP BY con.contype
) summary
ORDER BY metric;

-- 3. Sequence của các cột identity: tên và giá trị cuối, để chắc INSERT sau phục hồi không đụng khóa cũ.
SELECT sequencename, coalesce(last_value::text, 'unused') AS last_value
FROM pg_sequences
WHERE schemaname = 'public'
ORDER BY sequencename;

-- 4. Lịch sử migration EF Core: bản phục hồi phải ở đúng phiên bản schema của nguồn.
SELECT "MigrationId" FROM "__EFMigrationsHistory" ORDER BY "MigrationId";
