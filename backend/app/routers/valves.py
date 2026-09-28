"""Route kendali valve: ganti mode otomatis/manual, jalankan/hentikan pengairan, dan valve per node."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from .. import mqtt_bridge
from ..auth import get_current_user
from ..database import get_connection, row_to_dict
from ..deps import get_farm_owned, get_node_owned
from ..schemas import IrrigationModeUpdate, ValveCommandUpdate
from ..valve_control import (
    expire_manual_valves,
    farm_nodes,
    is_saturated,
    latest_soil_moisture,
    require_manual_mode,
    set_valve_command,
)

router = APIRouter()


@router.patch("/api/farms/{farm_id}/irrigation-mode")
def update_irrigation_mode(
    farm_id: str,
    payload: IrrigationModeUpdate,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    with get_connection() as connection:
        farm = get_farm_owned(connection, farm_id, current_user["id"])
        if not any(node["status"] == "online" for node in farm_nodes(connection, farm_id)):
            raise HTTPException(
                status_code=409,
                detail="Semua node offline. Mode valve tidak bisa diganti saat kebun terputus.",
            )
        if payload.mode != farm.get("irrigation_mode"):
            # Mode manual mulai dengan semua valve tertutup; pengguna yang menjalankan pengairan.
            command = "closed" if payload.mode == "manual" else None
            connection.execute(
                """
                UPDATE nodes
                SET valve_command = ?,
                    valve_command_at = CASE WHEN ? IS NULL THEN NULL ELSE CURRENT_TIMESTAMP END,
                    valve_command_sent_at = NULL,
                    auto_pulse_count = 0,
                    auto_pulse_started_at = NULL,
                    auto_limit_at = NULL
                WHERE farm_id = ?
                """,
                (command, command, farm_id),
            )
            connection.execute(
                "UPDATE farms SET irrigation_mode = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (payload.mode, farm_id),
            )
        farm = row_to_dict(
            connection.execute("SELECT * FROM farms WHERE id = ?", (farm_id,)).fetchone()
        )
    mqtt_bridge.publish_farm_valves(farm_id)
    return {"farm": farm}


@router.post("/api/farms/{farm_id}/irrigation/start")
def start_irrigation(
    farm_id: str,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    """Buka valve semua node online yang sudah punya data sensor."""
    with get_connection() as connection:
        farm = get_farm_owned(connection, farm_id, current_user["id"])
        require_manual_mode(farm)
        expire_manual_valves(connection, farm_id)
        nodes = farm_nodes(connection, farm_id)
        moisture = {node["id"]: latest_soil_moisture(connection, node["id"]) for node in nodes}
        ready = [node for node in nodes if node["status"] == "online" and moisture[node["id"]] is not None]
        # Node yang tanahnya jenuh dilewati; valve node lain tetap dibuka.
        controllable = [node for node in ready if not is_saturated(moisture[node["id"]])]
        if not controllable:
            detail = (
                "Tanah semua node sudah jenuh, pengairan tidak dijalankan."
                if ready
                else "Tidak ada node online yang valve-nya bisa dibuka."
            )
            raise HTTPException(status_code=409, detail=detail)
        for node in controllable:
            set_valve_command(connection, node, open_valve=True)
        nodes = farm_nodes(connection, farm_id)
    mqtt_bridge.publish_farm_valves(farm_id)
    return {"nodes": nodes}


@router.post("/api/farms/{farm_id}/irrigation/stop")
def stop_irrigation(
    farm_id: str,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    """Tutup semua valve yang terbuka, termasuk node offline, supaya tertutup saat tersambung lagi."""
    with get_connection() as connection:
        farm = get_farm_owned(connection, farm_id, current_user["id"])
        require_manual_mode(farm)
        expire_manual_valves(connection, farm_id)
        for node in farm_nodes(connection, farm_id):
            set_valve_command(connection, node, open_valve=False)
        nodes = farm_nodes(connection, farm_id)
    mqtt_bridge.publish_farm_valves(farm_id)
    return {"nodes": nodes}


@router.patch("/api/nodes/{node_id}/valve")
def update_node_valve(
    node_id: str,
    payload: ValveCommandUpdate,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    with get_connection() as connection:
        farm_id = get_node_owned(connection, node_id, current_user["id"])["farm_id"]
        farm = get_farm_owned(connection, farm_id, current_user["id"])
        require_manual_mode(farm)
        expire_manual_valves(connection, farm_id)
        node = next(n for n in farm_nodes(connection, farm_id) if n["id"] == node_id)
        set_valve_command(connection, node, open_valve=payload.open)
        node = next(n for n in farm_nodes(connection, farm_id) if n["id"] == node_id)
    mqtt_bridge.publish_farm_valves(farm_id)
    return {"node": node}
