"""Backup SQLite database LoraField secara aman (live backup via sqlite3.backup()).

Output: backend/data/backups/lorafield-YYYY-MM-DD-HHMMSS.db
Retention: simpan 7 backup terakhir, hapus yang lebih lama.

Jalankan dari root project atau dari folder backend/:
    .venv\\Scripts\\python.exe scripts/backup_db.py
"""

from __future__ import annotations

import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

KEEP_BACKUPS = 7

BACKEND_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BACKEND_DIR / "data" / "lorafield.db"
BACKUP_DIR = BACKEND_DIR / "data" / "backups"


def main() -> int:
    if not DB_PATH.exists():
        print(f"[ERROR] Database tidak ditemukan: {DB_PATH}", file=sys.stderr)
        return 1

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d-%H%M%S")
    backup_path = BACKUP_DIR / f"lorafield-{timestamp}.db"

    src = sqlite3.connect(str(DB_PATH))
    dst = sqlite3.connect(str(backup_path))
    try:
        with dst:
            src.backup(dst)
    finally:
        dst.close()
        src.close()

    size_kb = backup_path.stat().st_size / 1024
    print(f"[OK] Backup tersimpan: {backup_path.name} ({size_kb:.1f} KB)")

    # Rotasi: hapus backup paling lama bila melebihi KEEP_BACKUPS.
    existing = sorted(BACKUP_DIR.glob("lorafield-*.db"))
    for old in existing[:-KEEP_BACKUPS]:
        try:
            old.unlink()
            print(f"[OK] Hapus backup lama: {old.name}")
        except OSError as exc:
            print(f"[WARN] Gagal hapus {old.name}: {exc}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())
