"""Route gateway: klaim/lepas perangkat, registrasi node batch, dan log koneksi."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from .. import mqtt_bridge
from ..auth import get_current_user
from ..database import get_connection, row_to_dict
from ..deps import get_farm_for_gateway_action, get_farm_owned
from ..gateway_service import (
    claim_gateway_for_farm,
    ensure_gateway_unclaimed,
    gateway_link_state,
    release_gateway,
)
from ..node_service import insert_node
from ..schemas import (
    GatewayClaimPayload,
    GatewayLogIn,
    GatewayRegisterPayload,
    GatewayRegisterResponse,
    RegisteredNode,
)

router = APIRouter()

# Belum ada integrasi hardware gateway, jadi gateway_logs kosong sampai perangkat
# melapor lewat POST di bawah. Frontend harus menampilkan empty state jujur.


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


@router.post("/api/farms/{farm_id}/gateway-logs", status_code=201)
def create_gateway_log(
    farm_id: str,
    payload: GatewayLogIn,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    with get_connection() as connection:
        get_farm_owned(connection, farm_id, current_user["id"])
        cursor = connection.execute(
            "INSERT INTO gateway_logs (farm_id, event, detail) VALUES (?, ?, ?)",
            (farm_id, payload.event.strip(), payload.detail.strip()),
        )
        log = row_to_dict(
            connection.execute(
                "SELECT * FROM gateway_logs WHERE id = ?", (cursor.lastrowid,)
            ).fetchone()
        )
    return {"log": log}


@router.get("/api/farms/{farm_id}/gateway")
def get_farm_gateway(
    farm_id: str,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    with get_connection() as connection:
        get_farm_for_gateway_action(connection, farm_id, current_user["id"])
        gateway = row_to_dict(
            connection.execute(
                "SELECT * FROM gateways WHERE farm_id = ?",
                (farm_id,),
            ).fetchone()
        )
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
        get_farm_for_gateway_action(connection, farm_id, current_user["id"])

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
        get_farm_for_gateway_action(connection, farm_id, current_user["id"])
        gateway = row_to_dict(
            connection.execute(
                "SELECT * FROM gateways WHERE farm_id = ?",
                (farm_id,),
            ).fetchone()
        )
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
        get_farm_for_gateway_action(connection, farm_id, current_user["id"])
        gateway = row_to_dict(
            connection.execute("SELECT * FROM gateways WHERE farm_id = ?", (farm_id,)).fetchone()
        )
        if gateway is None:
            raise HTTPException(status_code=404, detail="Kebun ini belum punya gateway")
        seen, cut = gateway_link_state(connection, farm_id)
        if not seen or cut:
            raise HTTPException(status_code=409, detail="Gateway sedang offline, perintah tidak bisa dikirim")
    if not mqtt_bridge.publish_gateway_command(gateway["device_id"], "wifi_portal"):
        raise HTTPException(status_code=503, detail="Perintah gagal dikirim ke gateway, coba lagi sebentar lagi")
    with get_connection() as connection:
        connection.execute(
            "INSERT INTO gateway_logs (farm_id, event, detail) VALUES (?, ?, ?)",
            (farm_id, "wifi_portal", "Ganti WiFi diminta dari web"),
        )
    return {"gateway": gateway}


@router.post("/api/gateways/{gateway_id}/register", status_code=200)
def gateway_register_nodes(
    gateway_id: str,
    payload: GatewayRegisterPayload,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> GatewayRegisterResponse:
    """Dipanggil firmware gateway saat terhubung, membawa daftar semua node yang dikelolanya."""
    registered_nodes = []

    with get_connection() as connection:
        get_farm_owned(connection, payload.farm_id, current_user["id"])

        gateway = row_to_dict(
            connection.execute(
                "SELECT * FROM gateways WHERE device_id = ?",
                (gateway_id,),
            ).fetchone()
        )
        if gateway is None:
            raise HTTPException(status_code=404, detail="Gateway belum terdaftar")
        if gateway.get("farm_id") is None:
            raise HTTPException(status_code=409, detail="Gateway belum terhubung ke kebun")
        if gateway["farm_id"] != payload.farm_id:
            raise HTTPException(status_code=403, detail="Gateway tidak terhubung ke kebun ini")

        connection.execute(
            "UPDATE gateways SET last_seen_at = CURRENT_TIMESTAMP WHERE device_id = ?",
            (gateway_id,),
        )

        for node_item in payload.nodes:
            existing = row_to_dict(connection.execute(
                "SELECT * FROM nodes WHERE id = ?", (node_item.node_id,)
            ).fetchone())

            if existing:
                if existing.get("farm_id") != payload.farm_id:
                    raise HTTPException(
                        status_code=409,
                        detail="Node sudah terdaftar di kebun lain",
                    )
                connection.execute(
                    """UPDATE nodes
                       SET gateway_id = ?,
                           last_seen_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                       WHERE id = ?""",
                    (gateway_id, node_item.node_id)
                )
                registered_nodes.append(RegisteredNode(
                    id=node_item.node_id,
                    name=node_item.name,
                    status="active",
                    created=False
                ))
            else:
                insert_node(
                    connection,
                    node_item.node_id,
                    payload.farm_id,
                    node_item.name,
                    gateway_id=gateway_id,
                    location=node_item.region,
                    region=node_item.region,
                    latitude=node_item.latitude,
                    longitude=node_item.longitude,
                )
                registered_nodes.append(RegisteredNode(
                    id=node_item.node_id,
                    name=node_item.name,
                    status="pending",
                    created=True
                ))

    return GatewayRegisterResponse(
        gateway_id=gateway_id,
        farm_id=payload.farm_id,
        status="registered",
        nodes=registered_nodes,
        created_count=sum(1 for n in registered_nodes if n.created)
    )
