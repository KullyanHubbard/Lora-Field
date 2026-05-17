@echo off
title LoraField Backend
cd /d "%~dp0backend"

echo Mengaktifkan virtual environment...
call .venv\Scripts\activate

echo Menjalankan backend LoraField...
echo Akses API: http://localhost:8000
echo Akses Docs: http://localhost:8000/docs
echo.
echo Tekan Ctrl+C untuk berhenti.
echo.

uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
pause
