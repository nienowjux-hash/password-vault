$ErrorActionPreference = 'Stop'

$repo = 'nienowjux-hash/password-vault'
$release = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/latest" -Headers @{ 'User-Agent' = 'password-vault-installer' }

$asset = $release.assets | Where-Object { $_.name -like '*.exe' } | Select-Object -First 1
if (-not $asset) {
    throw "Nenhum instalador .exe encontrado no ultimo release de $repo."
}

$dest = Join-Path $env:TEMP $asset.name
Write-Host "Baixando $($asset.name)..."
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $dest -Headers @{ 'User-Agent' = 'password-vault-installer' }

Write-Host "Iniciando o instalador..."
Start-Process -FilePath $dest -Wait
