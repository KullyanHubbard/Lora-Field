@echo off
setlocal enabledelayedexpansion
title LoraField Backend Manager

rem ============================================================
rem  LoraField Backend Manager: start / stop / restart / status
rem  Klik dua kali, pilih menu.
rem ============================================================

set "BACKEND_DIR=%~dp0backend"
set "HOST=127.0.0.1"
set "PORT=8000"
set "HEALTH_URL=http://%HOST%:%PORT%/health"
set "VENV_UVICORN=%BACKEND_DIR%\.venv\Scripts\uvicorn.exe"
set "VENV_PYTHON=%BACKEND_DIR%\.venv\Scripts\python.exe"
set "BACKUP_SCRIPT=%BACKEND_DIR%\scripts\backup_db.py"
set "APP_LOG=%BACKEND_DIR%\logs\app.log"

:menu
cls
echo.
echo ================================================
echo   LoraField Backend Manager
echo ================================================
call :check_port
if "!PORT_BUSY!"=="1" (
    echo   Port %PORT% : [LISTENING]
) else (
    echo   Port %PORT% : [free]
)
echo.
echo   1. Start backend ^(Ctrl+C untuk stop^)
echo   2. Stop backend
echo   3. Restart backend
echo   4. Cek status detail
echo   5. Tail app.log ^(50 baris terakhir^)
echo   6. Backup database sekarang
echo   0. Keluar
echo.
set "choice="
set /p "choice=Pilih [0-6]: "

if "%choice%"=="1" goto start
if "%choice%"=="2" goto stop
if "%choice%"=="3" goto restart
if "%choice%"=="4" goto status
if "%choice%"=="5" goto tail
if "%choice%"=="6" goto backup
if "%choice%"=="0" goto end
goto menu

rem ------------------------------------------------------------
:check_port
set "PORT_BUSY=0"
netstat -ano 2>nul | findstr /R /C:":%PORT% .*LISTENING" >nul 2>&1
if !errorlevel! equ 0 set "PORT_BUSY=1"
exit /b

rem ------------------------------------------------------------
:kill_port
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue | ForEach-Object { try { Stop-Process -Id $_.OwningProcess -Force -ErrorAction Stop; Write-Host ('  killed PID ' + $_.OwningProcess) } catch { Write-Host ('  gagal kill PID ' + $_.OwningProcess + ': ' + $_.Exception.Message) } }"
exit /b

rem ------------------------------------------------------------
:start
call :check_port
if "!PORT_BUSY!"=="1" (
    echo.
    echo Port %PORT% sudah dipakai. Pilih [2] untuk stop dulu.
    echo.
    pause
    goto menu
)
if not exist "%VENV_UVICORN%" (
    echo.
    echo ERROR: uvicorn tidak ditemukan di:
    echo   %VENV_UVICORN%
    echo Pastikan venv backend sudah di-setup.
    echo.
    pause
    goto menu
)
echo.
echo Menjalankan backend di %HOST%:%PORT%
echo Log file: %APP_LOG%
echo Tekan Ctrl+C untuk menghentikan, lalu balik ke menu.
echo.
cd /d "%BACKEND_DIR%"
"%VENV_UVICORN%" app.main:app --host %HOST% --port %PORT%
echo.
echo Backend berhenti.
pause
goto menu

rem ------------------------------------------------------------
:stop
call :check_port
if "!PORT_BUSY!"=="0" (
    echo.
    echo Tidak ada proses di port %PORT%.
    pause
    goto menu
)
echo.
echo Menghentikan proses di port %PORT% ...
call :kill_port
timeout /t 2 /nobreak >nul
call :check_port
if "!PORT_BUSY!"=="1" (
    echo.
    echo PERINGATAN: port masih dipakai. Kemungkinan Task Scheduler "LoraField Backend"
    echo otomatis respawn supervisor. Untuk stop permanen jalankan PowerShell:
    echo   Stop-ScheduledTask -TaskName "LoraField Backend"
) else (
    echo Backend berhenti.
)
pause
goto menu

rem ------------------------------------------------------------
:restart
echo.
call :check_port
if "!PORT_BUSY!"=="1" (
    echo Menghentikan instance lama ...
    call :kill_port
    timeout /t 2 /nobreak >nul
)
if not exist "%VENV_UVICORN%" (
    echo ERROR: uvicorn tidak ditemukan di %VENV_UVICORN%
    pause
    goto menu
)
echo Menjalankan ulang backend ...
echo Tekan Ctrl+C untuk berhenti.
echo.
cd /d "%BACKEND_DIR%"
"%VENV_UVICORN%" app.main:app --host %HOST% --port %PORT%
echo.
echo Backend berhenti.
pause
goto menu

rem ------------------------------------------------------------
:status
echo.
echo === Status backend ===
echo Host:port  : %HOST%:%PORT%
echo Health URL : %HEALTH_URL%
echo Log file   : %APP_LOG%
echo.
echo Cek health endpoint ...
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 '%HEALTH_URL%'; Write-Host ('  HTTP ' + $r.StatusCode + ' | ' + $r.Content) } catch { Write-Host ('  ERROR: ' + $_.Exception.Message) }"
echo.
echo Proses listen di port %PORT% :
powershell -NoProfile -Command "$found = Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue; if (-not $found) { Write-Host '  (tidak ada)' } else { $found | ForEach-Object { $p = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue; if ($p) { Write-Host ('  PID ' + $_.OwningProcess + '  ' + $p.ProcessName) } } }"
echo.
pause
goto menu

rem ------------------------------------------------------------
:tail
echo.
echo === Tail %APP_LOG% (50 baris terakhir) ===
echo.
if not exist "%APP_LOG%" (
    echo Log file belum ada. Pernah start backend belum?
) else (
    powershell -NoProfile -Command "Get-Content -Path '%APP_LOG%' -Tail 50"
)
echo.
pause
goto menu

rem ------------------------------------------------------------
:backup
echo.
echo === Backup database ===
if not exist "%VENV_PYTHON%" (
    echo ERROR: Python venv tidak ditemukan di %VENV_PYTHON%
    pause
    goto menu
)
if not exist "%BACKUP_SCRIPT%" (
    echo ERROR: Backup script tidak ditemukan di %BACKUP_SCRIPT%
    pause
    goto menu
)
"%VENV_PYTHON%" "%BACKUP_SCRIPT%"
echo.
pause
goto menu

rem ------------------------------------------------------------
:end
endlocal
exit /b 0
