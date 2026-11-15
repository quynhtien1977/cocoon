#!/bin/sh
set -eu
# Sao lưu / phục hồi ảnh phản hồi trong MinIO. Chạy bên trong container `minio` (Chainguard: có mc,
# không có grep/sed/find); gọi qua scripts/backup-db.* và scripts/restore-db.*.
#   backup  <bản> <bucket>              chép bucket vào /workspace/backups/.<bản>.photos.part
#   restore <bản> <bucket> <bucket-mới> nạp <bản>.photos vào bucket MỚI rồi so bằng mc diff
# Không bao giờ ghi vào <bucket> chính; db/photos-check.sh kiểm đủ ảnh và checksum.
# Mã thoát: 0 khớp, 1 thiếu bản ảnh, 2 bị từ chối, 3 lệch.

DIR=/workspace/backups
MODE=${1:-}
BASE=${2:-}
BUCKET=${3:-}

valid_bucket() {
  case "$1" in ''|-*|*-|*[!a-z0-9-]*) return 1 ;; esac
  [ "${#1}" -ge 3 ] && [ "${#1}" -le 63 ]
}
case "$BASE" in ''|.*|*[!A-Za-z0-9_-]*) echo "Tên bản sao lưu không hợp lệ: $BASE" >&2; exit 2 ;; esac
if ! valid_bucket "$BUCKET"; then echo "Tên bucket không hợp lệ: $BUCKET" >&2; exit 2; fi
if [ ! -d "$DIR" ] || [ ! -w "$DIR" ]; then
  echo "Thiếu mount ghi được $DIR trong container minio; chạy 'docker compose up -d minio'." >&2
  exit 1
fi

# Cấu hình mc tạm, xóa khi xong, để mật khẩu không nằm lại trong container.
MC_CONFIG_DIR=/tmp/mc-$$
export MC_CONFIG_DIR
trap 'rm -rf "$MC_CONFIG_DIR"' EXIT
mc alias set local http://127.0.0.1:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" > /dev/null
mc ls local > /dev/null

case "$MODE" in
  backup)
    PART="$DIR/.$BASE.photos.part"
    rm -rf "$PART"
    mkdir -p "$PART"
    # Bucket chỉ được tạo ở lần upload đầu; chưa có bucket nghĩa là chưa có ảnh nào.
    if mc ls "local/$BUCKET" > /dev/null 2>&1; then
      mc mirror --quiet "local/$BUCKET" "$PART" > /dev/null
    fi
    echo "mirrored bucket $BUCKET -> .$BASE.photos.part"
    ;;
  restore)
    TARGET=${4:-}
    SOURCE="$DIR/$BASE.photos"
    if ! valid_bucket "$TARGET"; then echo "Tên bucket đích không hợp lệ: $TARGET" >&2; exit 2; fi
    if [ "$TARGET" = "$BUCKET" ]; then
      echo "Từ chối: $TARGET là bucket chính. Phục hồi ảnh phải vào bucket mới." >&2
      exit 2
    fi
    if [ ! -d "$SOURCE" ]; then echo "Không thấy $SOURCE." >&2; exit 1; fi
    if mc ls "local/$TARGET" > /dev/null 2>&1; then
      echo "Từ chối: bucket $TARGET đã tồn tại." >&2
      exit 2
    fi
    mc mb "local/$TARGET" > /dev/null
    mc mirror --quiet "$SOURCE" "local/$TARGET" > /dev/null
    # mc diff liệt kê object khác tên hoặc kích thước; rỗng nghĩa là bucket mới khớp bản sao lưu.
    DIFF=$(mc diff "$SOURCE" "local/$TARGET" 2>&1 || true)
    COUNT=$(mc ls --recursive "local/$TARGET" | wc -l | tr -d ' ')
    if [ -n "$DIFF" ]; then
      echo "FAIL: bucket $TARGET lệch so với $BASE.photos." >&2
      printf '%s\n' "$DIFF" >&2
      exit 3
    fi
    echo "PASS: bucket $TARGET có $COUNT ảnh, khớp tên và kích thước với $BASE.photos; bucket $BUCKET không bị ghi."
    ;;
  *)
    echo "Dùng: photos-mirror.sh backup <bản> <bucket> | restore <bản> <bucket> <bucket-mới>" >&2
    exit 2
    ;;
esac
