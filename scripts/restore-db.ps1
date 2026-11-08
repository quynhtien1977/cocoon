#Requires -Version 5.1
# COC-54 / NFR-07: điểm vào trên host cho phục hồi database.
# Dùng: powershell -File scripts/restore-db.ps1 [tên-file-dump|latest] [database-đích]
# Phục hồi vào một database MỚI rồi đối chiếu với nguồn; không ghi vào database chính.
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
docker compose exec -T db sh /workspace/db/restore.sh @args
exit $LASTEXITCODE
