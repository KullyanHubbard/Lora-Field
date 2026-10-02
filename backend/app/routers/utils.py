"""Route pendukung: daftar tanaman dan resolusi kode adm4 BMKG."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from ..adm4 import resolve_bmkg_adm4
from ..auth import get_current_user
from ..crops import CROP_THRESHOLDS

router = APIRouter()


@router.get("/api/crops")
def list_crops(q: str = Query(default="", max_length=100)) -> dict:
    """Daftar jenis tanaman beserta threshold VWC yang disarankan."""
    results = CROP_THRESHOLDS
    if q:
        q_lower = q.lower()
        results = [c for c in CROP_THRESHOLDS if q_lower in c["name"].lower()]
    return {"crops": results}


@router.get("/api/utils/resolve-adm4")
def resolve_adm4(
    current_user: Annotated[dict, Depends(get_current_user)],
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    q: str = Query(default="", max_length=200),
) -> dict:
    """Resolve kode BMKG adm4 dari koordinat GPS."""
    adm4 = resolve_bmkg_adm4(lat, lon, q)
    return {"adm4": adm4, "found": bool(adm4)}
