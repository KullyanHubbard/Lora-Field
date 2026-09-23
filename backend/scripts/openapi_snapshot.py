"""Dump skema OpenAPI backend ke file JSON, untuk dipakai sebagai baseline refactor.

Idenya: sebelum merapikan struktur backend, simpan snapshot kontrak API apa adanya.
Setelah refactor, dump ulang lalu bandingkan. Diff kosong = tidak ada route yang
kececer dan tidak ada shape body/response yang berubah.

Skrip ini hanya membaca skema (app.openapi()). Startup event tidak dijalankan,
jadi database tidak disentuh sama sekali.

Jalankan dari root project atau dari folder backend/:
    python backend/scripts/openapi_snapshot.py <path-output.json>

Tanpa argumen, output ke backend/scripts/openapi_current.json.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.main import app  # noqa: E402  (butuh sys.path di atas)


def main() -> int:
    if len(sys.argv) > 1:
        out_path = Path(sys.argv[1]).resolve()
    else:
        out_path = BACKEND_DIR / "scripts" / "openapi_current.json"

    schema = app.openapi()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        json.dumps(schema, indent=2, sort_keys=True, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    route_count = sum(len(methods) for methods in schema.get("paths", {}).values())
    print(f"OpenAPI snapshot ditulis ke: {out_path}")
    print(f"  paths     : {len(schema.get('paths', {}))}")
    print(f"  operations: {route_count}")
    print(f"  schemas   : {len(schema.get('components', {}).get('schemas', {}))}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
