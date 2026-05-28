@echo off
title LoraField Backend
cd /d "%~dp0backend"

set "HOST=127.0.0.1"
set "PORT=8000"
set "API_URL=http://localhost:%PORT%"
set "HEALTH_URL=http://%HOST%:%PORT%/health"

echo Mengecek backend di port %PORT%...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 '%HEALTH_URL%'; if ($r.StatusCode -eq 200) { exit 0 }; exit 1 } catch { exit 1 }"
if %ERRORLEVEL%==0 (
    echo Backend sudah berjalan.
    echo Akses API: %API_URL%
    echo Akses Docs: %API_URL%/docs
    echo.
    pause
    exit /b 0
)

netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING" >nul
if %ERRORLEVEL%==0 (
    echo Port %PORT% sedang dipakai, tapi bukan backend LoraField yang merespons /health.
    echo Cek proses dengan perintah:
    echo netstat -ano ^| findstr :%PORT%
    echo.
    pause
    exit /b 1
)

echo Mengaktifkan virtual environment...
call .venv\Scripts\activate

echo Menjalankan backend LoraField...
echo Akses API: %API_URL%
echo Akses Docs: %API_URL%/docs
echo.
echo Tekan Ctrl+C untuk berhenti.
echo.

uvicorn app.main:app --reload --host %HOST% --port %PORT%
pause
