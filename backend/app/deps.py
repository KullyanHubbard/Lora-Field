"""Helper yang dipakai bersama beberapa router: IP klien dan verifikasi kepemilikan."""

from fastapi import HTTPException, Request

from .database import row_to_dict


def client_ip(request: Request) -> str:
    """Ambil IP klien sebenarnya. Kalau di belakang Cloudflare Tunnel, pakai
    header CF-Connecting-IP. Fallback ke X-Forwarded-For atau remote_addr."""
    cf = request.headers.get("CF-Connecting-IP")
    if cf:
        return cf
    xff = request.headers.get("X-Forwarded-For", "")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def get_farm_owned(connection, farm_id: str, user_id: str) -> dict:
    """Ambil farm + verifikasi kepemilikan. Lempar 404 jika tidak ada atau bukan milik user."""
    farm = row_to_dict(
        connection.execute("SELECT * FROM farms WHERE id = ?", (farm_id,)).fetchone()
    )
    if farm is None or farm["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Kebun tidak ditemukan")
    return farm


def get_node_owned(connection, node_id: str, user_id: str) -> dict:
    """Ambil node + verifikasi kepemilikan via farm.user_id."""
    node = row_to_dict(
        connection.execute("SELECT * FROM nodes WHERE id = ?", (node_id,)).fetchone()
    )
    if node is None:
        raise HTTPException(status_code=404, detail="Node tidak ditemukan")
    farm_id = node.get("farm_id")
    if not farm_id:
        raise HTTPException(status_code=404, detail="Node tidak ditemukan")
    get_farm_owned(connection, farm_id, user_id)
    return node


def get_farm_for_gateway_action(connection, farm_id: str, user_id: str) -> dict:
    """Ambil farm untuk aksi gateway; bedakan not found dan forbidden."""
    farm = row_to_dict(
        connection.execute("SELECT * FROM farms WHERE id = ?", (farm_id,)).fetchone()
    )
    if farm is None:
        raise HTTPException(status_code=404, detail="Kebun tidak ditemukan")
    if farm["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Tidak punya akses ke kebun ini")
    return farm
