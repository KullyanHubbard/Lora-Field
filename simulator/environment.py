"""Kondisi udara di kebun saat ini, dari prakiraan BMKG untuk kode wilayah kebun.

Ini bagian "dunia" simulasi, bukan bagian alat: alat asli tidak mengambil cuaca, ia hanya
mengukur. BMKG diambil langsung (tanpa akun LoraField) supaya dunia simulasi tetap nyata.

Prakiraan BMKG per 3 jam, jadi suhu, kelembapan, dan tutupan awan diinterpolasi linear antar
slot supaya naik turun halus. Curah hujan (tp) berlaku untuk slot yang sedang berjalan. Kalau
BMKG tidak tersedia, dipakai kurva harian dari fallback_climate.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from datetime import datetime, timedelta
from urllib.parse import urlencode
from urllib.request import Request, urlopen

BMKG_FORECAST_URL = "https://api.bmkg.go.id/publik/prakiraan-cuaca"
# Jarak antar slot prakiraan BMKG. Lewat dari slot terakhir, prakiraannya dianggap habis.
FORECAST_SLOT = timedelta(hours=3)
SLOT_HOURS = FORECAST_SLOT.total_seconds() / 3600


@dataclass
class Ambient:
    air_temp: float
    humidity: float
    raining: bool  # BMKG: sedang hujan di lokasi kebun
    source: str
    cloud_cover: float = 0.3  # 0–1, dari tcc BMKG
    # Hujan yang benar-benar sampai ke tanah kebun (mm/jam), sudah dikali paparan penutup tanah.
    rain_mm_per_hour: float = 0.0


def fetch_bmkg(adm4: str, timeout_seconds: float) -> dict | None:
    """Prakiraan BMKG mentah, diratakan jadi {"forecast": [slot, ...]}. None kalau gagal."""
    request = Request(
        f"{BMKG_FORECAST_URL}?{urlencode({'adm4': adm4})}",
        headers={"User-Agent": "LoraField-Simulator/1.0"},
    )
    try:
        with urlopen(request, timeout=timeout_seconds) as response:
            data = json.load(response)
    except (OSError, ValueError):
        return None
    groups = data.get("data") or []
    days = groups[0].get("cuaca", []) if groups else []
    forecast = [slot for day in days for slot in day]
    return {"forecast": forecast} if forecast else None


def _contains_any(text: str, keywords: list[str]) -> bool:
    lowered = text.lower()
    return any(keyword in lowered for keyword in keywords)


def _number(value) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _forecast_points(weather: dict) -> list[dict]:
    points = []
    for item in weather.get("forecast") or []:
        try:
            points.append(
                {
                    # local_datetime BMKG sudah jam lokal kebun, sama dengan jam komputer (WIB).
                    "time": datetime.fromisoformat(str(item["local_datetime"])),
                    "t": float(item["t"]),
                    "hu": float(item["hu"]),
                    "tcc": _number(item.get("tcc")),
                    "tp": _number(item.get("tp")),
                    "desc": str(item.get("weather_desc", "")),
                }
            )
        except (KeyError, TypeError, ValueError):
            continue
    return sorted(points, key=lambda point: point["time"])


def _at(now: datetime, points: list[dict]) -> tuple[float, float, float | None, dict]:
    """Suhu, kelembapan, dan tutupan awan saat ini, plus slot yang sedang berjalan."""
    if now <= points[0]["time"]:
        first = points[0]
        return first["t"], first["hu"], first["tcc"], first
    for p0, p1 in zip(points, points[1:]):
        if p0["time"] <= now <= p1["time"]:
            ratio = (now - p0["time"]).total_seconds() / max((p1["time"] - p0["time"]).total_seconds(), 1)
            cover = None if p0["tcc"] is None or p1["tcc"] is None else p0["tcc"] + (p1["tcc"] - p0["tcc"]) * ratio
            return p0["t"] + (p1["t"] - p0["t"]) * ratio, p0["hu"] + (p1["hu"] - p0["hu"]) * ratio, cover, p0
    last = points[-1]
    return last["t"], last["hu"], last["tcc"], last


def _fallback(now: datetime, climate: dict) -> tuple[float, float]:
    # Kurva sinus harian: suhu puncak di temp_peak_hour, kelembapan berlawanan arah.
    hour = now.hour + now.minute / 60
    phase = math.cos(2 * math.pi * (hour - climate["temp_peak_hour"]) / 24)
    mid_temp = (climate["temp_max_c"] + climate["temp_min_c"]) / 2
    amp_temp = (climate["temp_max_c"] - climate["temp_min_c"]) / 2
    mid_hum = (climate["humidity_max_pct"] + climate["humidity_min_pct"]) / 2
    amp_hum = (climate["humidity_max_pct"] - climate["humidity_min_pct"]) / 2
    return mid_temp + amp_temp * phase, mid_hum - amp_hum * phase


def ambient_at(now: datetime, weather: dict | None, config: dict, rain_exposure: float = 1.0) -> Ambient:
    """rain_exposure: bagian hujan yang sampai ke tanah (tanah terbuka 1, beratap 0)."""
    points = _forecast_points(weather) if weather else []
    # Prakiraan yang sudah habis (BMKG lama tidak bisa diambil) diganti kurva harian, supaya suhu
    # tidak macet di angka slot terakhir siang dan malam.
    if points and now <= points[-1]["time"] + FORECAST_SLOT:
        temp, humidity, cover, slot = _at(now, points)
        description, source = slot["desc"], "BMKG"
        if slot["tp"] is not None:
            rain = slot["tp"] / SLOT_HOURS  # tp = total hujan satu slot 3 jam
        elif _contains_any(description, config["rain_keywords"]):
            rain = config["rain"]["keyword_mm_per_hour"]
        else:
            rain = 0.0
    else:
        temp, humidity = _fallback(now, config["fallback_climate"])
        cover, description, source, rain = None, "", "fallback", 0.0
    cloudy = _contains_any(description, config["cloud_keywords"])
    return Ambient(
        air_temp=temp,
        humidity=humidity,
        raining=rain > 0,
        source=source,
        cloud_cover=cover / 100 if cover is not None else (0.7 if cloudy else 0.2),
        rain_mm_per_hour=rain * rain_exposure,
    )
