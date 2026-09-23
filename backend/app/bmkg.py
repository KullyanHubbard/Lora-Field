"""Prakiraan cuaca BMKG: fetch, normalisasi response, dan cache per adm4."""

import json

import httpx
from fastapi import HTTPException

from .database import get_connection


BMKG_FORECAST_URL = "https://api.bmkg.go.id/publik/prakiraan-cuaca"
RAIN_KEYWORDS = ("hujan", "rain", "shower", "thunderstorm")
WEATHER_CACHE_TTL_MINUTES = 30


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
        with httpx.Client(timeout=10) as client:
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
    # Periksa slot sekarang dan slot 3 jam berikutnya (masing-masing slot = 3 jam)
    next_3h_slots = forecasts[:2]
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
        "rain_next_3h": any(is_rainy_forecast(f) for f in next_3h_slots),
        "forecast_time": current.get("local_datetime") or current.get("datetime"),
        "updated_at": current.get("analysis_date"),
        "forecast": forecasts[:8],
        "source": "https://data.bmkg.go.id/prakiraan-cuaca/",
    }


def get_cached_weather(adm4: str) -> dict | None:
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT data FROM weather_cache
            WHERE adm4 = ?
              AND datetime(updated_at) > datetime('now', ?)
            """,
            (adm4, f"-{WEATHER_CACHE_TTL_MINUTES} minutes"),
        ).fetchone()
    if row is None:
        return None
    return json.loads(row["data"])


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


def fetch_weather_with_cache(adm4: str) -> dict:
    cached = get_cached_weather(adm4)
    if cached is not None:
        cached["from_cache"] = True
        return cached
    weather = fetch_bmkg_weather(adm4)
    set_cached_weather(adm4, weather)
    weather["from_cache"] = False
    return weather
