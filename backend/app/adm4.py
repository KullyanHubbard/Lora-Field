"""Resolusi kode wilayah adm4 BMKG dari koordinat GPS atau teks alamat."""

import logging
import re

import httpx

from .config import APP_VERSION
from .database import get_connection
from .wilayah_resolver import resolve_adm4_from_freetext, resolve_adm4_from_region_names


logger = logging.getLogger("lorafield")


ADM4_PATTERN = re.compile(r"^\d{2}\.\d{2}\.\d{2}\.\d{4}$")
NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse"
NOMINATIM_TIMEOUT_SECONDS = 8


def normalize_adm4_code(value: str | None) -> str:
    raw = (value or "").strip()
    if ADM4_PATTERN.match(raw):
        return raw
    digits = re.sub(r"\D", "", raw)
    if len(digits) == 10:
        return f"{digits[0:2]}.{digits[2:4]}.{digits[4:6]}.{digits[6:10]}"
    return ""


def extract_adm4_from_nominatim(data: dict) -> str:
    extratags = data.get("extratags") or {}
    for key in (
        "ref:id:kemendagri",
        "ref:kemendagri",
        "ref:Kemendagri",
        "ref:id:bps",
        "ref:BPS",
        "ref:bps",
    ):
        adm4 = normalize_adm4_code(extratags.get(key))
        if adm4:
            return adm4
    return ""


def resolve_bmkg_adm4(lat: float, lng: float, location_hint: str = "") -> str:
    """Resolve kode BMKG adm4 dari koordinat via Nominatim reverse geocode.

    Nominatim menyimpan kode BPS (ref:BPS) pada batas administrasi Indonesia.
    Format BPS 10-digit (mis. '3402011001') dikonversi ke format BMKG
    dengan titik (mis. '34.02.01.1001').
    """
    try:
        with httpx.Client(timeout=NOMINATIM_TIMEOUT_SECONDS) as client:
            response = client.get(
                NOMINATIM_REVERSE_URL,
                params={
                    "lat": lat,
                    "lon": lng,
                    "format": "json",
                    "addressdetails": "1",
                    "extratags": "1",
                    "zoom": "16",
                },
                headers={"User-Agent": f"LoraField/{APP_VERSION} farm-dashboard"},
            )
            response.raise_for_status()
        data = response.json()
        adm4 = extract_adm4_from_nominatim(data)
        if adm4:
            return adm4

        # OSM tak punya tag kode BPS di titik ini: cocokkan nama wilayah hasil reverse-geocode
        # ke daftar Kemendagri. Field Nominatim bervariasi, jadi tiap level dikirim beberapa kandidat.
        address = data.get("address") or {}
        adm4 = resolve_adm4_from_region_names(
            province=address.get("state", ""),
            regency=address.get("county") or address.get("city") or address.get("region") or "",
            district=(
                address.get("municipality")
                or address.get("city_district")
                or address.get("subdistrict")
                or address.get("suburb")
                or ""
            ),
            village=(
                address.get("village")
                or address.get("hamlet")
                or address.get("neighbourhood")
                or address.get("suburb")
                or ""
            ),
        )
        if adm4:
            return adm4
    except Exception as exc:
        logger.warning("resolve-adm4 | nominatim-failed | lat=%s lng=%s | %s", lat, lng, exc)

    # Fallback terakhir (offline): alamat ketikan user. Berguna saat Nominatim
    # gagal/timeout dan user mengisi alamat yang konsisten.
    return resolve_adm4_from_freetext(location_hint)


def ensure_farm_bmkg_adm4(farm: dict) -> dict:
    if farm.get("bmkg_adm4_code"):
        return farm

    lat = farm.get("latitude")
    lng = farm.get("longitude")
    if lat is None or lng is None:
        return farm

    adm4 = resolve_bmkg_adm4(float(lat), float(lng), farm.get("location", ""))
    if not adm4:
        return farm

    with get_connection() as connection:
        connection.execute(
            "UPDATE farms SET bmkg_adm4_code = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (adm4, farm["id"]),
        )

    updated = dict(farm)
    updated["bmkg_adm4_code"] = adm4
    return updated
