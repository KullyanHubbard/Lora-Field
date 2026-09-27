"""Keputusan irigasi: threshold VWC dan aturan buka/tutup valve."""

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
