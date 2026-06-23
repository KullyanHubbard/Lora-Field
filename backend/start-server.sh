#!/usr/bin/env bash
# ============================================================
#  LoraField - Menjalankan server backend lokal (Linux)
#  Padanan dari start-server.bat untuk Windows.
#  Backend : FastAPI/uvicorn -> http://localhost:8000  (docs: /docs)
#  Tekan Ctrl+C untuk menghentikan server.
# ============================================================
set -euo pipefail

# Pindah ke folder backend (lokasi script ini), apa pun cwd pemanggil.
cd "$(dirname "${BASH_SOURCE[0]}")"

HOST="0.0.0.0"
PORT="8000"

echo
echo "================================================"
echo "  LoraField - menjalankan server backend"
echo "================================================"
echo
echo "  Lokal       : http://localhost:${PORT}   (docs: /docs)"
echo "  Device lain : http://<IP-LAN-kamu>:${PORT}"
echo
echo "  Tekan Ctrl+C untuk menghentikan server."
echo

# Pastikan venv Linux ada.
if [ ! -f ".venv/bin/activate" ]; then
    echo "PERINGATAN: venv backend tidak ditemukan di backend/.venv"
    echo "Setup dulu:"
    echo "  python3 -m venv .venv"
    echo "  source .venv/bin/activate"
    echo "  pip install -r requirements.txt"
    echo
    exit 1
fi

source .venv/bin/activate
exec uvicorn app.main:app --host "${HOST}" --port "${PORT}"
