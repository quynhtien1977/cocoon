#Requires -Version 5.1
# COC-54 / NFR-07: điểm vào trên host cho sao lưu database.
# Dùng: powershell -File scripts/backup-db.ps1 [database-nguồn]
# pg_dump chạy trong container `db`, file .dump nằm ở ./backups (đã gitignore), giữ 7 bản gần nhất.
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
New-Item -ItemType Directory -Force -Path 'backups' | Out-Null
docker compose exec -T db sh /workspace/db/backup.sh @args
exit $LASTEXITCODE
