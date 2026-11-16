#!/bin/sh
set -eu
# In ra mọi khóa object MinIO mà database $1 tham chiếu, mỗi dòng một khóa, thứ tự cố định:
# ảnh phản hồi (FeedbackPhoto) và ảnh câu hỏi khảo sát (SurveyImage, kể cả khảo sát đã xóa mềm).
# Chạy bên trong container `db`; db/backup.sh và db/photos-check.sh dùng chung để hai bên so được.
# Database cũ chưa có bảng/cột tương ứng thì phần đó rỗng.
DB=$1
q() { psql --username "$POSTGRES_USER" --dbname "$DB" --no-align --tuples-only --set ON_ERROR_STOP=1 --command "$1"; }

HAS_FEEDBACK=$(q "SELECT to_regclass('public.\"FeedbackPhoto\"') IS NOT NULL")
HAS_SURVEY=$(q "SELECT to_regclass('public.\"SurveyImage\"') IS NOT NULL")
{
  if [ "$HAS_FEEDBACK" = t ]; then q 'SELECT "ObjectKey" FROM "FeedbackPhoto"'; fi
  if [ "$HAS_SURVEY" = t ]; then q 'SELECT "ObjectKey" FROM "SurveyImage"'; fi
} | LC_ALL=C sort
