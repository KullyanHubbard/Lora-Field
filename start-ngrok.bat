@echo off
title LoraField - Dev + Ngrok
cd /d "%~dp0"

echo ========================================
echo   LoraField - Start All Services
echo ========================================
echo.

:: Cek ngrok
where ngrok >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] ngrok tidak ditemukan. Install dulu dari https://ngrok.com/download
    echo.
    pause
    exit /b 1
)

:: 1. Frontend (port 5173)
echo [1/2] Starting Frontend Dev Server (port 5173)...
start "LoraField-Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

timeout /t 3 /nobreak >nul

:: 2. Ngrok - expose backend (asumsi backend sudah jalan manual di port 8000)
echo [2/2] Starting Ngrok (http://localhost:8000 ^<^> public URL)...
start "Ngrok" cmd /k "ngrok http 8000 --host-header=rewrite"

echo.
echo ========================================
echo   Frontend + Ngrok sudah dijalankan.
echo   Pastikan backend sudah jalan manual di port 8000.
echo   Ngrok URL akan muncul di jendela Ngrok.
echo ========================================
echo.

:: Buka browser ke localhost biar cek
timeout /t 2 /nobreak >nul
start http://localhost:5173

echo.
echo Press any key to close ALL services...
pause >nul

echo.
echo Stopping services started by this script...
taskkill /f /fi "WINDOWTITLE eq LoraField-Frontend" >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq Ngrok" >nul 2>&1

echo Done.
exit /b 0