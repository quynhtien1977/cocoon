#!/bin/sh
set -eu
# COC-54 / NFR-07: phục hồi một bản sao lưu vào **database mới** rồi đối chiếu với kiểm kê lưu
# lúc sao lưu, nên vẫn dùng được khi database chính đã hỏng hoặc không còn.
# Chạy bên trong container `db`; gọi qua scripts/restore-db.sh hoặc scripts/restore-db.ps1.
# Tham số: $1 = tên file dump trong /workspace/backups, hoặc `latest` là bản mới nhất của
#               $POSTGRES_DB (mặc định latest).
#          $2 = database đích (mặc định <POSTGRES_DB>_restore_<timestamp UTC>).
# Script này không bao giờ ghi vào $POSTGRES_DB và từ chối một database đích đã tồn tại.
# Mã thoát: 0 khớp, 1 thiếu file, 2 bị từ chối, 3 lệch, 4 đã phục hồi nhưng không có gì để đối chiếu.

DIR=/workspace/backups
FILE=${1:-latest}
TARGET=${2:-}
QUERY=/workspace/db/verify-restore.sql

# psql chỉ nội suy biến khi đọc từ stdin, không nội suy trong --command.
database_exists() {
  FOUND=$(psql --username "$POSTGRES_USER" --dbname postgres --no-align --tuples-only \
    --set ON_ERROR_STOP=1 --set d="$1" <<'SQL'
SELECT 1 FROM pg_database WHERE datname = :'d';
SQL
)
  [ -n "$FOUND" ]
}

inventory() {
  psql --username "$POSTGRES_USER" --dbname "$1" --no-align --tuples-only \
    --field-separator '|' --set ON_ERROR_STOP=1 --file "$QUERY"
}

if [ ! -d "$DIR" ]; then
  echo "Thiếu mount $DIR. Chạy 'docker compose up -d db' sau khi thêm mount ./backups." >&2
  exit 1
fi

if [ "$FILE" = latest ]; then
  # Chỉ xét bản của database chính; bản của database khác không được thay thế nó.
  FILE=$(ls "$DIR" | grep -E "^$POSTGRES_DB-[0-9]{8}-[0-9]{6}\.dump$" | sort | tail -n 1 || true)
  if [ -z "$FILE" ]; then
    echo "Chưa có bản sao lưu nào của $POSTGRES_DB trong $DIR; chạy backup trước." >&2
    exit 1
  fi
fi
case "$FILE" in */*|.*) echo "Chỉ nhận tên file trong $DIR: $FILE" >&2; exit 2 ;; esac
if [ ! -f "$DIR/$FILE" ]; then
  echo "Không thấy $DIR/$FILE." >&2
  exit 1
fi

if [ -z "$TARGET" ]; then
  TARGET="${POSTGRES_DB}_restore_$(date -u +%Y%m%d%H%M%S)"
fi

# Chặn phục hồi đè database chính, kể cả khi người dùng truyền tay.
if [ "$TARGET" = "$POSTGRES_DB" ]; then
  echo "Từ chối: $TARGET là database chính. Phục hồi phải vào database mới." >&2
  exit 2
fi
if ! printf '%s' "$TARGET" | grep -qE '^[a-z][a-z0-9_]{2,62}$'; then
  echo "Tên database đích không hợp lệ: $TARGET" >&2
  exit 2
fi
if database_exists "$TARGET"; then
  echo "Từ chối: database $TARGET đã tồn tại. Chọn tên khác hoặc xóa nó bằng tay." >&2
  exit 2
fi

echo "archive  $DIR/$FILE"
echo "target   $TARGET (mới)"

createdb --username "$POSTGRES_USER" "$TARGET"
pg_restore --username "$POSTGRES_USER" --dbname "$TARGET" \
  --no-owner --no-acl --exit-on-error "$DIR/$FILE"

# Đối chiếu với kiểm kê lưu cùng bản sao lưu, vì database nguồn có thể đã đổi từ lúc đó.
# Bản tạo trước khi có file kiểm kê thì so với database nguồn nếu nó còn.
# Chỉ lấy tên đối tượng và số dòng; không đọc cột dữ liệu khách hàng, mật khẩu hay token.
BASELINE="${FILE%.dump}.inventory"
SOURCE=$(printf '%s' "$FILE" | sed -E 's/-[0-9]{8}-[0-9]{6}\.dump$//')

echo
echo "--- kiểm kê database đã phục hồi: $TARGET ---"
psql --username "$POSTGRES_USER" --dbname "$TARGET" --set ON_ERROR_STOP=1 --file "$QUERY"
echo

if [ -f "$DIR/$BASELINE" ]; then
  BASIS="kiểm kê lúc sao lưu ($BASELINE)"
  cp "$DIR/$BASELINE" /tmp/restore-source.txt
elif database_exists "$SOURCE"; then
  BASIS="database $SOURCE hiện tại, vì bản này chưa có file kiểm kê"
  inventory "$SOURCE" > /tmp/restore-source.txt
else
  echo "CHƯA ĐỐI CHIẾU: bản này không có file kiểm kê và database $SOURCE không còn." >&2
  echo "Dữ liệu đã nạp vào $TARGET; tự kiểm tra trước khi dùng." >&2
  exit 4
fi
inventory "$TARGET" > /tmp/restore-target.txt

if diff -u /tmp/restore-source.txt /tmp/restore-target.txt > /tmp/restore-diff.txt; then
  echo "PASS: $TARGET khớp $BASIS trên toàn bộ bảng, view, số dòng, ràng buộc và migration."
  echo "      Database chính không bị ghi; xóa bản phục hồi bằng:"
  echo "      docker compose exec -T db sh -lc 'dropdb --username \"\$POSTGRES_USER\" $TARGET'"
else
  echo "FAIL: $TARGET lệch so với $BASIS." >&2
  cat /tmp/restore-diff.txt >&2
  echo "Giữ lại $TARGET để điều tra; database chính không bị ghi." >&2
  exit 3
fi
