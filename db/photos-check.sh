#!/bin/sh
set -eu
# Kiểm tra bản sao lưu ảnh MinIO (ảnh phản hồi và ảnh bìa khảo sát). Chạy bên trong container `db`;
# gọi qua scripts/backup-db.* và scripts/restore-db.*. Chỉ đọc đường dẫn object và checksum, không đọc
# nội dung phản hồi hay khảo sát.
#   seal   <bản>             bản ảnh vừa chép (.<bản>.photos.part) phải có mọi ảnh trong <bản>.photo-keys;
#                            ghi checksum <bản>.photos.sha256 rồi đổi tên thành <bản>.photos
#   verify <bản> <database>  checksum còn nguyên, không thừa/thiếu file, và database đã phục hồi tham chiếu
#                            đúng các ảnh của bản sao lưu
# Mã thoát: 0 khớp, 1 thiếu file, 2 bị từ chối, 3 lệch.

DIR=/workspace/backups
MODE=${1:-}
BASE=${2:-}
case "$BASE" in ''|.*|*[!A-Za-z0-9_-]*) echo "Tên bản sao lưu không hợp lệ: $BASE" >&2; exit 2 ;; esac
KEYS="$DIR/$BASE.photo-keys"
SUMS="$DIR/$BASE.photos.sha256"
if [ ! -f "$KEYS" ]; then echo "Không thấy $KEYS (bản sao lưu tạo trước khi có sao lưu ảnh)." >&2; exit 1; fi

missing_keys() {
  # $1 = thư mục ảnh. In ra khóa có trong danh sách nhưng không có file.
  while IFS= read -r key; do
    [ -n "$key" ] || continue
    [ -f "$1/$key" ] || printf '%s\n' "$key"
  done < "$KEYS"
}

checksums() {
  # Đường dẫn tương đối, thứ tự cố định, để so được giữa lúc sao lưu và lúc phục hồi.
  (cd "$1" && find . -type f -print | LC_ALL=C sort | while IFS= read -r f; do sha256sum "$f"; done)
}

case "$MODE" in
  seal)
    PART="$DIR/.$BASE.photos.part"
    if [ ! -d "$PART" ]; then echo "Không thấy $PART; chạy photos-mirror.sh backup trước." >&2; exit 1; fi
    MISSING=$(missing_keys "$PART")
    if [ -n "$MISSING" ]; then
      rm -rf "$PART"
      echo "Hủy bản ảnh: thiếu $(printf '%s\n' "$MISSING" | wc -l) ảnh mà bản dump tham chiếu (có ghi ảnh trong lúc sao lưu?)." >&2
      echo "Dừng api rồi chạy lại sao lưu. Bản dump $BASE.dump vẫn dùng được cho database." >&2
      exit 3
    fi
    checksums "$PART" > "$SUMS.part"
    mv "$SUMS.part" "$SUMS"
    mv "$PART" "$DIR/$BASE.photos"
    echo "created  $BASE.photos  ($(wc -l < "$SUMS") file, đủ $(grep -c . "$KEYS" || true) ảnh bản dump tham chiếu)"
    ;;
  verify)
    TARGET=${3:-}
    PHOTOS="$DIR/$BASE.photos"
    if [ ! -d "$PHOTOS" ] || [ ! -f "$SUMS" ]; then echo "Không thấy $PHOTOS hoặc $SUMS." >&2; exit 1; fi
    if ! printf '%s' "$TARGET" | grep -qE '^[a-z][a-z0-9_]{2,62}$'; then
      echo "Tên database không hợp lệ: $TARGET" >&2
      exit 2
    fi
    # Thừa, thiếu hay hỏng file đều làm danh sách checksum khác đi.
    if ! checksums "$PHOTOS" | cmp -s - "$SUMS"; then
      echo "FAIL: $BASE.photos không khớp checksum lúc sao lưu (file thiếu, thừa hoặc hỏng)." >&2
      exit 3
    fi
    sh /workspace/db/photo-keys.sh "$TARGET" > /tmp/photos-restored.txt
    if ! cmp -s "$KEYS" /tmp/photos-restored.txt; then
      echo "FAIL: ảnh mà $TARGET tham chiếu khác danh sách lúc sao lưu ($BASE.photo-keys)." >&2
      exit 3
    fi
    MISSING=$(missing_keys "$PHOTOS")
    if [ -n "$MISSING" ]; then
      echo "FAIL: $BASE.photos thiếu ảnh mà $TARGET tham chiếu." >&2
      exit 3
    fi
    echo "PASS: $BASE.photos nguyên vẹn ($(wc -l < "$SUMS") file) và có đủ $(grep -c . "$KEYS" || true) ảnh $TARGET tham chiếu."
    ;;
  *)
    echo "Dùng: photos-check.sh seal <bản> | verify <bản> <database>" >&2
    exit 2
    ;;
esac
