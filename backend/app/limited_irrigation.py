"""Irigasi Terbatas: batas siram mode otomatis diturunkan sementara per kebun, selesai sendiri di tanggalnya.

Tetap tersimpan saat mode manual, tapi hanya dipakai keputusan mode otomatis. Semua fungsi jalan di
dalam transaksi pemanggil.
"""

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

from .config import settings
from .crops import is_rice
from .irrigation import farm_thresholds
from .node_service import _parse_db_time
from .schemas import ThresholdConfig

# Dicatat di decision_logs untuk tiap node kebun yang sudah punya reading.
LIMITED_EVENTS = {
    "limited_started": {
        "decision": "Irigasi Terbatas dimulai",
        "reason": "Batas siram otomatis diturunkan sementara.",
    },
    "limited_changed": {
        "decision": "Irigasi Terbatas diubah",
        "reason": "Tanggal selesai Irigasi Terbatas diubah.",
    },
    "limited_stopped": {
        "decision": "Irigasi Terbatas dihentikan",
        "reason": "Dihentikan pengguna. Batas siram kembali normal.",
    },
    "limited_ended": {
        "decision": "Irigasi Terbatas selesai",
        "reason": "Tanggal selesai tercapai. Batas siram kembali normal.",
    },
}


def _db_time(value: datetime) -> str:
    return value.strftime("%Y-%m-%d %H:%M:%S")


def is_limited_active(farm: dict, now: datetime) -> bool:
    until = _parse_db_time(farm.get("limited_until"))
    return until is not None and now < until


def decision_thresholds(farm: dict, now: datetime) -> ThresholdConfig:
    """Threshold untuk keputusan mode otomatis. summary.thresholds tetap threshold tanaman."""
    thresholds = farm_thresholds(farm)
    if not is_limited_active(farm, now):
        return thresholds
    drop = settings.limited_irrigation_drop_points
    return ThresholdConfig(lower=max(thresholds.lower - drop, 0), upper=max(thresholds.upper - drop, 0))


def limited_until_text(until: datetime, now: datetime) -> str:
    """Validasi tanggal selesai dari pengguna lalu ubah ke teks UTC seperti kolom waktu lain di DB."""
    until = until.astimezone(timezone.utc) if until.tzinfo else until.replace(tzinfo=timezone.utc)
    max_days = settings.limited_irrigation_max_days
    # +1 hari: frontend mengirim akhir hari lokal, jadi hari ke-max_days masih boleh.
    if not now < until <= now + timedelta(days=max_days + 1):
        raise HTTPException(
            status_code=422,
            detail=f"Tanggal selesai harus setelah hari ini dan paling lambat {max_days} hari lagi.",
        )
    return _db_time(until)


def log_limited_event(
    connection,
    farm_id: str,
    event: str,
    until: str | None = None,
    reason: str | None = None,
    created_at: str | None = None,
) -> None:
    # Kelembapan dan posisi valve disalin dari data terakhir node supaya baris riwayat tetap lengkap.
    info = LIMITED_EVENTS[event]
    connection.execute(
        """
        INSERT INTO decision_logs
            (node_id, soil_moisture, weather, decision, decision_type, valve_state, reason,
             created_at, limited_until, limited_reason)
        SELECT
            n.id,
            (SELECT r.soil_moisture FROM readings r WHERE r.node_id = n.id
             ORDER BY r.created_at DESC, r.id DESC LIMIT 1),
            '', ?, ?,
            COALESCE(
                (SELECT dl.valve_state FROM decision_logs dl WHERE dl.node_id = n.id
                 ORDER BY dl.created_at DESC, dl.id DESC LIMIT 1),
                'closed'
            ),
            ?, COALESCE(?, CURRENT_TIMESTAMP), ?, ?
        FROM nodes n
        WHERE n.farm_id = ? AND EXISTS (SELECT 1 FROM readings r WHERE r.node_id = n.id)
        """,
        (info["decision"], event, info["reason"], created_at, until, reason, farm_id),
    )


def expire_limited_irrigation(connection, farm: dict, now: datetime) -> dict:
    """Akhiri Irigasi Terbatas yang tanggalnya lewat. Kembalikan farm terbaru.

    Dicek setiap kali data kebun dibaca atau reading masuk, jadi waktu selesai dicatat sesuai
    tanggalnya, bukan waktu pengecekan.
    """
    until = farm.get("limited_until")
    if until is None or is_limited_active(farm, now):
        return farm
    # Syarat limited_until = ? mencegah dua proses mencatat "selesai" dua kali.
    cleared = connection.execute(
        "UPDATE farms SET limited_until = NULL, limited_reason = NULL WHERE id = ? AND limited_until = ?",
        (farm["id"], until),
    ).rowcount
    if cleared:
        log_limited_event(connection, farm["id"], "limited_ended", created_at=until)
    return {**farm, "limited_until": None, "limited_reason": None}


def require_limited_available(farm: dict) -> None:
    if farm.get("irrigation_mode") != "auto":
        raise HTTPException(status_code=409, detail="Irigasi Terbatas hanya bisa dimulai di mode otomatis.")
    if is_rice(farm.get("crop_type")):
        raise HTTPException(status_code=409, detail="Irigasi Terbatas tidak tersedia untuk padi.")
    if farm.get("limited_until"):
        raise HTTPException(status_code=409, detail="Irigasi Terbatas sudah aktif.")


def require_limited_active(farm: dict) -> None:
    if not farm.get("limited_until"):
        raise HTTPException(status_code=409, detail="Irigasi Terbatas tidak sedang aktif.")
