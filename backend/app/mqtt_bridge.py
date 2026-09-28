"""Jembatan MQTT: terima pesan gateway dan kirim perintah valve. Format: docs/kontrak-mqtt.md.

Callback paho jalan di thread sendiri, jadi tiap pesan membuka koneksi database sendiri.
Pesan yang tidak valid diabaikan dan dicatat di log, tidak pernah dibalas ke gateway.
"""

from __future__ import annotations

import json
import logging
import re
import time
from datetime import datetime, timedelta, timezone

import paho.mqtt.client as mqtt
from pydantic import ValidationError

from .bmkg import get_weather_for_decision
from .config import settings
from .database import get_connection, row_to_dict
from .irrigation import manual_decision
from .node_service import _parse_db_time, default_node_name, insert_node
from .reading_service import apply_reading
from .schemas import DEVICE_ID_PATTERN, MqttNodeList, MqttReadingIn

logger = logging.getLogger("lorafield.mqtt")

TOPIC_ROOT = "lorafield/gw"
_DEVICE_ID = re.compile(DEVICE_ID_PATTERN)

_client: mqtt.Client | None = None
# ponytail: ingatan per proses. Setelah restart, perintah terakhir tiap node terkirim ulang
# sekali; aman karena isinya sama dan until berupa jam mutlak.
# Isi: node_id -> (isi pesan, waktu kirim dari time.monotonic()).
_last_published: dict[str, tuple[str, float]] = {}


def start() -> None:
    global _client
    if not settings.mqtt_host:
        logger.info("MQTT_HOST kosong: jembatan MQTT nonaktif.")
        return
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="lorafield-server")
    if settings.mqtt_username:
        client.username_pw_set(settings.mqtt_username, settings.mqtt_password)
    client.on_connect = _on_connect
    client.on_message = _on_message
    # connect_async: backend tetap jalan walau broker mati, paho menyambung ulang sendiri.
    client.connect_async(settings.mqtt_host, settings.mqtt_port, keepalive=60)
    client.loop_start()
    _client = client


def stop() -> None:
    global _client
    if _client is not None:
        _client.disconnect()
        _client.loop_stop()
        _client = None


def _on_connect(client, userdata, flags, reason_code, properties) -> None:
    if reason_code.is_failure:
        logger.warning("Gagal tersambung ke broker MQTT: %s", reason_code)
        return
    logger.info("Tersambung ke broker MQTT %s:%s", settings.mqtt_host, settings.mqtt_port)
    kinds = ("status", "heartbeat", "nodes", "node/+/reading")
    client.subscribe([(f"{TOPIC_ROOT}/+/{kind}", 0) for kind in kinds])


def _on_message(client, userdata, message) -> None:
    try:
        handle_message(message.topic, message.payload, message.retain)
    except Exception:
        # Satu pesan yang gagal diproses tidak boleh menghentikan thread MQTT.
        logger.exception("Gagal memproses pesan MQTT %s", message.topic)


def handle_message(topic: str, payload: bytes, retained: bool = False) -> None:
    parts = topic.split("/")
    if len(parts) < 4 or "/".join(parts[:2]) != TOPIC_ROOT:
        return
    gateway_id, kind = parts[2], parts[3:]
    # Isi kosong = penghapusan pesan retain di broker, bukan pesan dari gateway.
    if not payload:
        return
    try:
        data = json.loads(payload)
    except ValueError:
        logger.warning("Pesan MQTT bukan JSON, diabaikan: %s", topic)
        return
    if not isinstance(data, dict):
        logger.warning("Pesan MQTT bukan objek JSON, diabaikan: %s", topic)
        return

    if kind == ["status"]:
        _handle_status(gateway_id, data, retained)
    elif kind == ["heartbeat"]:
        _handle_heartbeat(gateway_id, data)
    elif kind == ["nodes"]:
        _handle_nodes(gateway_id, data)
    elif len(kind) == 3 and kind[0] == "node" and kind[2] == "reading":
        _handle_reading(gateway_id, kind[1], data)


def _claimed_farm(connection, gateway_id: str) -> dict | None:
    farm = row_to_dict(
        connection.execute(
            """
            SELECT farms.* FROM farms
            JOIN gateways ON gateways.farm_id = farms.id
            WHERE gateways.device_id = ?
            """,
            (gateway_id,),
        ).fetchone()
    )
    if farm is None:
        logger.info("Gateway %s belum terhubung ke kebun, pesan diabaikan.", gateway_id)
    return farm


def _touch_gateway(connection, gateway_id: str) -> None:
    connection.execute(
        "UPDATE gateways SET last_seen_at = CURRENT_TIMESTAMP WHERE device_id = ?", (gateway_id,)
    )


def _gateway_log(connection, farm_id: str, event: str, detail: str) -> None:
    connection.execute(
        "INSERT INTO gateway_logs (farm_id, event, detail) VALUES (?, ?, ?)",
        (farm_id, event, detail[:300]),
    )


def _handle_status(gateway_id: str, data: dict, retained: bool) -> None:
    # Status retain dikirim ulang broker tiap backend menyambung: itu keadaan lama, bukan kejadian baru.
    if retained:
        return
    state = data.get("state")
    if state not in ("online", "offline"):
        logger.warning("Status gateway %s tidak dikenal: %r", gateway_id, state)
        return
    with get_connection() as connection:
        farm = _claimed_farm(connection, gateway_id)
        if farm is None:
            return
        if state == "online":
            _touch_gateway(connection, gateway_id)
        detail = f"firmware {data['fw']}" if data.get("fw") else ""
        _gateway_log(connection, farm["id"], "connected" if state == "online" else "disconnected", detail)


def _handle_heartbeat(gateway_id: str, data: dict) -> None:
    with get_connection() as connection:
        farm = _claimed_farm(connection, gateway_id)
        if farm is None:
            return
        _touch_gateway(connection, gateway_id)
        detail = f"{data.get('nodes_heard', '?')} node terdengar, uptime {data.get('uptime_s', '?')} detik"
        _gateway_log(connection, farm["id"], "heartbeat", detail)


def _handle_nodes(gateway_id: str, data: dict) -> None:
    try:
        node_list = MqttNodeList.model_validate(data)
    except ValidationError as exc:
        logger.warning("Daftar node dari %s ditolak: %s", gateway_id, exc.errors())
        return
    with get_connection() as connection:
        farm = _claimed_farm(connection, gateway_id)
        if farm is None:
            return
        _touch_gateway(connection, gateway_id)
        for item in node_list.nodes:
            existing = connection.execute(
                "SELECT farm_id FROM nodes WHERE id = ?", (item.node_id,)
            ).fetchone()
            if existing is None:
                insert_node(
                    connection,
                    item.node_id,
                    farm["id"],
                    item.name or default_node_name(item.node_id),
                    gateway_id=gateway_id,
                )
                # Terdaftar belum berarti online: status node hanya dari data sensor.
                connection.execute(
                    "UPDATE nodes SET last_seen_at = NULL WHERE id = ?", (item.node_id,)
                )
            elif existing["farm_id"] != farm["id"]:
                logger.warning("Node %s sudah terdaftar di kebun lain, diabaikan.", item.node_id)
            else:
                # Nama dari gateway hanya dipakai saat node pertama terdaftar; setelah itu diatur di web.
                connection.execute(
                    "UPDATE nodes SET gateway_id = ? WHERE id = ?", (gateway_id, item.node_id)
                )


def _handle_reading(gateway_id: str, node_id: str, data: dict) -> None:
    if not _DEVICE_ID.fullmatch(node_id):
        logger.warning("ID node tidak valid dari %s: %r", gateway_id, node_id)
        return
    try:
        payload = MqttReadingIn.model_validate(data)
    except ValidationError as exc:
        logger.warning("Reading node %s ditolak: %s", node_id, exc.errors())
        return
    with get_connection() as connection:
        farm = _claimed_farm(connection, gateway_id)
    if farm is None:
        return
    # Diambil sebelum transaksi dibuka, alasannya sama dengan route HTTP readings.
    region_code = farm.get("bmkg_adm4_code") or ""
    weather = get_weather_for_decision(region_code) if region_code else None

    with get_connection() as connection:
        # Dibaca ulang: mode irigasi atau klaim gateway bisa berubah selama menunggu BMKG.
        farm = _claimed_farm(connection, gateway_id)
        if farm is None:
            return
        node = connection.execute("SELECT farm_id FROM nodes WHERE id = ?", (node_id,)).fetchone()
        if node is None:
            insert_node(
                connection, node_id, farm["id"], default_node_name(node_id), gateway_id=gateway_id
            )
        elif node["farm_id"] != farm["id"]:
            logger.warning("Node %s sudah terdaftar di kebun lain, reading diabaikan.", node_id)
            return
        _, decision = apply_reading(connection, node_id, farm, payload, weather)
        node = row_to_dict(
            connection.execute("SELECT * FROM nodes WHERE id = ?", (node_id,)).fetchone()
        )
        # Posisi valve yang dilaporkan sama dengan perintah = perintah sudah sampai ke alat.
        # Berbeda setelah sempat sama (mis. node mati lalu hidup lagi) = belum sampai lagi.
        delivered = node["valve_command"] == payload.valve
        if node["valve_command"] is not None and delivered != (node["valve_command_sent_at"] is not None):
            connection.execute(
                "UPDATE nodes SET valve_command_sent_at = CASE WHEN ? THEN CURRENT_TIMESTAMP END WHERE id = ?",
                (delivered, node_id),
            )
        _touch_gateway(connection, gateway_id)
    target = valve_target(node, decision)
    last = _last_published.get(node_id)
    # Alat masih melapor posisi lain lama setelah perintah dikirim (mis. retain hilang dari broker): kirim ulang.
    resend = (
        payload.valve != target["state"]
        and last is not None
        and time.monotonic() - last[1] >= settings.valve_resend_minutes * 60
    )
    publish_valve(gateway_id, node_id, target, resend=resend)


def valve_target(node: dict, decision: dict) -> dict:
    """Isi pesan valve/set dari keputusan node. Valve buka selalu membawa jam tutup (until)."""
    if decision["valve_state"] != "open":
        return {"state": "closed"}
    if decision["type"] == "manual_open":
        started, minutes = node["valve_command_at"], settings.manual_irrigation_max_minutes
    else:
        started, minutes = node["auto_pulse_started_at"], settings.auto_pulse_minutes
    start_at = _parse_db_time(started) or datetime.now(timezone.utc)
    return {"state": "open", "until": int((start_at + timedelta(minutes=minutes)).timestamp())}


def publish_valve(gateway_id: str, node_id: str, command: dict, *, resend: bool = False) -> None:
    """Kirim valve/set (retain) hanya kalau isinya berubah dari kiriman terakhir, atau resend=True."""
    if _client is None:
        return
    # ID dari luar kontrak (mis. diklaim lewat web) bisa berisi karakter yang dilarang di topik.
    if not (_DEVICE_ID.fullmatch(gateway_id) and _DEVICE_ID.fullmatch(node_id)):
        return
    body = json.dumps(command, separators=(",", ":"))
    last = _last_published.get(node_id)
    if not resend and last is not None and last[0] == body:
        return
    result = _client.publish(
        f"{TOPIC_ROOT}/{gateway_id}/node/{node_id}/valve/set", body, qos=1, retain=True
    )
    if result.rc == mqtt.MQTT_ERR_SUCCESS:
        _last_published[node_id] = (body, time.monotonic())
    else:
        logger.warning("Perintah valve node %s gagal dikirim (rc=%s).", node_id, result.rc)


def farm_valve_nodes(connection, farm_id: str) -> tuple[str | None, list[str]]:
    """Gateway dan node kebun, diambil sebelum kebun dihapus atau gateway dilepas."""
    gateway = connection.execute(
        "SELECT device_id FROM gateways WHERE farm_id = ?", (farm_id,)
    ).fetchone()
    node_ids = [
        row["id"] for row in connection.execute("SELECT id FROM nodes WHERE farm_id = ?", (farm_id,))
    ]
    return (gateway["device_id"] if gateway else None), node_ids


def clear_valves(gateway_id: str | None, node_ids: list[str]) -> None:
    """Hapus perintah valve retain di broker. Isi kosong = tidak ada perintah, gateway menutup valve."""
    for node_id in node_ids:
        _last_published.pop(node_id, None)
    if _client is None or gateway_id is None or not _DEVICE_ID.fullmatch(gateway_id):
        return
    for node_id in node_ids:
        if not _DEVICE_ID.fullmatch(node_id):
            continue
        result = _client.publish(
            f"{TOPIC_ROOT}/{gateway_id}/node/{node_id}/valve/set", b"", qos=1, retain=True
        )
        if result.rc != mqtt.MQTT_ERR_SUCCESS:
            logger.warning("Perintah valve node %s gagal dihapus (rc=%s).", node_id, result.rc)


def publish_farm_valves(farm_id: str) -> None:
    """Kirim perintah manual semua node kebun. Dipanggil route valve setelah transaksinya selesai."""
    if _client is None:
        return
    with get_connection() as connection:
        gateway = connection.execute(
            "SELECT device_id FROM gateways WHERE farm_id = ?", (farm_id,)
        ).fetchone()
        nodes = [
            row_to_dict(row)
            for row in connection.execute("SELECT * FROM nodes WHERE farm_id = ?", (farm_id,))
        ]
    if gateway is None:
        return
    for node in nodes:
        # Mode otomatis tidak punya perintah tersimpan; keputusannya dikirim saat reading masuk.
        if node["valve_command"] is not None:
            publish_valve(gateway["device_id"], node["id"], valve_target(node, manual_decision(node)))
