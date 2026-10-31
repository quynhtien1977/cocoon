#!/bin/sh
set -eu
test "$POSTGRES_DB" = cocoon
exec psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 --file /workspace/db/verify-seed-v2.sql
