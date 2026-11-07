#!/bin/sh
set -eu
# COC-54 / NFR-07: điểm vào trên host cho phục hồi database.
# Dùng: sh scripts/restore-db.sh [tên-file-dump|latest] [database-đích]
# Phục hồi vào một database MỚI rồi đối chiếu với nguồn; không ghi vào database chính.
cd "$(dirname "$0")/.."
# Git Bash trên Windows đổi /workspace/... thành đường dẫn Windows khi truyền cho docker.exe;
# hai biến này tắt việc đó và không có tác dụng gì trên shell Linux/macOS.
MSYS_NO_PATHCONV=1
MSYS2_ARG_CONV_EXCL='*'
export MSYS_NO_PATHCONV MSYS2_ARG_CONV_EXCL
exec docker compose exec -T db sh /workspace/db/restore.sh "$@"
