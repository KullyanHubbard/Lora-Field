"""Resolusi kode wilayah adm4 BMKG dari koordinat GPS atau teks alamat."""

import logging
import re

import httpx

from .database import get_connection
from .wilayah_resolver import resolve_adm4_from_freetext, resolve_adm4_from_region_names


logger = logging.getLogger("lorafield")


ADM4_PATTERN = re.compile(r"^\d{2}\.\d{2}\.\d{2}\.\d{4}$")
LOCAL_ADM4_ALIASES = {
    ("balecatur", "gamping", "sleman"): "34.04.01.2001",
    ("ambarketawang", "gamping", "sleman"): "34.04.01.2002",
    ("banyuraden", "gamping", "sleman"): "34.04.01.2003",
    ("nogotirto", "gamping", "sleman"): "34.04.01.2004",
    ("trihanggo", "gamping", "sleman"): "34.04.01.2005",
    ("sinduharjo", "ngaglik", "sleman"): "34.04.12.2003",
}


def normalize_adm4_code(value: str | None) -> str:
    raw = (value or "").strip()
    if ADM4_PATTERN.match(raw):
        return raw
    digits = re.sub(r"\D", "", raw)
    if len(digits) == 10:
        return f"{digits[0:2]}.{digits[2:4]}.{digits[4:6]}.{digits[6:10]}"
    return ""


def normalize_location_text(value: str | None) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (value or "").lower()).strip()


def resolve_adm4_from_text(*parts: str | None) -> str:
    text = normalize_location_text(" ".join(part for part in parts if part))
    if not text:
        return ""
    for keywords, adm4 in LOCAL_ADM4_ALIASES.items():
        if all(keyword in text for keyword in keywords):
            return adm4
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

    address = data.get("address") or {}
    return resolve_adm4_from_text(
        data.get("display_name"),
        address.get("village"),
        address.get("suburb"),
        address.get("city_district"),
        address.get("county"),
        address.get("state"),
    )


def resolve_bmkg_adm4(lat: float, lng: float, location_hint: str = "") -> str:
    """Resolve kode BMKG adm4 dari koordinat via Nominatim reverse geocode.

    Nominatim menyimpan kode BPS (ref:BPS) pada batas administrasi Indonesia.
    Format BPS 10-digit (mis. '3402011001') dikonversi ke format BMKG
    dengan titik (mis. '34.02.01.1001').
    """
    adm4_from_hint = resolve_adm4_from_text(location_hint)
    if adm4_from_hint:
        return adm4_from_hint

    try:
        with httpx.Client(timeout=8) as client:
            response = client.get(
                "https://nominatim.openstreetmap.org/reverse",
                params={
                    "lat": lat,
                    "lon": lng,
                    "format": "json",
                    "addressdetails": "1",
                    "extratags": "1",
                    "zoom": "16",
                },
                headers={"User-Agent": "LoraField/1.3 farm-dashboard"},
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
