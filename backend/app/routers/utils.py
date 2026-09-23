"""Route pendukung: daftar tanaman, resolusi adm4, cuaca mentah BMKG, simulator keputusan.

/api/weather dan /api/decision adalah endpoint debug: yang pertama bypass cache dan
selalu memanggil BMKG, yang kedua hitungan stateless tanpa menyentuh database.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from ..adm4 import resolve_bmkg_adm4
from ..auth import get_current_user
from ..bmkg import fetch_bmkg_weather
from ..crops import CROP_THRESHOLDS
from ..irrigation import THRESHOLDS, calculate_decision

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


@router.get("/api/weather")
def get_weather(
    current_user: Annotated[dict, Depends(get_current_user)],
    adm4: str = Query(..., min_length=2, description="Kode wilayah adm4 BMKG"),
) -> dict:
    return fetch_bmkg_weather(adm4)


@router.get("/api/decision")
def get_decision(
    current_user: Annotated[dict, Depends(get_current_user)],
    soil_moisture: float = Query(..., ge=0, le=100),
    rain_next_3h: bool = Query(default=False),
) -> dict:
    return {
        "soil_moisture": soil_moisture,
        "rain_next_3h": rain_next_3h,
        "thresholds": THRESHOLDS.model_dump(),
        "decision": calculate_decision(soil_moisture, rain_next_3h),
    }
