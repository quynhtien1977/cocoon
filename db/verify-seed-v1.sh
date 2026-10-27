#!/bin/sh
set -eu
exec psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 --file /workspace/db/verify-seed-v1.sql
