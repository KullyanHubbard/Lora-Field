"""Prakiraan cuaca BMKG: fetch, normalisasi response, dan cache per adm4."""

import json
import logging
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import HTTPException

from .config import settings
from .database import get_connection


logger = logging.getLogger("lorafield")


BMKG_FORECAST_URL = "https://api.bmkg.go.id/publik/prakiraan-cuaca"
RAIN_KEYWORDS = ("hujan", "rain", "shower", "thunderstorm")
BMKG_SOURCE_URL = "https://data.bmkg.go.id/prakiraan-cuaca/"
BMKG_TIMEOUT_SECONDS = 10
WEATHER_CACHE_TTL_MINUTES = 30
# Satu slot prakiraan BMKG = 3 jam. Slot sekarang + berikutnya menentukan rain_next_3h.
RAIN_CHECK_SLOTS = 2
# Jumlah slot prakiraan yang dikirim ke frontend (8 x 3 jam = 24 jam).
FORECAST_SLOTS = 8
# Kalau BMKG gagal untuk suatu adm4, jangan dicoba lagi selama ini (hindari timeout berulang).
BMKG_RETRY_AFTER_MINUTES = 5

# Waktu gagal terakhir per adm4, in-memory, cukup untuk satu proses.
_bmkg_failed_at: dict[str, datetime] = {}


def flatten_bmkg_forecasts(data: dict) -> list[dict]:
    forecast_groups = data.get("data") or []
    if not forecast_groups:
        return []
    forecast_days = forecast_groups[0].get("cuaca", [])
    return [forecast for day in forecast_days for forecast in day]


def is_rainy_forecast(forecast: dict) -> bool:
    description = str(forecast.get("weather_desc", "")).lower()
    return any(keyword in description for keyword in RAIN_KEYWORDS)


def number_or_none(value) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def rain_outlook(slots: list[dict]) -> tuple[bool, float | None]:
    """(tunda siram, total tp mm) untuk slot di jendela cek hujan.

    Kalau ada slot tanpa angka tp, kembali ke kata kunci teks dan total None.
    """
    amounts = [number_or_none(slot.get("tp")) for slot in slots]
    if slots and all(amount is not None for amount in amounts):
        total = round(sum(amounts), 1)
        return total >= settings.rain_delay_min_mm, total
    return any(is_rainy_forecast(slot) for slot in slots), None


def build_bmkg_location_profile(location: dict, fallback_adm4: str) -> dict:
    return {
        "adm1": location.get("adm1"),
        "adm2": location.get("adm2"),
        "adm3": location.get("adm3"),
        "adm4": location.get("adm4") or fallback_adm4,
        "province": location.get("provinsi"),
        "city": location.get("kotkab"),
        "district": location.get("kecamatan"),
        "village": location.get("desa"),
        "latitude": number_or_none(location.get("lat") or location.get("latitude")),
        "longitude": number_or_none(location.get("lon") or location.get("longitude")),
        "altitude_m": number_or_none(
            location.get("altitude")
            or location.get("altitude_m")
            or location.get("elevation")
            or location.get("elev")
        ),
        "timezone": location.get("timezone"),
        "type": location.get("type"),
    }


def fetch_bmkg_weather(adm4: str) -> dict:
    try:
        with httpx.Client(timeout=BMKG_TIMEOUT_SECONDS) as client:
            response = client.get(BMKG_FORECAST_URL, params={"adm4": adm4})
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"BMKG mengembalikan status {exc.response.status_code}",
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail="Gagal mengambil data cuaca dari BMKG",
        ) from exc

    data = response.json()
    forecasts = flatten_bmkg_forecasts(data)
    if not forecasts:
        raise HTTPException(status_code=404, detail="Prakiraan BMKG tidak tersedia")

    current = forecasts[0]
    rain_next_3h, rain_next_3h_mm = rain_outlook(forecasts[:RAIN_CHECK_SLOTS])
    location = data.get("lokasi", {})
    location_profile = build_bmkg_location_profile(location, adm4)

    return {
        "provider": "BMKG",
        "adm4": location_profile["adm4"],
        "location": location.get("desa") or location.get("kotkab") or adm4,
        "location_profile": location_profile,
        "region": {
            "province": location.get("provinsi"),
            "city": location.get("kotkab"),
            "district": location.get("kecamatan"),
            "village": location.get("desa"),
        },
        "condition": current.get("weather_desc"),
        "code": current.get("weather"),
        "temperature": current.get("t"),
        "humidity": current.get("hu"),
        "wind_speed": current.get("ws"),
        "wind_direction": current.get("wd"),
        "visibility": current.get("vs_text"),
        "rain_next_3h": rain_next_3h,
        "rain_next_3h_mm": rain_next_3h_mm,
        "forecast_time": current.get("local_datetime") or current.get("datetime"),
        "updated_at": current.get("analysis_date"),
        "forecast": forecasts[:FORECAST_SLOTS],
        "source": BMKG_SOURCE_URL,
    }


def set_cached_weather(adm4: str, data: dict) -> None:
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO weather_cache (adm4, data, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(adm4) DO UPDATE SET
                data = excluded.data,
                updated_at = excluded.updated_at
            """,
            (adm4, json.dumps(data)),
        )


def _parse_cache_time(value: str | None) -> datetime | None:
    """updated_at weather_cache = UTC tanpa penanda zona (CURRENT_TIMESTAMP SQLite)."""
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _read_weather_cache_row(adm4: str) -> tuple[dict, str] | None:
    """Baca cache apa adanya tanpa filter TTL. Kembalikan (data, updated_at) atau None."""
    with get_connection() as connection:
        row = connection.execute(
            "SELECT data, updated_at FROM weather_cache WHERE adm4 = ?",
            (adm4,),
        ).fetchone()
    if row is None:
        return None
    data = json.loads(row["data"])
    return data, row["updated_at"]


def _recompute_stale_weather(data: dict, updated_at: str) -> dict | None:
    """Hitung ulang condition dan rain_next_3h dari daftar forecast untuk cache lama."""
    now = datetime.now(timezone.utc)
    slots = []
    for item in data.get("forecast") or []:
        parsed = _parse_cache_time(item.get("utc_datetime"))
        if parsed is not None:
            slots.append((parsed, item))
    if not slots:
        return None
    slots.sort(key=lambda pair: pair[0])

    past_or_now = [pair for pair in slots if pair[0] <= now]
    current_index = slots.index(past_or_now[-1]) if past_or_now else 0
    current_time, current_slot = slots[current_index]
    if now - current_time > timedelta(hours=3):
        return None

    next_slots = slots[current_index : current_index + RAIN_CHECK_SLOTS]
    rain_next_3h, rain_next_3h_mm = rain_outlook([slot for _, slot in next_slots])

    stale = dict(data)
    stale["condition"] = current_slot.get("weather_desc")
    stale["code"] = current_slot.get("weather")
    stale["temperature"] = current_slot.get("t")
    stale["humidity"] = current_slot.get("hu")
    stale["rain_next_3h"] = rain_next_3h
    stale["rain_next_3h_mm"] = rain_next_3h_mm
    stale["from_cache"] = True
    stale["is_stale"] = True
    stale["fetched_at"] = updated_at
    return stale


def get_weather_for_decision(adm4: str) -> dict | None:
    """Cuaca untuk keputusan irigasi. Tidak pernah melempar exception apa pun.

    Urutan: cache segar, lalu BMKG langsung, lalu cache lama (dihitung ulang dari
    forecast, maks settings.weather_stale_max_hours), lalu None.
    """
    cached = None
    try:
        cached = _read_weather_cache_row(adm4)
    except Exception as exc:
        logger.warning("weather | cache-read-failed | adm4=%s | %s", adm4, exc)

    if cached is not None:
        data, updated_at = cached
        cached_at = _parse_cache_time(updated_at)
        if cached_at is not None and datetime.now(timezone.utc) - cached_at <= timedelta(
            minutes=WEATHER_CACHE_TTL_MINUTES
        ):
            fresh = dict(data)
            fresh["from_cache"] = True
            fresh["is_stale"] = False
            return fresh

    failed_at = _bmkg_failed_at.get(adm4)
    in_retry_pause = failed_at is not None and datetime.now(timezone.utc) - failed_at < timedelta(
        minutes=BMKG_RETRY_AFTER_MINUTES
    )
    if not in_retry_pause:
        try:
            weather = fetch_bmkg_weather(adm4)
        except Exception as exc:
            logger.warning("weather | bmkg-failed | adm4=%s | %s", adm4, exc)
            _bmkg_failed_at[adm4] = datetime.now(timezone.utc)
        else:
            _bmkg_failed_at.pop(adm4, None)
            try:
                set_cached_weather(adm4, weather)
            except Exception as exc:
                logger.warning("weather | cache-write-failed | adm4=%s | %s", adm4, exc)
            weather = dict(weather)
            weather["from_cache"] = False
            weather["is_stale"] = False
            return weather

    if cached is None:
        return None
    data, updated_at = cached
    cached_at = _parse_cache_time(updated_at)
    if cached_at is None or datetime.now(timezone.utc) - cached_at > timedelta(
        hours=settings.weather_stale_max_hours
    ):
        return None

    try:
        return _recompute_stale_weather(data, updated_at)
    except Exception as exc:
        logger.warning("weather | stale-recompute-failed | adm4=%s | %s", adm4, exc)
        return None
