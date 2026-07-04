#!/usr/bin/env bash
# ============================================================
#  LoraField - Menjalankan server backend lokal (Linux)
#  Backend : FastAPI/uvicorn -> http://localhost:8000  (docs: /docs)
#  Tekan Ctrl+C untuk menghentikan server.
# ============================================================
set -euo pipefail

# Pindah ke folder backend (lokasi script ini), apa pun cwd pemanggil.
cd "$(dirname "${BASH_SOURCE[0]}")"

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8000}"
VENV_DIR="${VENV_DIR:-.venv}"
PYTHON_BIN="${PYTHON_BIN:-python3}"

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

if ! command -v "${PYTHON_BIN}" >/dev/null 2>&1; then
    echo "ERROR: ${PYTHON_BIN} tidak ditemukan."
    echo "Install Python 3 dulu, lalu jalankan ulang script ini."
    exit 1
fi

if [ ! -d "${VENV_DIR}" ]; then
    echo "Membuat virtual environment di ${VENV_DIR}..."
    "${PYTHON_BIN}" -m venv "${VENV_DIR}"
fi

if [ ! -f "${VENV_DIR}/bin/activate" ]; then
    echo "ERROR: ${VENV_DIR}/bin/activate tidak ditemukan."
    echo "Hapus folder ${VENV_DIR} lalu jalankan ulang jika virtualenv rusak."
    exit 1
fi

source "${VENV_DIR}/bin/activate"

echo "Menginstall dependency backend..."
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

echo
echo "Server berjalan di:"
echo "  http://localhost:${PORT}"
echo "  http://localhost:${PORT}/docs"
echo

exec uvicorn app.main:app --host "${HOST}" --port "${PORT}" --reload
