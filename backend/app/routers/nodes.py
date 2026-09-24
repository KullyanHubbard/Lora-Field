"""Route /api/nodes: daftar node, update lokasi, dan pembacaan sensor."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from ..auth import get_current_user
from ..bmkg import fetch_weather_with_cache
from ..database import get_connection, row_to_dict
from ..deps import get_farm_owned, get_node_owned
from ..irrigation import calculate_decision
from ..node_service import insert_node, record_reading
from ..schemas import NodeLocationUpdate, SensorReadingIn

router = APIRouter()


@router.get("/api/nodes")
def list_nodes(
    current_user: Annotated[dict, Depends(get_current_user)],
    farm_id: str | None = Query(default=None, description="Filter node berdasarkan kebun"),
) -> dict:
    with get_connection() as connection:
        if farm_id is not None:
            get_farm_owned(connection, farm_id, current_user["id"])
            nodes = [
                dict(row)
                for row in connection.execute(
                    "SELECT * FROM nodes WHERE farm_id = ? ORDER BY id",
                    (farm_id,),
                ).fetchall()
            ]
        else:
            nodes = [
                dict(row)
                for row in connection.execute(
                    """
                    SELECT n.* FROM nodes n
                    JOIN farms f ON f.id = n.farm_id
                    WHERE f.user_id = ?
                    ORDER BY n.id
                    """,
                    (current_user["id"],),
                ).fetchall()
            ]
    return {"items": nodes, "total": len(nodes)}


@router.patch("/api/nodes/{node_id}/location")
def update_node_location(
    node_id: str,
    payload: NodeLocationUpdate,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    with get_connection() as connection:
        get_node_owned(connection, node_id, current_user["id"])
        connection.execute(
            """
            UPDATE nodes
            SET location = ?,
                region = ?,
                latitude = ?,
                longitude = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (
                payload.location,
                payload.region,
                payload.latitude,
                payload.longitude,
                node_id,
            ),
        )
        node = row_to_dict(
            connection.execute("SELECT * FROM nodes WHERE id = ?", (node_id,)).fetchone()
        )
    return {"node": node}


@router.get("/api/nodes/{node_id}/readings")
def list_readings(
    node_id: str,
    current_user: Annotated[dict, Depends(get_current_user)],
    limit: int = Query(default=20, ge=1, le=100),
) -> dict:
    with get_connection() as connection:
        get_node_owned(connection, node_id, current_user["id"])
        rows = connection.execute(
            """
            SELECT * FROM readings
            WHERE node_id = ?
            ORDER BY created_at DESC, id DESC
            LIMIT ?
            """,
            (node_id, limit),
        ).fetchall()
    return {"items": [dict(row) for row in rows]}


@router.post("/api/nodes/{node_id}/readings", status_code=201)
def create_reading(
    node_id: str,
    payload: SensorReadingIn,
    current_user: Annotated[dict, Depends(get_current_user)],
    adm4: str = Query(..., min_length=2, description="Kode wilayah adm4 BMKG"),
) -> dict:
    # Node yang belum terdaftar dibuat di sini, dipakai firmware yang langsung kirim
    # reading tanpa registrasi lewat gateway.
    node_created = False

    with get_connection() as connection:
        node_exists = connection.execute(
            "SELECT 1 FROM nodes WHERE id = ?", (node_id,)
        ).fetchone()

        if not node_exists:
            farm_id = payload.farm_id

            if not farm_id:
                raise HTTPException(
                    status_code=400,
                    detail="farm_id wajib diisi untuk registrasi node pertama kali"
                )

            get_farm_owned(connection, farm_id, current_user["id"])
            insert_node(connection, node_id, farm_id, f"Node {node_id[:8]}")
            node_created = True
        else:
            farm_id = get_node_owned(connection, node_id, current_user["id"])["farm_id"]

        weather = fetch_weather_with_cache(adm4)
        decision = calculate_decision(payload.soil_moisture, weather["rain_next_3h"])
        reading_id = record_reading(connection, node_id, farm_id, payload, weather, decision)

    reading = payload.model_dump()
    reading["id"] = reading_id
    reading["farm_id"] = farm_id
    reading["node_id"] = node_id

    return {
        "reading": reading,
        "decision": decision,
        "node_created": node_created,
        # Node baru maupun lama tersimpan "online" (lihat node_service.insert_node).
        "node_status": "online",
    }
