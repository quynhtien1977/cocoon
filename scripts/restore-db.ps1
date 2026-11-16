#Requires -Version 5.1
# COC-54 / NFR-07: điểm vào trên host cho phục hồi database và ảnh phản hồi (MinIO).
# Dùng: powershell -File scripts/restore-db.ps1 [tên-file-dump|latest] [database-đích]
# Phục hồi vào một database MỚI và một bucket MỚI rồi đối chiếu với lúc sao lưu; không ghi vào
# database chính hay bucket chính. Cùng các bước với restore-db.sh.
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

function Invoke-Step { docker compose @args; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
function Get-Bucket {
  if ($env:MINIO_BUCKET) { return $env:MINIO_BUCKET }
  $line = if (Test-Path '.env') { Get-Content '.env' | Where-Object { $_ -match '^MINIO_BUCKET=' } | Select-Object -Last 1 }
  if ($line) { $value = ($line -replace '^MINIO_BUCKET=', '').Trim(); if ($value) { return $value } }
  return 'cocoon-feedback'
}

$main = (docker compose exec -T db printenv POSTGRES_DB).Trim()
$file = if ($args.Count -gt 0) { $args[0] } else { 'latest' }
if ($file -eq 'latest') {
  # Cùng quy tắc với db/restore.sh: bản mới nhất của database chính.
  $file = Get-ChildItem 'backups' -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match "^$([regex]::Escape($main))-\d{8}-\d{6}\.dump$" } |
    Sort-Object Name | Select-Object -Last 1 -ExpandProperty Name
  if (-not $file) { Write-Error "Chưa có bản sao lưu nào của $main trong ./backups; chạy backup trước."; exit 1 }
}
$now = (Get-Date).ToUniversalTime().ToString('yyyyMMddHHmmss')
$target = if ($args.Count -gt 1) { $args[1] } else { "${main}_restore_$now" }
Invoke-Step exec -T db sh /workspace/db/restore.sh $file $target

$base = $file -replace '\.dump$', ''
Write-Output ''
if (-not (Test-Path "backups/$base.photos" -PathType Container)) {
  Write-Output "Bản $file không kèm ảnh MinIO (tạo trước khi có sao lưu ảnh hoặc của database khác); chỉ phục hồi database."
  exit 0
}
$bucket = Get-Bucket
Invoke-Step exec -T db sh /workspace/db/photos-check.sh verify $base $target
Invoke-Step exec -T minio sh /workspace/db/photos-mirror.sh restore $base $bucket "$bucket-restore-$now"
Write-Output "      Dùng bản phục hồi: đặt MINIO_BUCKET=$bucket-restore-$now và trỏ api tới database $target."
exit 0
