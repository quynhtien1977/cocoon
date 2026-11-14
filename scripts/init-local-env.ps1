$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $projectRoot '.env'
if (Test-Path -LiteralPath $envPath) {
    Write-Output '.env already exists; values preserved.'
    exit 0
}

$dbBytes = New-Object byte[] 32
$jwtBytes = New-Object byte[] 48
$minioBytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try {
    $rng.GetBytes($dbBytes)
    $rng.GetBytes($jwtBytes)
    $rng.GetBytes($minioBytes)
} finally {
    $rng.Dispose()
}
$dbPassword = ([BitConverter]::ToString($dbBytes)).Replace('-', '').ToLowerInvariant()
$jwtKey = [Convert]::ToBase64String($jwtBytes)
$minioPassword = ([BitConverter]::ToString($minioBytes)).Replace('-', '').ToLowerInvariant()
$template = [System.IO.File]::ReadAllText((Join-Path $projectRoot '.env.example'))
$localEnv = $template.Replace('POSTGRES_PASSWORD=change_me', ('POSTGRES_PASSWORD=' + $dbPassword)).Replace('Jwt__Key=replace_with_random_key_at_least_32_characters', ('Jwt__Key=' + $jwtKey)).Replace('MINIO_ROOT_PASSWORD=replace_with_random_minio_password', ('MINIO_ROOT_PASSWORD=' + $minioPassword))
[System.IO.File]::WriteAllText($envPath, $localEnv, (New-Object System.Text.UTF8Encoding($false)))
Write-Output 'Created local .env with independent random database password, JWT key and MinIO password; values hidden.'
