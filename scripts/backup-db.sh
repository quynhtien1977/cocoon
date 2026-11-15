#!/bin/sh
set -eu
# COC-54 / NFR-07: điểm vào trên host cho sao lưu database và ảnh phản hồi (MinIO).
# Dùng: sh scripts/backup-db.sh [database-nguồn]
# pg_dump chạy trong container `db`, ảnh chép bằng mc trong container `minio`; mọi file nằm ở ./backups
# (đã gitignore) cùng tên <database>-<thời điểm UTC>, giữ 7 bản gần nhất.
cd "$(dirname "$0")/.."
mkdir -p backups
# Git Bash trên Windows đổi /workspace/... thành đường dẫn Windows khi truyền cho docker.exe;
# hai biến này tắt việc đó và không có tác dụng gì trên shell Linux/macOS.
MSYS_NO_PATHCONV=1
MSYS2_ARG_CONV_EXCL='*'
export MSYS_NO_PATHCONV MSYS2_ARG_CONV_EXCL

STAMP=$(date -u +%Y%m%d-%H%M%S)
docker compose exec -T -e BACKUP_STAMP="$STAMP" db sh /workspace/db/backup.sh "$@"

MAIN=$(docker compose exec -T db printenv POSTGRES_DB | tr -d '\r')
SOURCE=${1:-$MAIN}
if [ "$SOURCE" != "$MAIN" ]; then
  echo "Bỏ qua ảnh: bucket MinIO chỉ thuộc database chính $MAIN."
  exit 0
fi
# Cùng tên bucket với api (docker-compose.yml: Storage__Bucket=${MINIO_BUCKET:-cocoon-feedback}).
BUCKET=${MINIO_BUCKET:-$( (sed -n 's/^MINIO_BUCKET=//p' .env 2>/dev/null || true) | tail -n 1 | tr -d '\r')}
BUCKET=${BUCKET:-cocoon-feedback}
docker compose exec -T minio sh /workspace/db/photos-mirror.sh backup "$SOURCE-$STAMP" "$BUCKET"
docker compose exec -T db sh /workspace/db/photos-check.sh seal "$SOURCE-$STAMP"
