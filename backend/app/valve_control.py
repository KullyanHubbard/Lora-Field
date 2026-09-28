"""Kendali valve mode manual: perintah per node, tutup otomatis, dan catatan di decision_logs.

Perintah disimpan di server lalu dikirim ke gateway lewat MQTT (mqtt_bridge). valve_command_sent_at
diisi saat alat melaporkan posisi valve yang sama. Semua fungsi jalan di dalam transaksi pemanggil.
"""

from fastapi import HTTPException

from .config import settings
from .irrigation import MANUAL_DECISIONS
from .node_service import present_node


def require_manual_mode(farm: dict) -> None:
    if farm.get("irrigation_mode") != "manual":
        raise HTTPException(status_code=409, detail="Kebun sedang mode otomatis.")


def latest_soil_moisture(connection, node_id: str) -> float | None:
    row = connection.execute(
        """
        SELECT soil_moisture FROM readings
        WHERE node_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT 1
        """,
        (node_id,),
    ).fetchone()
    return row["soil_moisture"] if row else None


def farm_nodes(connection, farm_id: str) -> list[dict]:
    return [
        present_node(dict(row))
        for row in connection.execute(
            "SELECT * FROM nodes WHERE farm_id = ? ORDER BY id",
            (farm_id,),
        ).fetchall()
    ]


def _log_manual_action(
    connection, node_id: str, decision_type: str, created_at: str | None = None
) -> None:
    # Aksi manual tidak memakai cuaca, jadi kolom weather dikosongkan.
    decision = MANUAL_DECISIONS[decision_type]
    connection.execute(
        """
        INSERT INTO decision_logs
            (node_id, soil_moisture, weather, decision, decision_type, valve_state, reason, created_at)
        VALUES (?, ?, '', ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
        """,
        (
            node_id,
            latest_soil_moisture(connection, node_id),
            decision["decision"],
            decision["type"],
            decision["valve_state"],
            decision["reason"],
            created_at,
        ),
    )


def set_valve_command(connection, node: dict, open_valve: bool) -> None:
    """Simpan perintah buka/tutup untuk satu node lalu catat di riwayat. Tanpa efek kalau sama."""
    # Node tanpa perintah (mis. terdaftar setelah mode manual aktif) dianggap tertutup.
    current = "open" if node.get("valve_command") == "open" else "closed"
    command = "open" if open_valve else "closed"
    if current == command:
        return
    if open_valve:
        if node["status"] != "online":
            raise HTTPException(status_code=409, detail="Node offline, valve tidak bisa dibuka.")
        if latest_soil_moisture(connection, node["id"]) is None:
            raise HTTPException(status_code=409, detail="Node belum mengirim data sensor.")
    connection.execute(
        """
        UPDATE nodes
        SET valve_command = ?,
            valve_command_at = CURRENT_TIMESTAMP,
            valve_command_sent_at = NULL
        WHERE id = ?
        """,
        (command, node["id"]),
    )
    _log_manual_action(connection, node["id"], "manual_open" if open_valve else "manual_closed")


def expire_manual_valves(connection, farm_id: str) -> None:
    """Tutup valve manual yang sudah melewati MANUAL_IRRIGATION_MAX_MINUTES.

    Dicek setiap kali data kebun dibaca atau diubah, bukan oleh penjadwal, jadi waktu
    penutupan dicatat sesuai batasnya, bukan waktu pengecekan.
    """
    offset = f"+{settings.manual_irrigation_max_minutes} minutes"
    expired = connection.execute(
        """
        SELECT id, datetime(valve_command_at, ?) AS closes_at
        FROM nodes
        WHERE farm_id = ?
          AND valve_command = 'open'
          AND datetime(valve_command_at, ?) <= datetime('now')
        """,
        (offset, farm_id, offset),
    ).fetchall()
    for row in expired:
        connection.execute(
            """
            UPDATE nodes
            SET valve_command = 'closed',
                valve_command_at = ?,
                valve_command_sent_at = NULL
            WHERE id = ?
            """,
            (row["closes_at"], row["id"]),
        )
        _log_manual_action(connection, row["id"], "manual_timeout", created_at=row["closes_at"])
