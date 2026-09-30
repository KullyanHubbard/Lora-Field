"""Daftar jenis tanaman dan threshold VWC-nya, sumber data untuk GET /api/crops."""

from .schemas import ThresholdConfig

# Threshold VWC per jenis tanaman (FAO Irrigation Paper No. 56, adaptasi lokal)
CROP_THRESHOLDS: list[dict] = [
    {"name": "Padi",          "lower_threshold": 60, "upper_threshold": 80},
    {"name": "Jagung",        "lower_threshold": 50, "upper_threshold": 75},
    {"name": "Kedelai",       "lower_threshold": 55, "upper_threshold": 75},
    {"name": "Kacang Tanah",  "lower_threshold": 50, "upper_threshold": 70},
    {"name": "Kacang Hijau",  "lower_threshold": 50, "upper_threshold": 70},
    {"name": "Cabai",         "lower_threshold": 60, "upper_threshold": 80},
    {"name": "Tomat",         "lower_threshold": 60, "upper_threshold": 80},
    {"name": "Terong",        "lower_threshold": 55, "upper_threshold": 75},
    {"name": "Timun",         "lower_threshold": 60, "upper_threshold": 80},
    {"name": "Bawang Merah",  "lower_threshold": 65, "upper_threshold": 85},
    {"name": "Bawang Putih",  "lower_threshold": 65, "upper_threshold": 85},
    {"name": "Kentang",       "lower_threshold": 65, "upper_threshold": 85},
    {"name": "Wortel",        "lower_threshold": 60, "upper_threshold": 80},
    {"name": "Bayam",         "lower_threshold": 65, "upper_threshold": 85},
    {"name": "Kangkung",      "lower_threshold": 65, "upper_threshold": 85},
    {"name": "Sawi",          "lower_threshold": 65, "upper_threshold": 85},
    {"name": "Ubi Jalar",     "lower_threshold": 55, "upper_threshold": 75},
    {"name": "Singkong",      "lower_threshold": 45, "upper_threshold": 65},
    {"name": "Salak",         "lower_threshold": 55, "upper_threshold": 75},
    {"name": "Pisang",        "lower_threshold": 60, "upper_threshold": 80},
    {"name": "Mangga",        "lower_threshold": 50, "upper_threshold": 70},
    {"name": "Pepaya",        "lower_threshold": 60, "upper_threshold": 80},
    {"name": "Semangka",      "lower_threshold": 55, "upper_threshold": 75},
    {"name": "Melon",         "lower_threshold": 60, "upper_threshold": 80},
    {"name": "Tembakau",      "lower_threshold": 50, "upper_threshold": 70},
    {"name": "Tebu",          "lower_threshold": 60, "upper_threshold": 80},
    {"name": "Teh",           "lower_threshold": 55, "upper_threshold": 75},
    {"name": "Kopi",          "lower_threshold": 45, "upper_threshold": 65},
    {"name": "Kakao",         "lower_threshold": 55, "upper_threshold": 75},
    {"name": "Kelapa Sawit",  "lower_threshold": 50, "upper_threshold": 75},
]


def is_rice(crop_type: str | None) -> bool:
    """Padi butuh genangan air yang tidak terukur sensor kelembapan tanah."""
    return (crop_type or "").strip().lower() == "padi"


def find_crop_thresholds(crop_type: str | None) -> ThresholdConfig | None:
    """Threshold VWC untuk nama tanaman (tidak peka huruf besar), None kalau tidak dikenal."""
    key = (crop_type or "").strip().lower()
    for crop in CROP_THRESHOLDS:
        if crop["name"].lower() == key:
            return ThresholdConfig(lower=crop["lower_threshold"], upper=crop["upper_threshold"])
    return None
