#!/bin/sh
set -eu
# COC-54 / NFR-07: tạo một bản sao lưu pg_dump và giữ KEEP bản gần nhất.
# Chạy bên trong container `db`; gọi qua scripts/backup-db.sh hoặc scripts/backup-db.ps1.
# Tham số: $1 = database nguồn (mặc định $POSTGRES_DB).
# Chỉ đọc database nguồn; không DROP, không TRUNCATE, không ghi vào database nào.
# Mỗi bản có file kiểm kê cùng tên (.inventory) để db/restore.sh đối chiếu với đúng thời điểm sao
# lưu, kể cả khi database nguồn đã hỏng hoặc không còn.

KEEP=7
DIR=/workspace/backups
QUERY=/workspace/db/verify-restore.sql
SOURCE=${1:-$POSTGRES_DB}

if [ ! -d "$DIR" ]; then
  echo "Thiếu mount $DIR. Chạy 'docker compose up -d db' sau khi thêm mount ./backups." >&2
  exit 1
fi
if [ ! -w "$DIR" ]; then
  echo "Mount $DIR đang read-only; kiểm tra volumes của service db." >&2
  exit 1
fi

# Tên database đi vào tên file và pattern giữ bản, nên chặn ký tự lạ tại đây.
if ! printf '%s' "$SOURCE" | grep -qE '^[A-Za-z][A-Za-z0-9_]{0,62}$'; then
  echo "Tên database không hợp lệ: $SOURCE" >&2
  exit 2
fi
# psql chỉ nội suy biến khi đọc từ stdin, không nội suy trong --command.
FOUND=$(psql --username "$POSTGRES_USER" --dbname postgres --no-align --tuples-only \
  --set ON_ERROR_STOP=1 --set d="$SOURCE" <<'SQL'
SELECT 1 FROM pg_database WHERE datname = :'d';
SQL
)
if [ -z "$FOUND" ]; then
  echo "Không thấy database $SOURCE." >&2
  exit 2
fi

STAMP=$(date -u +%Y%m%d-%H%M%S)
NAME="$SOURCE-$STAMP.dump"
INVENTORY="$SOURCE-$STAMP.inventory"
PART="$DIR/.$NAME.part"
INVENTORY_PART="$DIR/.$INVENTORY.part"
trap 'rm -f "$PART" "$INVENTORY_PART" /tmp/backup-before.txt' EXIT

inventory() {
  psql --username "$POSTGRES_USER" --dbname "$SOURCE" --no-align --tuples-only \
    --field-separator '|' --set ON_ERROR_STOP=1 --file "$QUERY"
}

# Kiểm kê trước và sau pg_dump: hai bản giống nhau thì chúng cũng khớp snapshot của file dump.
inventory > /tmp/backup-before.txt

# --format=custom để pg_restore nạp được vào một database mới; --no-owner/--no-acl để bản sao
# lưu không phụ thuộc role của cluster nguồn. Ghi ra .part rồi mv, tránh để lại file dở.
pg_dump --username "$POSTGRES_USER" --dbname "$SOURCE" \
  --format=custom --compress=9 --no-owner --no-acl --file "$PART"

inventory > "$INVENTORY_PART"
if ! cmp -s /tmp/backup-before.txt "$INVENTORY_PART"; then
  echo "Hủy: $SOURCE có ghi dữ liệu trong lúc sao lưu. Dừng api rồi chạy lại." >&2
  exit 3
fi

# File kiểm kê vào trước, nên một file .dump đã có tên chính thức luôn đi kèm kiểm kê của nó.
mv "$INVENTORY_PART" "$DIR/$INVENTORY"
mv "$PART" "$DIR/$NAME"
echo "created  $NAME  ($(wc -c < "$DIR/$NAME") bytes)"
echo "created  $INVENTORY  ($(wc -l < "$DIR/$INVENTORY") dòng)"

# Giữ KEEP bản gần nhất: tên chứa timestamp UTC nên thứ tự chữ cái trùng thứ tự thời gian.
PATTERN="^$SOURCE-[0-9]{8}-[0-9]{6}\.dump$"
ls "$DIR" | grep -E "$PATTERN" | sort | head -n "-$KEEP" > /tmp/backup-prune.txt || true
while IFS= read -r old; do
  [ -n "$old" ] || continue
  rm -f -- "$DIR/$old" "$DIR/${old%.dump}.inventory"
  echo "pruned   $old"
done < /tmp/backup-prune.txt
rm -f /tmp/backup-prune.txt

TOTAL=$(ls "$DIR" | grep -cE "$PATTERN" || true)
echo "retained $TOTAL/$KEEP bản sao lưu của $SOURCE trong $DIR"
ls "$DIR" | grep -E "$PATTERN" | sort | sed 's/^/         /'
