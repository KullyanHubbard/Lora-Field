"""Route /api/farms: CRUD kebun plus ringkasan dan cuaca per kebun."""

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from .. import mqtt_bridge
from ..adm4 import ensure_farm_bmkg_adm4, resolve_bmkg_adm4
from ..auth import get_current_user
from ..bmkg import get_weather_for_decision
from ..database import get_connection, row_to_dict
from ..deps import get_farm_owned
from ..gateway_service import (
    claim_gateway_for_farm,
    ensure_gateway_unclaimed,
    gateway_link_state,
    release_gateway,
)
from ..crops import find_crop_thresholds
from ..irrigation import (
    DISCONNECTED_DECISION,
    auto_decision,
    effective_rain_next_3h,
    farm_thresholds,
    manual_decision,
)
from ..limited_irrigation import decision_thresholds, expire_limited_irrigation
from ..node_service import present_node
from ..schemas import FarmCreate, FarmUpdate
from ..valve_control import expire_manual_valves

router = APIRouter()

UNKNOWN_CROP_DETAIL = "Jenis tanaman wajib dipilih dari daftar tanaman."
CROP_LOCKED_DETAIL = "Jenis tanaman kebun tidak bisa diganti. Buat kebun baru untuk tanaman lain."


@router.get("/api/farms")
def list_farms(current_user: Annotated[dict, Depends(get_current_user)]) -> dict:
    with get_connection() as connection:
        farms = [
            dict(row)
            for row in connection.execute(
                "SELECT * FROM farms WHERE user_id = ? ORDER BY name",
                (current_user["id"],),
            ).fetchall()
        ]
    return {"items": farms, "total": len(farms)}


@router.get("/api/farms/{farm_id}")
def get_farm(
    farm_id: str,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    with get_connection() as connection:
        farm = get_farm_owned(connection, farm_id, current_user["id"])
    return {"farm": farm}


@router.patch("/api/farms/{farm_id}")
def update_farm(
    farm_id: str,
    payload: FarmUpdate,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    updates = payload.model_dump(exclude_unset=True)

    with get_connection() as connection:
        current_farm = get_farm_owned(connection, farm_id, current_user["id"])
        if not updates:
            return {"farm": current_farm}

        if updates.get("name") is None and "name" in updates:
            raise HTTPException(status_code=422, detail="Nama kebun tidak boleh kosong.")
        if updates.get("ground_cover") is None and "ground_cover" in updates:
            raise HTTPException(status_code=422, detail="Penutup tanah tidak boleh kosong.")

        for field in ("name", "owner", "location", "crop_type", "bmkg_adm4_code", "status"):
            if isinstance(updates.get(field), str):
                updates[field] = updates[field].strip()
            elif updates.get(field) is None and field in updates:
                updates[field] = "" if field != "status" else (current_farm.get("status") or "active")
        if updates.get("name") == "":
            raise HTTPException(status_code=422, detail="Nama kebun tidak boleh kosong.")
        # Satu kebun satu tanaman: jenis tanaman hanya diisi saat kebun dibuat. Nilai yang sama diterima.
        if "crop_type" in updates:
            if updates.pop("crop_type").lower() != (current_farm.get("crop_type") or "").strip().lower():
                raise HTTPException(status_code=422, detail=CROP_LOCKED_DETAIL)

        lat = updates.get("latitude", current_farm.get("latitude"))
        lng = updates.get("longitude", current_farm.get("longitude"))
        coords_changed = "latitude" in updates or "longitude" in updates
        adm4_empty = not (updates.get("bmkg_adm4_code") or current_farm.get("bmkg_adm4_code"))
        if (coords_changed or adm4_empty) and not updates.get("bmkg_adm4_code") and lat is not None and lng is not None:
            location_hint = updates.get("location") or current_farm.get("location") or ""
            updates["bmkg_adm4_code"] = resolve_bmkg_adm4(lat, lng, location_hint)

        allowed_columns = {
            "name",
            "owner",
            "location",
            "area_ha",
            "bmkg_adm4_code",
            "latitude",
            "longitude",
            "status",
            "ground_cover",
        }
        assignments = [f"{column} = ?" for column in updates if column in allowed_columns]
        values = [updates[column] for column in updates if column in allowed_columns]
        if assignments:
            assignments.append("updated_at = CURRENT_TIMESTAMP")
            connection.execute(
                f"UPDATE farms SET {', '.join(assignments)} WHERE id = ? AND user_id = ?",
                (*values, farm_id, current_user["id"]),
            )

        farm = row_to_dict(
            connection.execute("SELECT * FROM farms WHERE id = ?", (farm_id,)).fetchone()
        )
    return {"farm": farm}


@router.delete("/api/farms/{farm_id}", status_code=200)
def delete_farm(
    farm_id: str,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    with get_connection() as connection:
        get_farm_owned(connection, farm_id, current_user["id"])
        gateway_id, node_ids = mqtt_bridge.farm_valve_nodes(connection, farm_id)
        release_gateway(connection, farm_id)
        # Tabel anak tidak punya ON DELETE CASCADE sementara PRAGMA foreign_keys aktif.
        connection.execute(
            "DELETE FROM decision_logs WHERE node_id IN (SELECT id FROM nodes WHERE farm_id = ?)",
            (farm_id,),
        )
        connection.execute(
            """
            DELETE FROM readings
            WHERE farm_id = ?
               OR node_id IN (SELECT id FROM nodes WHERE farm_id = ?)
            """,
            (farm_id, farm_id),
        )
        connection.execute("DELETE FROM nodes WHERE farm_id = ?", (farm_id,))
        connection.execute("DELETE FROM gateway_logs WHERE farm_id = ?", (farm_id,))
        connection.execute("DELETE FROM farms WHERE id = ?", (farm_id,))
    # Setelah transaksi: gateway tidak boleh menjalankan perintah valve kebun yang sudah tidak ada.
    mqtt_bridge.clear_valves(gateway_id, node_ids)
    return {"message": "Kebun berhasil dihapus."}


@router.post("/api/farms", status_code=201)
def create_farm(
    payload: FarmCreate,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    adm4 = payload.bmkg_adm4_code
    if not adm4 and payload.latitude is not None and payload.longitude is not None:
        # Kalau gagal, kebun tetap dibuat dengan kode BMKG kosong; ensure_farm_bmkg_adm4()
        # mencoba lagi setiap summary atau cuaca kebun dimuat.
        adm4 = resolve_bmkg_adm4(payload.latitude, payload.longitude, payload.location)

    gateway_device_id = payload.gateway_device_id.strip()
    gateway_display_name = payload.gateway_display_name.strip()
    if not gateway_device_id:
        raise HTTPException(status_code=422, detail="Gateway wajib dipilih.")

    crop_thresholds = find_crop_thresholds(payload.crop_type)
    if crop_thresholds is None:
        raise HTTPException(status_code=422, detail=UNKNOWN_CROP_DETAIL)

    farm_id = f"farm-{uuid.uuid4().hex[:8]}"
    with get_connection() as connection:
        ensure_gateway_unclaimed(connection, gateway_device_id)

        connection.execute(
            """
            INSERT INTO farms
                (id, user_id, name, owner, location, crop_type, area_ha,
                 bmkg_adm4_code, latitude, longitude, lower_threshold, upper_threshold,
                 ground_cover, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
            """,
            (
                farm_id,
                current_user["id"],
                payload.name,
                payload.owner,
                payload.location,
                payload.crop_type,
                payload.area_ha,
                adm4,
                payload.latitude,
                payload.longitude,
                crop_thresholds.lower,
                crop_thresholds.upper,
                payload.ground_cover,
            ),
        )
        gateway = claim_gateway_for_farm(
            connection, gateway_device_id, gateway_display_name, farm_id
        )
        farm = row_to_dict(
            connection.execute("SELECT * FROM farms WHERE id = ?", (farm_id,)).fetchone()
        )
    return {"farm": farm, "gateway": gateway}


@router.get("/api/farms/{farm_id}/weather")
def get_farm_weather(
    farm_id: str,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    with get_connection() as connection:
        farm = get_farm_owned(connection, farm_id, current_user["id"])
    farm = ensure_farm_bmkg_adm4(farm)
    if not farm.get("bmkg_adm4_code"):
        raise HTTPException(status_code=422, detail="Kode BMKG kebun belum tersedia.")
    weather = get_weather_for_decision(farm["bmkg_adm4_code"])
    if weather is None:
        raise HTTPException(status_code=502, detail="Gagal mengambil data cuaca dari BMKG")
    return weather


def _farm_weather_or_none(farm: dict) -> dict | None:
    """Cuaca untuk summary: kode BMKG kosong atau cuaca tidak tersedia jadi None."""
    if not farm.get("bmkg_adm4_code"):
        return None
    return get_weather_for_decision(farm["bmkg_adm4_code"])


@router.get("/api/farms/{farm_id}/summary")
def get_farm_summary(
    farm_id: str,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    now = datetime.now(timezone.utc)
    with get_connection() as connection:
        farm = expire_limited_irrigation(
            connection, get_farm_owned(connection, farm_id, current_user["id"]), now
        )
        expire_manual_valves(connection, farm_id)
        nodes = [
            present_node(dict(row))
            for row in connection.execute(
                "SELECT * FROM nodes WHERE farm_id = ? ORDER BY id",
                (farm_id,),
            ).fetchall()
        ]
        gateway_seen, gateway_cut = gateway_link_state(connection, farm_id)
        latest_by_node = {
            row["node_id"]: dict(row)
            for row in connection.execute(
                """
                SELECT r.* FROM nodes n
                JOIN readings r ON r.id = (
                    SELECT r2.id FROM readings r2
                    WHERE r2.node_id = n.id
                    ORDER BY r2.created_at DESC, r2.id DESC
                    LIMIT 1
                )
                WHERE n.farm_id = ?
                """,
                (farm_id,),
            ).fetchall()
        }

    farm = ensure_farm_bmkg_adm4(farm)
    weather = _farm_weather_or_none(farm)
    rain_next_3h = effective_rain_next_3h(farm, weather)
    thresholds = farm_thresholds(farm)
    auto_thresholds = decision_thresholds(farm, now)

    node_summaries = []
    for node in nodes:
        reading = latest_by_node.get(node["id"])
        if node["status"] == "offline":
            decision = dict(DISCONNECTED_DECISION)
        elif farm.get("irrigation_mode") == "manual":
            decision = manual_decision(node)
        elif reading:
            # Ringkasan menunggu reading baru sebelum memulai pulsa berikutnya atau menjeda node.
            decision, _ = auto_decision(
                reading["soil_moisture"],
                rain_next_3h,
                auto_thresholds,
                node,
                now,
                advance_after_soak=False,
            )
        else:
            decision = None
        node_summaries.append({"node": node, "latest_reading": reading, "decision": decision})

    moistures = [
        ns["latest_reading"]["soil_moisture"]
        for ns in node_summaries
        if ns["latest_reading"] is not None
    ]
    avg_moisture = round(sum(moistures) / len(moistures), 2) if moistures else None

    nodes_online = [n for n in nodes if n["status"] == "online"]
    nodes_problem = [n for n in nodes if n["status"] == "offline"]
    gateway_status = "online" if (nodes_online or gateway_seen) and not gateway_cut else "offline"

    return {
        "farm": farm,
        "weather": weather,
        "thresholds": thresholds.model_dump(),
        "gateway_status": gateway_status,
        "average_soil_moisture": avg_moisture,
        "nodes_total": len(nodes),
        "nodes_online": len(nodes_online),
        "nodes_problem": len(nodes_problem),
        "nodes": node_summaries,
    }
