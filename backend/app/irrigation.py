"""Keputusan irigasi: threshold VWC dan aturan buka/tutup valve."""

from datetime import datetime, timedelta

from .config import settings
from .node_service import _parse_db_time
from .schemas import ThresholdConfig


# Dipakai kebun yang jenis tanamannya tidak ada di daftar crops.py.
DEFAULT_THRESHOLDS = ThresholdConfig()


def farm_thresholds(farm: dict) -> ThresholdConfig:
    lower = farm.get("lower_threshold")
    upper = farm.get("upper_threshold")
    if lower is None or upper is None:
        return DEFAULT_THRESHOLDS
    return ThresholdConfig(lower=lower, upper=upper)


def effective_rain_next_3h(farm: dict, weather: dict | None) -> bool:
    """Hujan menunda irigasi hanya untuk kebun tanah terbuka. Mulsa/atap tidak kena hujan."""
    if weather is None:
        return False
    if not weather["rain_next_3h"]:
        return False
    return farm.get("ground_cover", "open") == "open"


# Dipakai summary untuk node offline: keputusan terakhir sudah basi, jadi tidak ditampilkan
# sebagai status irigasi. Kondisi valve fisik tidak diketahui selama node terputus.
DISCONNECTED_DECISION = {
    "type": "disconnected",
    "decision": "Terputus",
    "valve_state": "unknown",
    "reason": "Tidak ada data dari node melewati batas waktu. Sistem menunggu data sensor terbaru.",
}


# Keputusan untuk kebun mode manual. valve_state mengikuti perintah terakhir pengguna,
# bukan hitungan kelembapan.
MANUAL_DECISIONS = {
    "manual_open": {
        "type": "manual_open",
        "decision": "Manual: valve dibuka",
        "valve_state": "open",
        "reason": "Valve terbuka, dikendalikan manual oleh pengguna.",
    },
    "manual_closed": {
        "type": "manual_closed",
        "decision": "Manual: valve ditutup",
        "valve_state": "closed",
        "reason": "Valve tertutup, dikendalikan manual oleh pengguna.",
    },
    "manual_timeout": {
        "type": "manual_timeout",
        "decision": "Manual: ditutup otomatis",
        "valve_state": "closed",
        "reason": "Valve ditutup otomatis setelah batas waktu pengairan manual.",
    },
    "manual_saturated": {
        "type": "manual_saturated",
        "decision": "Manual: ditutup, tanah jenuh",
        "valve_state": "closed",
        "reason": "Valve ditutup otomatis karena tanah sudah jenuh air.",
    },
}


def manual_decision(node: dict) -> dict:
    key = "manual_open" if node.get("valve_command") == "open" else "manual_closed"
    return dict(MANUAL_DECISIONS[key])


def calculate_decision(
    soil_moisture: float,
    rain_next_3h: bool,
    thresholds: ThresholdConfig = DEFAULT_THRESHOLDS,
) -> dict:
    if soil_moisture < thresholds.lower and rain_next_3h:
        return {
            "type": "delayed",
            "decision": "Irigasi ditunda",
            "valve_state": "closed",
            "reason": "Kelembapan rendah, tetapi BMKG memprediksi hujan dalam 3 jam ke depan.",
        }

    if soil_moisture < thresholds.lower:
        return {
            "type": "open",
            "decision": "Irigasi aktif",
            "valve_state": "open",
            "reason": "Kelembapan tanah berada di bawah threshold bawah dan tidak ada prediksi hujan.",
        }

    if soil_moisture > thresholds.upper:
        return {
            "type": "closed",
            "decision": "Irigasi berhenti",
            "valve_state": "closed",
            "reason": "Kelembapan tanah sudah melewati threshold atas.",
        }

    return {
        "type": "standby",
        "decision": "Standby",
        "valve_state": "closed",
        "reason": "Kelembapan tanah berada pada rentang aman.",
    }


# Siram bertahap mode otomatis. Tiap pulsa memakai keputusan "open" calculate_decision.
OPEN_DECISION = calculate_decision(float("-inf"), False)

AUTO_DECISIONS = {
    "soaking": {
        "type": "soaking",
        "decision": "Menunggu air meresap",
        "valve_state": "closed",
        "reason": "Valve ditutup sebentar supaya air meresap sebelum kelembapan dicek lagi.",
    },
    "pulse_limit": {
        "type": "pulse_limit",
        "decision": "Batas pulsa tercapai",
        "valve_state": "closed",
        "reason": "Tanah belum cukup basah setelah batas pulsa. Cek debit air, pipa, atau sensor.",
    },
    "check_irrigation": {
        "type": "check_irrigation",
        "decision": "Periksa penyiraman",
        "valve_state": "closed",
        "reason": "Kelembapan belum naik setelah penyiraman.",
    },
}


def auto_decision(
    soil_moisture: float,
    rain_next_3h: bool,
    thresholds: ThresholdConfig,
    node: dict,
    now: datetime,
    reported_valve: str | None = None,
    advance_after_soak: bool = True,
) -> tuple[dict, dict]:
    """Keputusan mode otomatis dengan ingatan siklus siram di kolom node.

    Kembalikan (decision, state). state = kolom node yang harus diubah, kosong kalau tidak ada.
    """
    now_text = now.strftime("%Y-%m-%d %H:%M:%S")
    reset = {
        "auto_pulse_count": 0,
        "auto_pulse_started_at": None,
        "auto_cycle_baseline": None,
        "auto_confirmed_pulse_count": 0,
    }
    if node.get("auto_paused_at"):
        return dict(AUTO_DECISIONS["check_irrigation"]), {}
    target = thresholds.upper - settings.auto_target_margin
    emergency = thresholds.lower - settings.rain_emergency_margin
    rain_blocks = rain_next_3h and soil_moisture >= emergency
    pulse_count = node["auto_pulse_count"]

    if pulse_count > 0:
        if soil_moisture >= target:
            return calculate_decision(soil_moisture, False, thresholds), reset
        if rain_blocks:
            return calculate_decision(soil_moisture, True, thresholds), reset
        # Waktu mulai kosong atau rusak dianggap sekarang, supaya reading dan summary tidak error.
        pulse_end = (_parse_db_time(node["auto_pulse_started_at"]) or now) + timedelta(
            minutes=settings.auto_pulse_minutes
        )
        confirmed_count = node.get("auto_confirmed_pulse_count", 0)
        confirmation = {}
        if reported_valve == "open" and now < pulse_end and confirmed_count == pulse_count - 1:
            confirmed_count += 1
            confirmation = {"auto_confirmed_pulse_count": confirmed_count}
        if now < pulse_end:
            return dict(OPEN_DECISION), confirmation
        if now < pulse_end + timedelta(minutes=settings.auto_soak_minutes):
            return dict(AUTO_DECISIONS["soaking"]), confirmation
        if not advance_after_soak:
            return dict(AUTO_DECISIONS["soaking"]), {}
        if (
            pulse_count == settings.auto_no_rise_pulses
            and confirmed_count == pulse_count
            and node.get("auto_cycle_baseline") is not None
            and soil_moisture <= node["auto_cycle_baseline"]
        ):
            return dict(AUTO_DECISIONS["check_irrigation"]), {**reset, "auto_paused_at": now_text}
        if pulse_count >= settings.auto_max_pulses:
            return dict(AUTO_DECISIONS["pulse_limit"]), {**reset, "auto_limit_at": now_text}
        return dict(OPEN_DECISION), {
            **confirmation,
            "auto_pulse_count": pulse_count + 1,
            "auto_pulse_started_at": now_text,
        }

    if soil_moisture >= thresholds.lower:
        return calculate_decision(soil_moisture, False, thresholds), {}
    # Jeda setelah batas pulsa sengaja menang atas kondisi darurat, supaya sensor rusak
    # yang terbaca sangat kering tidak membuat valve menyiram terus.
    limit_at = _parse_db_time(node["auto_limit_at"])
    if limit_at and now < limit_at + timedelta(hours=settings.auto_limit_cooldown_hours):
        return dict(AUTO_DECISIONS["pulse_limit"]), {}
    if rain_blocks:
        return calculate_decision(soil_moisture, True, thresholds), {}
    return dict(OPEN_DECISION), {
        "auto_pulse_count": 1,
        "auto_pulse_started_at": now_text,
        "auto_cycle_baseline": soil_moisture,
        "auto_confirmed_pulse_count": 0,
    }
