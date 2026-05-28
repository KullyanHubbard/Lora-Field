@echo off
title LoraField Server
echo.
echo  LoraField - Menjalankan server lokal...
echo  Akses dari device lain: http://192.168.1.5:8000
echo  Tekan Ctrl+C untuk menghentikan server.
echo.

cd /d "%~dp0"
call .venv\Scripts\activate.bat
uvicorn app.main:app --host 0.0.0.0 --port 8000
pause
