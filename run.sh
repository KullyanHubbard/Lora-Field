#!/usr/bin/env bash
# ============================================================
#  LoraField - Start Backend + Frontend sekaligus (Linux)
#  Backend  : FastAPI/uvicorn  -> http://localhost:8000
#  Frontend : React/Vite       -> http://localhost:5173
#  Tekan Ctrl+C untuk menghentikan keduanya.
# ============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST="0.0.0.0"
PORT="8000"

echo
echo "================================================"
echo "  LoraField - menjalankan Backend + Frontend"
echo "================================================"
echo
echo "  Backend  : http://localhost:${PORT}   (docs: /docs)"
echo "  Frontend : http://localhost:5173"
echo
echo "  Tekan Ctrl+C untuk berhenti."
echo

# --- Backend ---
cd "${ROOT}/backend"
if [ ! -f ".venv/bin/activate" ]; then
    echo "PERINGATAN: venv backend tidak ditemukan di backend/.venv"
    echo "Setup dulu: cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt"
    echo
fi
source .venv/bin/activate
uvicorn app.main:app --host "${HOST}" --port "${PORT}" --reload &
BACKEND_PID=$!

# --- Frontend ---
cd "${ROOT}/frontend"
if [ ! -d "node_modules" ]; then
    echo "PERINGATAN: node_modules frontend belum ada. Jalankan: cd frontend && npm install"
    echo
fi
npm run dev &
FRONTEND_PID=$!

# Hentikan kedua proses saat Ctrl+C
trap 'echo; echo "Menghentikan..."; kill "${BACKEND_PID}" "${FRONTEND_PID}" 2>/dev/null || true' INT TERM

wait
