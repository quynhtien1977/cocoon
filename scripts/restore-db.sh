#!/bin/sh
set -eu
# COC-54 / NFR-07: điểm vào trên host cho phục hồi database và ảnh phản hồi (MinIO).
# Dùng: sh scripts/restore-db.sh [tên-file-dump|latest] [database-đích]
# Phục hồi vào một database MỚI và một bucket MỚI rồi đối chiếu với lúc sao lưu; không ghi vào
# database chính hay bucket chính.
cd "$(dirname "$0")/.."
# Git Bash trên Windows đổi /workspace/... thành đường dẫn Windows khi truyền cho docker.exe;
# hai biến này tắt việc đó và không có tác dụng gì trên shell Linux/macOS.
MSYS_NO_PATHCONV=1
MSYS2_ARG_CONV_EXCL='*'
export MSYS_NO_PATHCONV MSYS2_ARG_CONV_EXCL

FILE=${1:-latest}
MAIN=$(docker compose exec -T db printenv POSTGRES_DB | tr -d '\r')
if [ "$FILE" = latest ]; then
  # Cùng quy tắc với db/restore.sh: bản mới nhất của database chính.
  FILE=$(ls backups 2>/dev/null | grep -E "^$MAIN-[0-9]{8}-[0-9]{6}\.dump$" | sort | tail -n 1 || true)
  if [ -z "$FILE" ]; then
    echo "Chưa có bản sao lưu nào của $MAIN trong ./backups; chạy backup trước." >&2
    exit 1
  fi
fi
NOW=$(date -u +%Y%m%d%H%M%S)
TARGET=${2:-${MAIN}_restore_$NOW}
docker compose exec -T db sh /workspace/db/restore.sh "$FILE" "$TARGET"

BASE=${FILE%.dump}
echo
if [ ! -d "backups/$BASE.photos" ]; then
  echo "Bản $FILE không kèm ảnh MinIO (tạo trước khi có sao lưu ảnh hoặc của database khác); chỉ phục hồi database."
  exit 0
fi
BUCKET=${MINIO_BUCKET:-$( (sed -n 's/^MINIO_BUCKET=//p' .env 2>/dev/null || true) | tail -n 1 | tr -d '\r')}
BUCKET=${BUCKET:-cocoon-feedback}
docker compose exec -T db sh /workspace/db/photos-check.sh verify "$BASE" "$TARGET"
docker compose exec -T minio sh /workspace/db/photos-mirror.sh restore "$BASE" "$BUCKET" "$BUCKET-restore-$NOW"
echo "      Dùng bản phục hồi: đặt MINIO_BUCKET=$BUCKET-restore-$NOW và trỏ api tới database $TARGET."
