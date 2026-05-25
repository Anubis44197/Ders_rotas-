$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$vite = Join-Path $repoRoot 'node_modules\vite\bin\vite.js'
if (-not (Test-Path $vite)) {
  throw "Vite bulunamadi: $vite. Once 'npm install' calistirin."
}

# Foreground calisma: terminal acik kaldigi surece dev server ayakta kalir.
# Bu, arka plan/detach kaynakli kapanma sorunlarini engeller.
Write-Host "DersRotasi dev server baslatiliyor: http://127.0.0.1:3000" -ForegroundColor Cyan
Write-Host "Durdurmak icin: Ctrl + C" -ForegroundColor DarkGray

node $vite --host 127.0.0.1 --port 3000 --strictPort
