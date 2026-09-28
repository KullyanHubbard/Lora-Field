"""Route /api/nodes: daftar node, update lokasi, dan pembacaan sensor."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from ..auth import get_current_user
from ..bmkg import get_weather_for_decision
from ..database import get_connection, row_to_dict
from ..deps import get_farm_owned, get_node_owned
from ..node_service import default_node_name, insert_node, present_node
from ..reading_service import apply_reading
from ..schemas import NodeLocationUpdate, NodeNameUpdate, SensorReadingIn

router = APIRouter()

# Batas rentang jam untuk GET readings?hours=, supaya satu request tidak menarik riwayat tanpa ujung.
READINGS_MAX_HOURS = 72


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
    return {"items": [present_node(node) for node in nodes], "total": len(nodes)}


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
    return {"node": present_node(node)}


@router.patch("/api/nodes/{node_id}/name")
def update_node_name(
    node_id: str,
    payload: NodeNameUpdate,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Nama node tidak boleh kosong.")
    with get_connection() as connection:
        get_node_owned(connection, node_id, current_user["id"])
        connection.execute(
            "UPDATE nodes SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (name, node_id),
        )
        node = row_to_dict(
            connection.execute("SELECT * FROM nodes WHERE id = ?", (node_id,)).fetchone()
        )
    return {"node": present_node(node)}


@router.get("/api/nodes/{node_id}/readings")
def list_readings(
    node_id: str,
    current_user: Annotated[dict, Depends(get_current_user)],
    limit: int = Query(default=20, ge=1, le=100),
    hours: int | None = Query(
        default=None,
        ge=1,
        le=READINGS_MAX_HOURS,
        description="Semua reading dalam N jam sebelum reading terbaru node. Kalau diisi, limit diabaikan.",
    ),
) -> dict:
    with get_connection() as connection:
        get_node_owned(connection, node_id, current_user["id"])
        if hours is not None:
            rows = connection.execute(
                """
                SELECT * FROM readings
                WHERE node_id = ?
                  AND datetime(created_at) >= datetime(
                      (SELECT MAX(created_at) FROM readings WHERE node_id = ?), ?
                  )
                ORDER BY created_at DESC, id DESC
                """,
                (node_id, node_id, f"-{hours} hours"),
            ).fetchall()
        else:
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
    adm4: str | None = Query(
        default=None, description="Cadangan, hanya dipakai kalau kebun belum punya kode BMKG"
    ),
) -> dict:
    # Node yang belum terdaftar dibuat di sini, dipakai firmware yang langsung kirim
    # reading tanpa registrasi lewat gateway.
    node_created = False

    # Kode BMKG kebun menang atas ?adm4= dari alat, supaya salah kirim firmware tidak
    # memakai cuaca desa lain. Tanpa cek kepemilikan: nilainya tidak dikirim ke client.
    with get_connection() as connection:
        node_row = connection.execute(
            "SELECT farm_id FROM nodes WHERE id = ?", (node_id,)
        ).fetchone()
        weather_farm_id = node_row["farm_id"] if node_row else payload.farm_id
        farm_row = connection.execute(
            "SELECT bmkg_adm4_code FROM farms WHERE id = ?", (weather_farm_id,)
        ).fetchone()
    region_code = (farm_row["bmkg_adm4_code"] if farm_row else None) or (adm4 or "").strip()

    # Diambil sebelum transaksi dibuka: cache miss menulis weather_cache lewat koneksi
    # lain, dan itu terkunci kalau transaksi ini sudah menulis node baru.
    # weather bisa None kalau BMKG gangguan dan tidak ada cache cadangan yang layak pakai.
    weather = get_weather_for_decision(region_code) if region_code else None

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

            farm = get_farm_owned(connection, farm_id, current_user["id"])
            insert_node(connection, node_id, farm_id, default_node_name(node_id))
            node_created = True
        else:
            farm_id = get_node_owned(connection, node_id, current_user["id"])["farm_id"]
            farm = get_farm_owned(connection, farm_id, current_user["id"])

        reading_id, decision = apply_reading(connection, node_id, farm, payload, weather)

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
