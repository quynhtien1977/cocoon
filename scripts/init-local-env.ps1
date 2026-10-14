$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $projectRoot '.env'
if (Test-Path -LiteralPath $envPath) {
    Write-Output '.env already exists; values preserved.'
    exit 0
}

$dbBytes = New-Object byte[] 32
$jwtBytes = New-Object byte[] 48
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try {
    $rng.GetBytes($dbBytes)
    $rng.GetBytes($jwtBytes)
} finally {
    $rng.Dispose()
}
$dbPassword = ([BitConverter]::ToString($dbBytes)).Replace('-', '').ToLowerInvariant()
$jwtKey = [Convert]::ToBase64String($jwtBytes)
$template = [System.IO.File]::ReadAllText((Join-Path $projectRoot '.env.example'))
$localEnv = $template.Replace('POSTGRES_PASSWORD=change_me', ('POSTGRES_PASSWORD=' + $dbPassword)).Replace('Jwt__Key=replace_with_random_key_at_least_32_characters', ('Jwt__Key=' + $jwtKey))
[System.IO.File]::WriteAllText($envPath, $localEnv, (New-Object System.Text.UTF8Encoding($false)))
Write-Output 'Created local .env with independent random database password and JWT key; values hidden.'
