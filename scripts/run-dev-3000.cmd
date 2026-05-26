@echo off
setlocal
cd /d "%~dp0.."
echo DersRotasi dev server baslatiliyor: http://127.0.0.1:3000
echo Pencereyi kapatmayin. Durdurmak icin Ctrl+C.
node node_modules\vite\bin\vite.js --host 127.0.0.1 --port 3000 --strictPort
endlocal
