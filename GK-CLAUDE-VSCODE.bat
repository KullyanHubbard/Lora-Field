@echo off
setlocal
title GeraiKita AI API - VS Code (Claude Code extension)
color 0B

echo ============================================================
echo        GeraiKita AI API  -  VS Code (ekstensi Claude Code)
echo ============================================================
echo.
echo  PENTING: Tutup SEMUA jendela VS Code dulu agar env terbaca.
echo  Pastikan ekstensi "Claude Code" (by Anthropic) sudah terpasang.
echo.

set /p GK_KEY="Masukkan API Key (gk-...): "
if "%GK_KEY%"=="" (
  echo  [X] API Key tidak boleh kosong.
  pause
  exit /b 1
)

set "ANTHROPIC_API_KEY="
set "ANTHROPIC_BASE_URL=https://api.geraikita.com/v1/claude"
set "ANTHROPIC_AUTH_TOKEN=%GK_KEY%"
set "ANTHROPIC_MODEL=gk/claude-sonnet-4.6"
set "ANTHROPIC_SMALL_FAST_MODEL=gk/claude-haiku-4.5"

echo.
echo  [OK] Membuka VS Code dengan konfigurasi GeraiKita...
start "" code .
exit /b 0
