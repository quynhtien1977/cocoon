#!/bin/sh
set -eu
# COC-54 / NFR-07: điểm vào trên host cho sao lưu database.
# Dùng: sh scripts/backup-db.sh [database-nguồn]
# pg_dump chạy trong container `db`, file .dump nằm ở ./backups (đã gitignore), giữ 7 bản gần nhất.
cd "$(dirname "$0")/.."
mkdir -p backups
# Git Bash trên Windows đổi /workspace/... thành đường dẫn Windows khi truyền cho docker.exe;
# hai biến này tắt việc đó và không có tác dụng gì trên shell Linux/macOS.
MSYS_NO_PATHCONV=1
MSYS2_ARG_CONV_EXCL='*'
export MSYS_NO_PATHCONV MSYS2_ARG_CONV_EXCL
exec docker compose exec -T db sh /workspace/db/backup.sh "$@"
