"""Operasi tulis node: pembuatan baris node dan pencatatan reading sensor.

Dipakai registrasi batch gateway dan self-registration lewat endpoint readings.
Semua fungsi jalan di dalam transaksi pemanggil.
"""

from datetime import datetime, timedelta, timezone

from .config import settings
from .schemas import SensorReadingIn


def insert_node(
    connection,
    node_id: str,
    farm_id: str,
    name: str,
    *,
    gateway_id: str | None = None,
    location: str = "",
    region: str = "",
    latitude: float | None = None,
    longitude: float | None = None,
) -> None:
    # Kolom status dan battery NOT NULL, jadi tetap diisi. status di response API
    # selalu diturunkan present_node() dari last_seen_at, bukan dari kolom ini.
    # battery diisi 0. battery_updated_at yang NULL menandai
    # baterai belum pernah dilaporkan, dan present_node() mengirimnya sebagai null.
    connection.execute(
        """
        INSERT INTO nodes
            (id, farm_id, gateway_id, name, location, region,
             latitude, longitude, status, battery, first_seen_at, last_seen_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'online', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        """,
        (node_id, farm_id, gateway_id, name, location, region, latitude, longitude),
    )


def _parse_db_time(value: str | None) -> datetime | None:
    """Waktu CURRENT_TIMESTAMP SQLite = UTC tanpa penanda zona."""
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def is_recently_seen(last_seen_at: str | None) -> bool:
    """True kalau waktu terakhir terlihat masih dalam batas NODE_OFFLINE_AFTER_MINUTES."""
    last_seen = _parse_db_time(last_seen_at)
    offline_after = timedelta(minutes=settings.node_offline_after_minutes)
    return last_seen is not None and datetime.now(timezone.utc) - last_seen <= offline_after


def present_node(node: dict) -> dict:
    """Bentuk node untuk response API: status dari data terakhir, baterai null kalau belum dilaporkan."""
    presented = dict(node)
    presented["status"] = "online" if is_recently_seen(node.get("last_seen_at")) else "offline"
    presented["valve_auto_close_at"] = None
    command_at = _parse_db_time(node.get("valve_command_at"))
    if node.get("valve_command") == "open" and command_at is not None:
        closes_at = command_at + timedelta(minutes=settings.manual_irrigation_max_minutes)
        presented["valve_auto_close_at"] = closes_at.strftime("%Y-%m-%d %H:%M:%S")
    if not node.get("battery_updated_at"):
        presented["battery"] = None
    return presented


def record_reading(
    connection,
    node_id: str,
    farm_id: str,
    payload: SensorReadingIn,
    weather: dict | None,
    decision: dict,
) -> int:
    """Simpan reading, tandai node online, dan catat keputusan irigasinya. Kembalikan id reading."""
    cursor = connection.execute(
        """
        INSERT INTO readings
            (farm_id, node_id, soil_moisture, soil_temp, air_temp, air_humidity, rssi)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            farm_id,
            node_id,
            payload.soil_moisture,
            payload.soil_temp,
            payload.air_temp,
            payload.air_humidity,
            payload.rssi,
        ),
    )
    reading_id = cursor.lastrowid
    connection.execute(
        """
        UPDATE nodes
        SET last_seen_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """,
        (node_id,),
    )
    if payload.battery is not None:
        connection.execute(
            """
            UPDATE nodes
            SET battery = ?, battery_updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (round(payload.battery), node_id),
        )
    connection.execute(
        """
        INSERT INTO decision_logs
            (node_id, soil_moisture, weather, decision, decision_type, valve_state, reason)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            node_id,
            payload.soil_moisture,
            (weather or {}).get("condition") or "",
            decision["decision"],
            decision["type"],
            decision["valve_state"],
            decision["reason"],
        ),
    )
    return reading_id
