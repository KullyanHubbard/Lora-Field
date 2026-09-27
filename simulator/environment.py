"""Kondisi udara di kebun saat ini, dari prakiraan BMKG kebun lewat backend.

Prakiraan BMKG per 3 jam, jadi suhu dan kelembapan diinterpolasi linear antar slot supaya
naik turun halus. Kalau BMKG tidak tersedia, dipakai kurva harian dari fallback_climate.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime


@dataclass
class Ambient:
    air_temp: float
    humidity: float
    raining: bool
    cloudy: bool
    source: str


def _contains_any(text: str, keywords: list[str]) -> bool:
    lowered = text.lower()
    return any(keyword in lowered for keyword in keywords)


def _forecast_points(weather: dict) -> list[tuple[datetime, float, float, str]]:
    points = []
    for item in weather.get("forecast") or []:
        try:
            # local_datetime BMKG sudah jam lokal kebun, sama dengan jam komputer (WIB).
            time = datetime.fromisoformat(str(item["local_datetime"]))
            points.append((time, float(item["t"]), float(item["hu"]), str(item.get("weather_desc", ""))))
        except (KeyError, TypeError, ValueError):
            continue
    return sorted(points, key=lambda point: point[0])


def _interpolate(now: datetime, points: list[tuple[datetime, float, float, str]]):
    if now <= points[0][0]:
        return points[0][1], points[0][2], points[0][3]
    for (t0, temp0, hum0, desc0), (t1, temp1, hum1, _) in zip(points, points[1:]):
        if t0 <= now <= t1:
            ratio = (now - t0).total_seconds() / max((t1 - t0).total_seconds(), 1)
            return temp0 + (temp1 - temp0) * ratio, hum0 + (hum1 - hum0) * ratio, desc0
    return points[-1][1], points[-1][2], points[-1][3]


def _fallback(now: datetime, climate: dict) -> tuple[float, float]:
    # Kurva sinus harian: suhu puncak di temp_peak_hour, kelembapan berlawanan arah.
    hour = now.hour + now.minute / 60
    phase = math.cos(2 * math.pi * (hour - climate["temp_peak_hour"]) / 24)
    mid_temp = (climate["temp_max_c"] + climate["temp_min_c"]) / 2
    amp_temp = (climate["temp_max_c"] - climate["temp_min_c"]) / 2
    mid_hum = (climate["humidity_max_pct"] + climate["humidity_min_pct"]) / 2
    amp_hum = (climate["humidity_max_pct"] - climate["humidity_min_pct"]) / 2
    return mid_temp + amp_temp * phase, mid_hum - amp_hum * phase


def ambient_at(now: datetime, weather: dict | None, config: dict) -> Ambient:
    points = _forecast_points(weather) if weather else []
    if points:
        temp, humidity, description = _interpolate(now, points)
        source = "BMKG"
    elif weather and weather.get("temperature") is not None and weather.get("humidity") is not None:
        temp, humidity = float(weather["temperature"]), float(weather["humidity"])
        description, source = str(weather.get("condition") or ""), "BMKG"
    else:
        temp, humidity = _fallback(now, config["fallback_climate"])
        description, source = "", "fallback"
    return Ambient(
        air_temp=temp,
        humidity=humidity,
        raining=_contains_any(description, config["rain_keywords"]),
        cloudy=_contains_any(description, config["cloud_keywords"]),
        source=source,
    )
