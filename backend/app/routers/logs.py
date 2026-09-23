"""Route /api/logs: riwayat keputusan irigasi milik user."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from ..auth import get_current_user
from ..database import get_connection

router = APIRouter()


@router.get("/api/logs")
def list_logs(
    current_user: Annotated[dict, Depends(get_current_user)],
    limit: int = Query(default=20, ge=1, le=100),
) -> dict:
    """Decision logs hanya dari node-node milik user yang terotentikasi."""
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT dl.* FROM decision_logs dl
            JOIN nodes n ON n.id = dl.node_id
            JOIN farms f ON f.id = n.farm_id
            WHERE f.user_id = ?
            ORDER BY dl.created_at DESC, dl.id DESC
            LIMIT ?
            """,
            (current_user["id"], limit),
        ).fetchall()
    return {"items": [dict(row) for row in rows]}
