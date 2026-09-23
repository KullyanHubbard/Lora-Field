"""Operasi tulis node: pembuatan baris node dan pencatatan reading sensor.

Dipakai registrasi batch gateway dan self-registration lewat endpoint readings.
Semua fungsi jalan di dalam transaksi pemanggil.
"""

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
    # Nilai awal tetap: belum ada jalur yang memperbarui battery dari laporan perangkat.
    connection.execute(
        """
        INSERT INTO nodes
            (id, farm_id, gateway_id, name, location, region,
             latitude, longitude, status, battery, first_seen_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'online', 100, CURRENT_TIMESTAMP)
        """,
        (node_id, farm_id, gateway_id, name, location, region, latitude, longitude),
    )


def record_reading(
    connection,
    node_id: str,
    farm_id: str,
    payload: SensorReadingIn,
    weather: dict,
    decision: dict,
) -> int:
    """Simpan reading, tandai node online, dan catat keputusan irigasinya. Kembalikan id reading."""
    cursor = connection.execute(
        """
        INSERT INTO readings
            (farm_id, node_id, soil_moisture, soil_temp, air_temp, air_humidity)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            farm_id,
            node_id,
            payload.soil_moisture,
            payload.soil_temp,
            payload.air_temp,
            payload.air_humidity,
        ),
    )
    reading_id = cursor.lastrowid
    connection.execute(
        """
        UPDATE nodes
        SET status = 'online', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """,
        (node_id,),
    )
    connection.execute(
        """
        INSERT INTO decision_logs
            (node_id, soil_moisture, weather, decision, valve_state, reason)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            node_id,
            payload.soil_moisture,
            weather["condition"],
            decision["decision"],
            decision["valve_state"],
            decision["reason"],
        ),
    )
    return reading_id
