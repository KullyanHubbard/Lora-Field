"""Route /api/logs: riwayat keputusan irigasi milik user."""

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from ..auth import get_current_user
from ..database import get_connection
from ..deps import get_farm_owned

router = APIRouter()

LOGS_MAX_LIMIT = 1000


def _utc_text(value: datetime) -> str:
    """Format datetime jadi teks UTC sama seperti created_at di DB. Tanpa zona dianggap UTC."""
    if value.tzinfo is not None:
        try:
            value = value.astimezone(timezone.utc)
        except OverflowError as exc:
            # Tanggal di ujung kalender dengan zona jauh dari UTC keluar rentang datetime saat diubah ke UTC.
            raise HTTPException(status_code=422, detail="Filter tanggal di luar rentang yang didukung.") from exc
    return value.strftime("%Y-%m-%d %H:%M:%S")


@router.get("/api/logs")
def list_logs(
    current_user: Annotated[dict, Depends(get_current_user)],
    limit: int = Query(default=20, ge=1, le=LOGS_MAX_LIMIT),
    farm_id: str | None = Query(default=None, description="Hanya log dari kebun ini"),
    start: datetime | None = Query(default=None, description="Batas awal (inklusif)"),
    end: datetime | None = Query(default=None, description="Batas akhir (inklusif)"),
) -> dict:
    """Decision logs hanya dari node-node milik user yang terotentikasi."""
    with get_connection() as connection:
        if farm_id is not None:
            get_farm_owned(connection, farm_id, current_user["id"])

        conditions = ["f.user_id = ?"]
        params: list = [current_user["id"]]
        if farm_id is not None:
            conditions.append("f.id = ?")
            params.append(farm_id)
        if start is not None:
            conditions.append("dl.created_at >= ?")
            params.append(_utc_text(start))
        if end is not None:
            conditions.append("dl.created_at <= ?")
            params.append(_utc_text(end))

        where_clause = " AND ".join(conditions)
        params.append(limit)
        rows = connection.execute(
            f"""
            SELECT dl.* FROM decision_logs dl
            JOIN nodes n ON n.id = dl.node_id
            JOIN farms f ON f.id = n.farm_id
            WHERE {where_clause}
            ORDER BY dl.created_at DESC, dl.id DESC
            LIMIT ?
            """,
            params,
        ).fetchall()
    return {"items": [dict(row) for row in rows]}
