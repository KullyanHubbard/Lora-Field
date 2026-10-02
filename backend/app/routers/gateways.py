"""Route gateway: klaim/lepas perangkat, Ganti WiFi, dan log koneksi (diisi jembatan MQTT)."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from .. import mqtt_bridge
from ..auth import get_current_user
from ..database import get_connection, row_to_dict
from ..deps import get_farm_owned
from ..gateway_service import (
    claim_gateway_for_farm,
    ensure_gateway_unclaimed,
    farm_gateway,
    gateway_online,
    release_gateway,
)
from ..schemas import GatewayClaimPayload

router = APIRouter()


@router.get("/api/farms/{farm_id}/gateway-logs")
def list_gateway_logs(
    farm_id: str,
    current_user: Annotated[dict, Depends(get_current_user)],
    limit: int = Query(default=20, ge=1, le=100),
) -> dict:
    with get_connection() as connection:
        get_farm_owned(connection, farm_id, current_user["id"])
        rows = connection.execute(
            """
            SELECT * FROM gateway_logs
            WHERE farm_id = ?
            ORDER BY created_at DESC, id DESC
            LIMIT ?
            """,
            (farm_id, limit),
        ).fetchall()
    items = [dict(row) for row in rows]
    return {"items": items, "total": len(items)}


@router.get("/api/farms/{farm_id}/gateway")
def get_farm_gateway(
    farm_id: str,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    with get_connection() as connection:
        get_farm_owned(connection, farm_id, current_user["id"])
        gateway = farm_gateway(connection, farm_id)
    return {"gateway": gateway}


@router.post("/api/farms/{farm_id}/gateway/claim")
def claim_farm_gateway(
    farm_id: str,
    payload: GatewayClaimPayload,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    device_id = payload.device_id.strip()
    display_name = payload.display_name.strip()
    if not device_id:
        raise HTTPException(status_code=422, detail="device_id wajib diisi")

    with get_connection() as connection:
        get_farm_owned(connection, farm_id, current_user["id"])

        ensure_gateway_unclaimed(connection, device_id)
        # Kebun yang sudah punya gateway ditolak 409 di sini lewat UNIQUE gateways.farm_id.
        gateway = claim_gateway_for_farm(connection, device_id, display_name, farm_id)

    return {"gateway": gateway}


@router.post("/api/farms/{farm_id}/gateway/unclaim")
def unclaim_farm_gateway(
    farm_id: str,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    with get_connection() as connection:
        get_farm_owned(connection, farm_id, current_user["id"])
        gateway = farm_gateway(connection, farm_id)
        if gateway is None:
            raise HTTPException(status_code=404, detail="Kebun ini belum punya gateway")

        _, node_ids = mqtt_bridge.farm_valve_nodes(connection, farm_id)
        release_gateway(connection, farm_id)
        unclaimed_gateway = row_to_dict(
            connection.execute(
                "SELECT * FROM gateways WHERE device_id = ?",
                (gateway["device_id"],),
            ).fetchone()
        )
    # Setelah transaksi: gateway yang dilepas tidak boleh menjalankan perintah valve lama kebun ini.
    mqtt_bridge.clear_valves(gateway["device_id"], node_ids)
    return {"gateway": unclaimed_gateway}


@router.post("/api/farms/{farm_id}/gateway/wifi-portal")
def request_gateway_wifi_portal(
    farm_id: str,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    """Tombol "Ganti WiFi" di web: gateway membuka portal WiFi (docs/kontrak-mqtt.md, topik cmd).
    WiFi lama tetap tersimpan sebagai cadangan kalau tidak ada WiFi baru yang disimpan."""
    with get_connection() as connection:
        get_farm_owned(connection, farm_id, current_user["id"])
        gateway = farm_gateway(connection, farm_id)
        if gateway is None:
            raise HTTPException(status_code=404, detail="Kebun ini belum punya gateway")
        if not gateway_online(connection, farm_id):
            raise HTTPException(status_code=409, detail="Gateway sedang offline, perintah tidak bisa dikirim")
    if not mqtt_bridge.publish_gateway_command(gateway["device_id"], "wifi_portal"):
        raise HTTPException(status_code=503, detail="Perintah gagal dikirim ke gateway, coba lagi sebentar lagi")
    with get_connection() as connection:
        connection.execute(
            "INSERT INTO gateway_logs (farm_id, event, detail) VALUES (?, ?, ?)",
            (farm_id, "wifi_portal", "Ganti WiFi diminta dari web"),
        )
    return {"gateway": gateway}
