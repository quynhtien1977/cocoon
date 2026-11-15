#Requires -Version 5.1
# COC-54 / NFR-07: điểm vào trên host cho sao lưu database và ảnh phản hồi (MinIO).
# Dùng: powershell -File scripts/backup-db.ps1 [database-nguồn]
# pg_dump chạy trong container `db`, ảnh chép bằng mc trong container `minio`; mọi file nằm ở ./backups
# (đã gitignore) cùng tên <database>-<thời điểm UTC>, giữ 7 bản gần nhất. Cùng các bước với backup-db.sh.
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
New-Item -ItemType Directory -Force -Path 'backups' | Out-Null

function Invoke-Step { docker compose @args; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
function Get-Bucket {
  if ($env:MINIO_BUCKET) { return $env:MINIO_BUCKET }
  $line = if (Test-Path '.env') { Get-Content '.env' | Where-Object { $_ -match '^MINIO_BUCKET=' } | Select-Object -Last 1 }
  if ($line) { $value = ($line -replace '^MINIO_BUCKET=', '').Trim(); if ($value) { return $value } }
  return 'cocoon-feedback'
}

$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmss')
Invoke-Step exec -T -e "BACKUP_STAMP=$stamp" db sh /workspace/db/backup.sh @args

$main = (docker compose exec -T db printenv POSTGRES_DB).Trim()
$source = if ($args.Count -gt 0) { $args[0] } else { $main }
if ($source -ne $main) { Write-Output "Bỏ qua ảnh: bucket MinIO chỉ thuộc database chính $main."; exit 0 }
Invoke-Step exec -T minio sh /workspace/db/photos-mirror.sh backup "$source-$stamp" (Get-Bucket)
Invoke-Step exec -T db sh /workspace/db/photos-check.sh seal "$source-$stamp"
exit 0
