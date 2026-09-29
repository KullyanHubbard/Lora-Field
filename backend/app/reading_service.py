"""Pemrosesan reading sensor: keputusan irigasi lalu simpan. Dipakai route HTTP dan jembatan MQTT."""

from datetime import datetime, timezone

from .config import settings
from .database import row_to_dict
from .irrigation import MANUAL_DECISIONS, auto_decision, effective_rain_next_3h, farm_thresholds, manual_decision
from .node_service import is_recently_seen, record_reading
from .schemas import MqttReadingIn, SensorReadingIn
from .valve_control import expire_manual_valves


def apply_reading(
    connection, node_id: str, farm: dict, payload: SensorReadingIn, weather: dict | None
) -> tuple[int, dict]:
    """Hitung keputusan irigasi lalu simpan reading. Kembalikan (id reading, keputusan).

    Node dan kebun sudah dipastikan pemanggil. Jalan di dalam transaksi pemanggil.
    """
    farm_id = farm["id"]
    if farm.get("irrigation_mode") == "manual":
        expire_manual_valves(connection, farm_id)
        node = row_to_dict(
            connection.execute("SELECT * FROM nodes WHERE id = ?", (node_id,)).fetchone()
        )
        decision = manual_decision(node)
        # Tanah jenuh menutup valve yang dibuka manual. Mode otomatis sudah berhenti jauh sebelum ini
        # (target siram di bawah batas atas tanaman).
        if node["valve_command"] == "open" and payload.soil_moisture >= settings.soil_saturation_stop_pct:
            connection.execute(
                """
                UPDATE nodes
                SET valve_command = 'closed',
                    valve_command_at = CURRENT_TIMESTAMP,
                    valve_command_sent_at = NULL
                WHERE id = ?
                """,
                (node_id,),
            )
            decision = dict(MANUAL_DECISIONS["manual_saturated"])
    else:
        # Dibaca sebelum record_reading, jadi last_seen_at masih waktu reading sebelumnya.
        node = row_to_dict(
            connection.execute("SELECT * FROM nodes WHERE id = ?", (node_id,)).fetchone()
        )
        # Node sempat offline: siklus lama dianggap putus, mulai lagi dari pulsa pertama.
        # auto_limit_at tidak di-reset supaya jeda pengaman sensor rusak tetap berlaku.
        broken_cycle = {}
        if node["auto_pulse_count"] > 0 and not is_recently_seen(node["last_seen_at"]):
            broken_cycle = {
                "auto_pulse_count": 0,
                "auto_pulse_started_at": None,
                "auto_cycle_baseline": None,
                "auto_confirmed_pulse_count": 0,
            }
            node = {**node, **broken_cycle}
        decision, state = auto_decision(
            payload.soil_moisture,
            effective_rain_next_3h(farm, weather),
            farm_thresholds(farm),
            node,
            datetime.now(timezone.utc),
            payload.valve if isinstance(payload, MqttReadingIn) else None,
        )
        state = {**broken_cycle, **state}
        if state:
            # Nama kolom hanya dari auto_decision, bukan dari input pengguna.
            assignments = ", ".join(f"{column} = ?" for column in state)
            connection.execute(
                f"UPDATE nodes SET {assignments} WHERE id = ?", (*state.values(), node_id)
            )
    reading_id = record_reading(connection, node_id, farm_id, payload, weather, decision)
    return reading_id, decision
