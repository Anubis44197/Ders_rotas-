$ErrorActionPreference = 'Stop'

Set-Location "C:\Users\90535\Desktop\Ders_rotas-"

while ($true) {
  try {
    Write-Host "Vite baslatiliyor: http://127.0.0.1:3000" -ForegroundColor Cyan
    node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 3000 --strictPort
  } catch {
    Write-Host "Vite hata verdi: $($_.Exception.Message)" -ForegroundColor Yellow
  }

  Write-Host "Sunucu kapandi. 2 sn sonra yeniden baslatiliyor..." -ForegroundColor DarkYellow
  Start-Sleep -Seconds 2
}
