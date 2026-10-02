"""Route kendali valve: ganti mode otomatis/manual, jalankan/hentikan pengairan, valve per node, dan
Irigasi Terbatas."""

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from .. import mqtt_bridge
from ..auth import get_current_user
from ..database import get_connection, row_to_dict
from ..deps import get_farm_owned, get_node_owned
from ..limited_irrigation import (
    expire_limited_irrigation,
    limited_until_text,
    log_limited_event,
    require_limited_active,
    require_limited_available,
)
from ..node_service import present_node
from ..schemas import (
    IrrigationModeUpdate,
    LimitedIrrigationStart,
    LimitedIrrigationUpdate,
    ValveCommandUpdate,
)
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
                    auto_limit_at = NULL,
                    auto_cycle_baseline = NULL,
                    auto_confirmed_pulse_count = 0
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
        _, farm = get_node_owned(connection, node_id, current_user["id"])
        farm_id = farm["id"]
        require_manual_mode(farm)
        expire_manual_valves(connection, farm_id)
        node = next(n for n in farm_nodes(connection, farm_id) if n["id"] == node_id)
        set_valve_command(connection, node, open_valve=payload.open)
        node = next(n for n in farm_nodes(connection, farm_id) if n["id"] == node_id)
    mqtt_bridge.publish_farm_valves(farm_id)
    return {"node": node}


@router.post("/api/nodes/{node_id}/irrigation/resume")
def resume_auto_irrigation(
    node_id: str,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    with get_connection() as connection:
        node, farm = get_node_owned(connection, node_id, current_user["id"])
        if farm["irrigation_mode"] != "auto":
            raise HTTPException(status_code=409, detail="Kebun sedang mode manual.")
        if node["auto_paused_at"]:
            connection.execute(
                """
                UPDATE nodes
                SET auto_paused_at = NULL,
                    auto_pulse_count = 0,
                    auto_pulse_started_at = NULL,
                    auto_cycle_baseline = NULL,
                    auto_confirmed_pulse_count = 0,
                    auto_limit_at = NULL
                WHERE id = ?
                """,
                (node_id,),
            )
            node = row_to_dict(
                connection.execute("SELECT * FROM nodes WHERE id = ?", (node_id,)).fetchone()
            )
    return {"node": present_node(node)}


def _read_farm(connection, farm_id: str) -> dict:
    return row_to_dict(connection.execute("SELECT * FROM farms WHERE id = ?", (farm_id,)).fetchone())


@router.post("/api/farms/{farm_id}/limited-irrigation")
def start_limited_irrigation(
    farm_id: str,
    payload: LimitedIrrigationStart,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    now = datetime.now(timezone.utc)
    with get_connection() as connection:
        # Kunci tulis sejak awal: cek status dan ubahnya satu operasi, permintaan bersamaan antre.
        connection.execute("BEGIN IMMEDIATE")
        farm = expire_limited_irrigation(
            connection, get_farm_owned(connection, farm_id, current_user["id"]), now
        )
        require_limited_available(farm)
        until = limited_until_text(payload.until, now)
        connection.execute(
            "UPDATE farms SET limited_until = ?, limited_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (until, payload.reason, farm_id),
        )
        log_limited_event(connection, farm_id, "limited_started", until=until, reason=payload.reason)
        farm = _read_farm(connection, farm_id)
    return {"farm": farm}


@router.patch("/api/farms/{farm_id}/limited-irrigation")
def update_limited_irrigation(
    farm_id: str,
    payload: LimitedIrrigationUpdate,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    """Ubah tanggal selesai. Boleh di mode apa pun, karena Irigasi Terbatas tetap berjalan saat manual."""
    now = datetime.now(timezone.utc)
    with get_connection() as connection:
        # Kunci tulis sejak awal: cek status dan ubahnya satu operasi, permintaan bersamaan antre.
        connection.execute("BEGIN IMMEDIATE")
        farm = expire_limited_irrigation(
            connection, get_farm_owned(connection, farm_id, current_user["id"]), now
        )
        require_limited_active(farm)
        until = limited_until_text(payload.until, now)
        if until != farm["limited_until"]:
            connection.execute(
                "UPDATE farms SET limited_until = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (until, farm_id),
            )
            log_limited_event(
                connection, farm_id, "limited_changed", until=until, reason=farm["limited_reason"]
            )
        farm = _read_farm(connection, farm_id)
    return {"farm": farm}


@router.delete("/api/farms/{farm_id}/limited-irrigation")
def stop_limited_irrigation(
    farm_id: str,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    now = datetime.now(timezone.utc)
    with get_connection() as connection:
        # Kunci tulis sejak awal: cek status dan ubahnya satu operasi, permintaan bersamaan antre.
        connection.execute("BEGIN IMMEDIATE")
        farm = expire_limited_irrigation(
            connection, get_farm_owned(connection, farm_id, current_user["id"]), now
        )
        require_limited_active(farm)
        connection.execute(
            """
            UPDATE farms
            SET limited_until = NULL, limited_reason = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (farm_id,),
        )
        log_limited_event(
            connection, farm_id, "limited_stopped", until=farm["limited_until"], reason=farm["limited_reason"]
        )
        farm = _read_farm(connection, farm_id)
    return {"farm": farm}
