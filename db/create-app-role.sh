#!/bin/sh
set -eu
# POSTGRES_* only apply when the volume is first initialised. This adds the role/database from the
# current .env to an existing cluster without touching data. $1: superuser the volume was created with.
psql --username "${1:-postgres}" --dbname postgres --set ON_ERROR_STOP=1 \
  --set u="$POSTGRES_USER" --set pw="$POSTGRES_PASSWORD" --set d="$POSTGRES_DB" <<'SQL'
CREATE ROLE :"u" LOGIN PASSWORD :'pw' CREATEDB;
CREATE DATABASE :"d" OWNER :"u";
SQL
