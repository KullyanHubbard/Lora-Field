import json
import logging
import re
import secrets
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Annotated

import httpx
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles


# ---------------------------------------------------------------------------
# Logging — rotating file + console. Dipanggil sebelum app routes didefinisikan.
# ---------------------------------------------------------------------------

LOG_DIR = Path(__file__).resolve().parents[1] / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

_log_format = logging.Formatter(
    fmt="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
_file_handler = RotatingFileHandler(
    LOG_DIR / "app.log",
    maxBytes=10 * 1024 * 1024,  # 10 MB per file
    backupCount=5,
    encoding="utf-8",
)
_file_handler.setFormatter(_log_format)
_file_handler.setLevel(logging.INFO)

_console_handler = logging.StreamHandler()
_console_handler.setFormatter(_log_format)
_console_handler.setLevel(logging.INFO)

logging.basicConfig(level=logging.INFO, handlers=[_file_handler, _console_handler], force=True)

logger = logging.getLogger("lorafield")

from .auth import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from .database import get_connection, init_db, row_to_dict
from .wilayah_resolver import resolve_adm4_from_freetext, resolve_adm4_from_region_names
from .schemas import (
    FarmCreate,
    FarmUpdate,
    GatewayLogIn,
    GatewayRegisterPayload,
    GatewayRegisterResponse,
    NodeLocationUpdate,
    RegisteredNode,
    SensorReadingIn,
    ThresholdConfig,
    TokenResponse,
    ChangePasswordRequest,
    UpdateProfileRequest,
    ForgotPasswordRequest,
    ResetCodeVerifyRequest,
    ResetPasswordRequest,
    UserLogin,
    UserPublic,
    UserRegister,
)
from .config import settings


THRESHOLDS = ThresholdConfig()
BMKG_FORECAST_URL = "https://api.bmkg.go.id/publik/prakiraan-cuaca"

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
RAIN_KEYWORDS = ("hujan", "rain", "shower", "thunderstorm")
WEATHER_CACHE_TTL_MINUTES = 30
RESET_TOKEN_EXPIRE_MINUTES = 30
ADM4_PATTERN = re.compile(r"^\d{2}\.\d{2}\.\d{2}\.\d{4}$")
LOCAL_ADM4_ALIASES = {
    ("balecatur", "gamping", "sleman"): "34.04.01.2001",
    ("gejawan kulon", "balecatur", "gamping", "sleman"): "34.04.01.2001",
    ("ambarketawang", "gamping", "sleman"): "34.04.01.2002",
    ("banyuraden", "gamping", "sleman"): "34.04.01.2003",
    ("nogotirto", "gamping", "sleman"): "34.04.01.2004",
    ("trihanggo", "gamping", "sleman"): "34.04.01.2005",
    ("sinduharjo", "ngaglik", "sleman"): "34.04.12.2003",
}

app = FastAPI(
    title="LoraField Backend",
    description="API untuk dashboard monitoring pertanian LoraField.",
    version="1.3.0",
)

FRONTEND_DIST_DIR = Path(__file__).resolve().parents[2] / "frontend" / "dist"

# Frontend tunggal: React/Vite build (frontend/dist/) — sumber asset + index.html.
# Vite menaruh asset di dist/assets/ (mount /assets). dist/static opsional (mount kalau ada).
if FRONTEND_DIST_DIR.exists():
    dist_assets = FRONTEND_DIST_DIR / "assets"
    if dist_assets.exists():
        app.mount("/assets", StaticFiles(directory=str(dist_assets)), name="dist-assets")
    dist_static = FRONTEND_DIST_DIR / "static"
    if dist_static.exists():
        app.mount("/static", StaticFiles(directory=str(dist_static)), name="dist-static")

_DEV_ORIGINS = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "http://127.0.0.1:5501",
    "http://localhost:5501",
    "http://127.0.0.1:5173",
    "http://localhost:5173",
]
_extra_origins = [o.strip() for o in settings.allowed_origins.split(",") if o.strip()]
_CORS_ORIGINS = list(dict.fromkeys(_DEV_ORIGINS + _extra_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.on_event("startup")
def on_startup() -> None:
    if not settings.jwt_secret_key:
        raise RuntimeError(
            "JWT_SECRET_KEY tidak dikonfigurasi. "
            "Tambahkan JWT_SECRET_KEY ke file .env sebelum menjalankan server."
        )
    init_db()
    logger.info(
        "LoraField backend startup — dist_dir=%s cors_origins=%d",
        FRONTEND_DIST_DIR.exists(),
        len(_CORS_ORIGINS),
    )


def _client_ip(request: Request) -> str:
    """Ambil IP klien sebenarnya. Kalau di belakang Cloudflare Tunnel, pakai
    header CF-Connecting-IP. Fallback ke X-Forwarded-For atau remote_addr."""
    cf = request.headers.get("CF-Connecting-IP")
    if cf:
        return cf
    xff = request.headers.get("X-Forwarded-For", "")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all untuk error tak terduga. Log full traceback, return generic 500
    ke client supaya tidak bocor stack trace."""
    logger.exception(
        "Unhandled exception | %s %s | ip=%s",
        request.method,
        request.url.path,
        _client_ip(request),
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Terjadi kesalahan internal. Tim kami sudah dinotifikasi."},
    )


# ---------------------------------------------------------------------------
# Decision logic
# ---------------------------------------------------------------------------

def calculate_decision(soil_moisture: float, rain_next_3h: bool) -> dict:
    if soil_moisture < THRESHOLDS.lower and rain_next_3h:
        return {
            "type": "delayed",
            "decision": "Irigasi ditunda",
            "valve_state": "closed",
            "reason": "Kelembapan rendah, tetapi BMKG memprediksi hujan dalam 3 jam ke depan.",
        }

    if soil_moisture < THRESHOLDS.lower:
        return {
            "type": "open",
            "decision": "Irigasi aktif",
            "valve_state": "open",
            "reason": "Kelembapan tanah berada di bawah threshold bawah dan tidak ada prediksi hujan.",
        }

    if soil_moisture > THRESHOLDS.upper:
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


# ---------------------------------------------------------------------------
# BMKG helpers
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Weather cache (SQLite, TTL 30 menit per adm4)
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Node helpers
# ---------------------------------------------------------------------------

def get_latest_reading(node_id: str) -> dict:
    with get_connection() as connection:
        reading = row_to_dict(
            connection.execute(
                """
                SELECT * FROM readings
                WHERE node_id = ?
                ORDER BY created_at DESC, id DESC
                LIMIT 1
                """,
                (node_id,),
            ).fetchone()
        )
    if reading is None:
        raise HTTPException(status_code=404, detail="Reading node belum tersedia")
    return reading


def send_email_via_resend(to_email: str, subject: str, html: str) -> bool:
    if not settings.resend_api_key:
        return False

    payload = {
        "from": settings.resend_from_email,
        "to": [to_email],
        "subject": subject,
        "html": html,
    }
    headers = {
        "Authorization": f"Bearer {settings.resend_api_key}",
        "Content-Type": "application/json",
    }
    with httpx.Client(timeout=15) as client:
        response = client.post("https://api.resend.com/emails", headers=headers, json=payload)
        response.raise_for_status()
    return True


def generate_reset_code(connection) -> str:
    # 6 digit OTP, ulangi jika kebetulan bentrok dengan token lain yang masih ada.
    for _ in range(20):
        code = f"{secrets.randbelow(1_000_000):06d}"
        exists = connection.execute(
            "SELECT 1 FROM password_resets WHERE token = ? LIMIT 1",
            (code,),
        ).fetchone()
        if not exists:
            return code
    raise HTTPException(status_code=500, detail="Gagal membuat token reset. Silakan coba lagi.")


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

        # Fallback: OSM tak punya tag kode BPS di titik ini. Pakai nama wilayah
        # resmi hasil reverse-geocode (bukan alamat ketikan user) lalu cocokkan
        # ke daftar Kemendagri offline. Field Nominatim Indonesia bervariasi,
        # jadi kirim beberapa kandidat per level; matcher menyempitkan sendiri.
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
    except Exception:
        pass

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


def get_active_reset_row(connection, token: str) -> dict:
    now_iso = datetime.now(timezone.utc).isoformat()
    reset_row = row_to_dict(
        connection.execute(
            """
            SELECT id, user_id, token, expires_at, used
            FROM password_resets
            WHERE token = ?
            """,
            (token,),
        ).fetchone()
    )
    if reset_row is None:
        raise HTTPException(status_code=400, detail="Kode reset tidak valid.")
    if int(reset_row["used"]) == 1:
        raise HTTPException(status_code=400, detail="Kode reset sudah digunakan.")
    if str(reset_row["expires_at"]) <= now_iso:
        raise HTTPException(status_code=400, detail="Kode reset sudah kedaluwarsa.")
    return reset_row


# ---------------------------------------------------------------------------
# Root & health
# ---------------------------------------------------------------------------

def _serve_react_index() -> FileResponse | None:
    if not FRONTEND_DIST_DIR.exists():
        return None
    index_path = FRONTEND_DIST_DIR / "index.html"
    if not index_path.exists():
        return None
    return FileResponse(index_path)


@app.get("/")
def root():
    react_index = _serve_react_index()
    if react_index is not None:
        return react_index
    return {"service": "LoraField Backend", "status": "ready", "health": "/health"}


@app.get("/{page_name}.html")
def static_html_page(page_name: str):
    # Kompat URL lama berakhiran .html: arahkan ke React index (routing client-side).
    react_index = _serve_react_index()
    if react_index is not None:
        return react_index
    raise HTTPException(status_code=404, detail="Halaman tidak ditemukan")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/crops")
def list_crops(q: str = Query(default="", max_length=100)) -> dict:
    """Daftar jenis tanaman beserta threshold VWC yang disarankan."""
    results = CROP_THRESHOLDS
    if q:
        q_lower = q.lower()
        results = [c for c in CROP_THRESHOLDS if q_lower in c["name"].lower()]
    return {"crops": results}


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------

@app.post("/api/auth/register", response_model=UserPublic, status_code=201)
def register(payload: UserRegister, request: Request) -> dict:
    email = payload.email.lower().strip()
    name = payload.name.strip()
    if len(name) < 2:
        raise HTTPException(status_code=422, detail="Nama minimal 2 karakter (tanpa spasi awal/akhir).")
    with get_connection() as connection:
        existing = connection.execute(
            "SELECT id FROM users WHERE email = ?", (email,)
        ).fetchone()
        if existing:
            logger.info("register | email-conflict | ip=%s email=%s", _client_ip(request), email)
            raise HTTPException(status_code=409, detail="Email sudah terdaftar.")

        user_id = f"user-{uuid.uuid4().hex[:12]}"
        try:
            connection.execute(
                """
                INSERT INTO users (id, email, name, password_hash)
                VALUES (?, ?, ?, ?)
                """,
                (user_id, email, name, hash_password(payload.password)),
            )
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=409, detail="Email sudah terdaftar.")

    logger.info("register | success | ip=%s email=%s user_id=%s", _client_ip(request), email, user_id)
    return {"id": user_id, "email": email, "name": name}


@app.post("/api/auth/login", response_model=TokenResponse)
def login(payload: UserLogin, request: Request) -> dict:
    email = payload.email.lower().strip()
    ip = _client_ip(request)
    with get_connection() as connection:
        row = connection.execute(
            "SELECT id, email, name, phone, password_hash FROM users WHERE email = ?",
            (email,),
        ).fetchone()

    user = row_to_dict(row)
    if not user or not verify_password(payload.password, user["password_hash"]):
        logger.warning("login | failed | ip=%s email=%s", ip, email)
        raise HTTPException(status_code=401, detail="Email atau password salah.")

    token = create_access_token(subject=user["id"])
    logger.info("login | success | ip=%s user_id=%s", ip, user["id"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "phone": user.get("phone") or "",
        },
    }


@app.get("/api/auth/me", response_model=UserPublic)
def get_me(current_user: Annotated[dict, Depends(get_current_user)]) -> dict:
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "name": current_user["name"],
        "phone": current_user.get("phone") or "",
    }


@app.post("/api/auth/change-password")
def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    ip = _client_ip(request)
    with get_connection() as connection:
        row = connection.execute(
            "SELECT password_hash FROM users WHERE id = ?",
            (current_user["id"],),
        ).fetchone()
        if not row or not verify_password(payload.current_password, row["password_hash"]):
            logger.warning("change-password | wrong-current | ip=%s user_id=%s", ip, current_user["id"])
            raise HTTPException(status_code=401, detail="Password saat ini salah.")
        if verify_password(payload.new_password, row["password_hash"]):
            raise HTTPException(status_code=422, detail="Password baru tidak boleh sama dengan password lama.")
        connection.execute(
            "UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (hash_password(payload.new_password), current_user["id"]),
        )
    logger.info("change-password | success | ip=%s user_id=%s", ip, current_user["id"])
    return {"message": "Password berhasil diperbarui."}


@app.patch("/api/auth/profile")
def update_profile(
    payload: UpdateProfileRequest,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    with get_connection() as connection:
        connection.execute(
            "UPDATE users SET phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (payload.phone.strip(), current_user["id"]),
        )
        user = row_to_dict(
            connection.execute("SELECT id, email, name, phone FROM users WHERE id = ?", (current_user["id"],)).fetchone()
        )
    return {"user": user}


@app.post("/api/auth/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, request: Request) -> dict:
    email = payload.email.lower().strip()
    ip = _client_ip(request)
    logger.info("forgot-password | request | ip=%s email=%s", ip, email)
    with get_connection() as connection:
        user = row_to_dict(
            connection.execute(
                "SELECT id, email, name FROM users WHERE email = ?",
                (email,),
            ).fetchone()
        )

        # Jangan bocorkan apakah email ada/tidak.
        if user is None:
            logger.info("forgot-password | unknown-email | ip=%s email=%s", ip, email)
            return {"message": "Jika email terdaftar, tautan reset password akan dikirim."}

        # Invalidate previous unused tokens for this user — hanya satu OTP aktif sekaligus.
        connection.execute(
            "UPDATE password_resets SET used = 1 WHERE user_id = ? AND used = 0",
            (user["id"],),
        )
        reset_token = generate_reset_code(connection)
        expires_at = (datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)).isoformat()
        connection.execute(
            """
            INSERT INTO password_resets (user_id, token, expires_at, used)
            VALUES (?, ?, ?, 0)
            """,
            (user["id"], reset_token, expires_at),
        )

    frontend_base = settings.frontend_url.rstrip("/")
    reset_link = f"{frontend_base}/reset-password"
    email_html = (
        "<div style='font-family:Arial,sans-serif;line-height:1.6;color:#111827'>"
        "<h2 style='margin:0 0 12px 0;font-size:20px'>Reset Password LoraField</h2>"
        "<p style='margin:0 0 12px 0'>Kami menerima permintaan untuk mengatur ulang password akun Anda.</p>"
        f"<p style='margin:0 0 12px 0'>Masa berlaku kode: <strong>{RESET_TOKEN_EXPIRE_MINUTES} menit</strong>.</p>"
        f"<p style='margin:0 0 14px 0'><a href=\"{reset_link}\" style='display:inline-block;padding:10px 14px;background:#10b981;color:#ffffff;text-decoration:none;border-radius:6px'>Buka Halaman Reset</a></p>"
        f"<p style='margin:0 0 8px 0'>Masukkan kode reset berikut secara manual di halaman reset password:</p>"
        f"<p style='margin:0 0 12px 0;font-family:monospace;font-size:14px;background:#f3f4f6;padding:8px 10px;border-radius:6px;display:inline-block'>{reset_token}</p>"
        "<p style='margin:0;color:#6b7280;font-size:13px'>Jika Anda tidak merasa melakukan permintaan ini, abaikan email ini.</p>"
        "</div>"
    )

    email_sent = False
    try:
        email_sent = send_email_via_resend(user["email"], "Reset Password LoraField", email_html)
    except Exception:
        email_sent = False

    response = {"message": "Jika email terdaftar, tautan reset password akan dikirim."}
    # Dev-friendly fallback jika Resend belum dikonfigurasi DAN flag dev aktif.
    if not email_sent and settings.expose_dev_tokens:
        response["reset_token"] = reset_token
        response["note"] = "Email provider belum aktif. Gunakan kode reset ini untuk pengujian."
    return response


@app.post("/api/auth/reset-password")
def reset_password(payload: ResetPasswordRequest, request: Request) -> dict:
    token = payload.token.strip()
    ip = _client_ip(request)
    with get_connection() as connection:
        reset_row = get_active_reset_row(connection, token)
        connection.execute(
            "UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (hash_password(payload.new_password), reset_row["user_id"]),
        )
        connection.execute(
            "UPDATE password_resets SET used = 1 WHERE id = ?",
            (reset_row["id"],),
        )

    logger.info("reset-password | success | ip=%s user_id=%s", ip, reset_row["user_id"])
    return {"message": "Password berhasil diperbarui."}


@app.post("/api/auth/reset-password/verify")
def verify_reset_code(payload: ResetCodeVerifyRequest) -> dict:
    token = payload.token.strip()
    with get_connection() as connection:
        get_active_reset_row(connection, token)
    return {"message": "Kode reset valid."}


# ---------------------------------------------------------------------------
# Farm endpoints
# ---------------------------------------------------------------------------

def _get_farm_owned(connection, farm_id: str, user_id: str) -> dict:
    """Ambil farm + verifikasi kepemilikan. Lempar 404 jika tidak ada atau bukan milik user."""
    farm = row_to_dict(
        connection.execute("SELECT * FROM farms WHERE id = ?", (farm_id,)).fetchone()
    )
    if farm is None or farm["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Kebun tidak ditemukan")
    return farm


def _get_node_owned(connection, node_id: str, user_id: str) -> dict:
    """Ambil node + verifikasi kepemilikan via farm.user_id."""
    node = row_to_dict(
        connection.execute("SELECT * FROM nodes WHERE id = ?", (node_id,)).fetchone()
    )
    if node is None:
        raise HTTPException(status_code=404, detail="Node tidak ditemukan")
    farm_id = node.get("farm_id")
    if not farm_id:
        raise HTTPException(status_code=404, detail="Node tidak ditemukan")
    _get_farm_owned(connection, farm_id, user_id)
    return node


@app.get("/api/farms")
def list_farms(current_user: Annotated[dict, Depends(get_current_user)]) -> dict:
    with get_connection() as connection:
        farms = [
            dict(row)
            for row in connection.execute(
                "SELECT * FROM farms WHERE user_id = ? ORDER BY name",
                (current_user["id"],),
            ).fetchall()
        ]
    return {"items": farms, "total": len(farms)}


@app.get("/api/farms/{farm_id}")
def get_farm(
    farm_id: str,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    with get_connection() as connection:
        farm = _get_farm_owned(connection, farm_id, current_user["id"])
    return {"farm": farm}


@app.patch("/api/farms/{farm_id}")
def update_farm(
    farm_id: str,
    payload: FarmUpdate,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    updates = payload.model_dump(exclude_unset=True)

    with get_connection() as connection:
        current_farm = _get_farm_owned(connection, farm_id, current_user["id"])
        if not updates:
            return {"farm": current_farm}

        if updates.get("name") is None and "name" in updates:
            raise HTTPException(status_code=422, detail="Nama kebun tidak boleh kosong.")

        for field in ("name", "owner", "location", "crop_type", "bmkg_adm4_code", "status"):
            if isinstance(updates.get(field), str):
                updates[field] = updates[field].strip()
            elif updates.get(field) is None and field in updates:
                updates[field] = "" if field != "status" else (current_farm.get("status") or "active")
        if updates.get("name") == "":
            raise HTTPException(status_code=422, detail="Nama kebun tidak boleh kosong.")

        lat = updates.get("latitude", current_farm.get("latitude"))
        lng = updates.get("longitude", current_farm.get("longitude"))
        coords_changed = "latitude" in updates or "longitude" in updates
        adm4_empty = not (updates.get("bmkg_adm4_code") or current_farm.get("bmkg_adm4_code"))
        if (coords_changed or adm4_empty) and not updates.get("bmkg_adm4_code") and lat is not None and lng is not None:
            location_hint = updates.get("location") or current_farm.get("location") or ""
            updates["bmkg_adm4_code"] = resolve_bmkg_adm4(lat, lng, location_hint)

        allowed_columns = {
            "name",
            "owner",
            "location",
            "crop_type",
            "area_ha",
            "bmkg_adm4_code",
            "latitude",
            "longitude",
            "status",
        }
        assignments = [f"{column} = ?" for column in updates if column in allowed_columns]
        values = [updates[column] for column in updates if column in allowed_columns]
        if assignments:
            assignments.append("updated_at = CURRENT_TIMESTAMP")
            connection.execute(
                f"UPDATE farms SET {', '.join(assignments)} WHERE id = ? AND user_id = ?",
                (*values, farm_id, current_user["id"]),
            )

        farm = row_to_dict(
            connection.execute("SELECT * FROM farms WHERE id = ?", (farm_id,)).fetchone()
        )
    return {"farm": farm}


@app.delete("/api/farms/{farm_id}", status_code=200)
def delete_farm(
    farm_id: str,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    with get_connection() as connection:
        _get_farm_owned(connection, farm_id, current_user["id"])
        connection.execute("DELETE FROM farms WHERE id = ?", (farm_id,))
    return {"message": "Kebun berhasil dihapus."}


@app.get("/api/utils/resolve-adm4")
def resolve_adm4(
    current_user: Annotated[dict, Depends(get_current_user)],
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    q: str = Query(default="", max_length=200),
) -> dict:
    """Resolve kode BMKG adm4 dari koordinat GPS."""
    adm4 = resolve_bmkg_adm4(lat, lon, q)
    return {"adm4": adm4, "found": bool(adm4)}


@app.post("/api/farms", status_code=201)
def create_farm(
    payload: FarmCreate,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    adm4 = payload.bmkg_adm4_code
    if not adm4 and payload.latitude is not None and payload.longitude is not None:
        # Best-effort resolve saat create. Kalau belum ketemu, kebun TETAP dibuat
        # dengan kode BMKG kosong; ensure_farm_bmkg_adm4() meng-resolve otomatis
        # tiap kali summary/cuaca kebun dimuat (auto-generate setelah buat kebun).
        adm4 = resolve_bmkg_adm4(payload.latitude, payload.longitude, payload.location)

    farm_id = f"farm-{uuid.uuid4().hex[:8]}"
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO farms
                (id, user_id, name, owner, location, crop_type, area_ha,
                 bmkg_adm4_code, latitude, longitude, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
            """,
            (
                farm_id,
                current_user["id"],
                payload.name,
                payload.owner,
                payload.location,
                payload.crop_type,
                payload.area_ha,
                adm4,
                payload.latitude,
                payload.longitude,
            ),
        )
        farm = row_to_dict(
            connection.execute("SELECT * FROM farms WHERE id = ?", (farm_id,)).fetchone()
        )
    return {"farm": farm}


@app.get("/api/farms/{farm_id}/weather")
def get_farm_weather(
    farm_id: str,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    with get_connection() as connection:
        farm = _get_farm_owned(connection, farm_id, current_user["id"])
    farm = ensure_farm_bmkg_adm4(farm)
    if not farm.get("bmkg_adm4_code"):
        raise HTTPException(status_code=422, detail="Kode BMKG kebun belum tersedia.")
    return fetch_weather_with_cache(farm["bmkg_adm4_code"])


@app.get("/api/farms/{farm_id}/summary")
def get_farm_summary(
    farm_id: str,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    with get_connection() as connection:
        farm = _get_farm_owned(connection, farm_id, current_user["id"])
        nodes = [
            dict(row)
            for row in connection.execute(
                "SELECT * FROM nodes WHERE farm_id = ? ORDER BY id",
                (farm_id,),
            ).fetchall()
        ]

    farm = ensure_farm_bmkg_adm4(farm)
    try:
        if not farm.get("bmkg_adm4_code"):
            raise HTTPException(status_code=422, detail="Kode BMKG kebun belum tersedia.")
        weather = fetch_weather_with_cache(farm["bmkg_adm4_code"])
    except HTTPException:
        weather = None

    rain_next_3h = weather["rain_next_3h"] if weather else False

    node_summaries = []
    for node in nodes:
        try:
            reading = get_latest_reading(node["id"])
            decision = calculate_decision(reading["soil_moisture"], rain_next_3h)
            node_summaries.append({"node": node, "latest_reading": reading, "decision": decision})
        except HTTPException:
            node_summaries.append({"node": node, "latest_reading": None, "decision": None})

    moistures = [
        ns["latest_reading"]["soil_moisture"]
        for ns in node_summaries
        if ns["latest_reading"] is not None
    ]
    avg_moisture = round(sum(moistures) / len(moistures), 2) if moistures else None

    nodes_online = [n for n in nodes if n["status"] == "online"]
    nodes_problem = [n for n in nodes if n["status"] == "offline"]
    gateway_status = "online" if nodes_online else "offline"

    return {
        "farm": farm,
        "weather": weather,
        "thresholds": THRESHOLDS.model_dump(),
        "gateway_status": gateway_status,
        "average_soil_moisture": avg_moisture,
        "nodes_total": len(nodes),
        "nodes_online": len(nodes_online),
        "nodes_problem": len(nodes_problem),
        "nodes": node_summaries,
    }


# ---------------------------------------------------------------------------
# Gateway connection logs
# CATATAN: belum ada integrasi hardware gateway. Tabel gateway_logs akan kosong
# sampai gateway/perangkat melapor via POST ini. Frontend harus menampilkan
# empty state jujur.
# ---------------------------------------------------------------------------

@app.get("/api/farms/{farm_id}/gateway-logs")
def list_gateway_logs(
    farm_id: str,
    current_user: Annotated[dict, Depends(get_current_user)],
    limit: int = Query(default=20, ge=1, le=100),
) -> dict:
    with get_connection() as connection:
        _get_farm_owned(connection, farm_id, current_user["id"])
        rows = connection.execute(
            """
            SELECT * FROM gateway_logs
            WHERE farm_id = ?
            ORDER BY created_at DESC, id DESC
            LIMIT ?
            """,
            (farm_id, limit),
        ).fetchall()
    items = [dict(row) for row in rows]
    return {"items": items, "total": len(items)}


@app.post("/api/farms/{farm_id}/gateway-logs", status_code=201)
def create_gateway_log(
    farm_id: str,
    payload: GatewayLogIn,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    with get_connection() as connection:
        _get_farm_owned(connection, farm_id, current_user["id"])
        cursor = connection.execute(
            "INSERT INTO gateway_logs (farm_id, event, detail) VALUES (?, ?, ?)",
            (farm_id, payload.event.strip(), payload.detail.strip()),
        )
        log = row_to_dict(
            connection.execute(
                "SELECT * FROM gateway_logs WHERE id = ?", (cursor.lastrowid,)
            ).fetchone()
        )
    return {"log": log}


# ---------------------------------------------------------------------------
# Auto Node Discovery - Gateway Registration
# ---------------------------------------------------------------------------

@app.post("/api/gateways/{gateway_id}/register", status_code=200)
def gateway_register_nodes(
    gateway_id: str,
    payload: GatewayRegisterPayload,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> GatewayRegisterResponse:
    """Batch register nodes via gateway.

    Gateway firmware calls this endpoint when it connects, providing
    the list of all node IDs it manages. Nodes are auto-created
    if they don't exist yet.
    """
    registered_nodes = []

    with get_connection() as connection:
        # Verify farm ownership
        farm = connection.execute(
            "SELECT * FROM farms WHERE id = ? AND user_id = ?",
            (payload.farm_id, current_user["id"])
        ).fetchone()

        if not farm:
            raise HTTPException(status_code=404, detail="Farm not found")

        for node_item in payload.nodes:
            # Check if node already exists
            existing = connection.execute(
                "SELECT * FROM nodes WHERE id = ?", (node_item.node_id,)
            ).fetchone()

            if existing:
                # Update gateway_id and status
                connection.execute(
                    """UPDATE nodes
                       SET gateway_id = ?, status = 'online', updated_at = CURRENT_TIMESTAMP
                       WHERE id = ?""",
                    (gateway_id, node_item.node_id)
                )
                registered_nodes.append(RegisteredNode(
                    id=node_item.node_id,
                    name=node_item.name,
                    status="active",
                    created=False
                ))
            else:
                # Create new node
                node_id = node_item.node_id
                connection.execute(
                    """INSERT INTO nodes
                       (id, farm_id, gateway_id, name, location, region,
                        latitude, longitude, status, battery, first_seen_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)""",
                    (
                        node_id,
                        payload.farm_id,
                        gateway_id,
                        node_item.name,
                        node_item.region,
                        node_item.region,
                        node_item.latitude,
                        node_item.longitude,
                        "online",
                        100,  # Default battery until actual reading
                    )
                )
                registered_nodes.append(RegisteredNode(
                    id=node_id,
                    name=node_item.name,
                    status="pending",
                    created=True
                ))

    return GatewayRegisterResponse(
        gateway_id=gateway_id,
        farm_id=payload.farm_id,
        status="registered",
        nodes=registered_nodes,
        created_count=sum(1 for n in registered_nodes if n.created)
    )


# ---------------------------------------------------------------------------
# Node endpoints
# ---------------------------------------------------------------------------

@app.get("/api/nodes")
def list_nodes(
    current_user: Annotated[dict, Depends(get_current_user)],
    farm_id: str | None = Query(default=None, description="Filter node berdasarkan kebun"),
) -> dict:
    with get_connection() as connection:
        if farm_id is not None:
            _get_farm_owned(connection, farm_id, current_user["id"])
            nodes = [
                dict(row)
                for row in connection.execute(
                    "SELECT * FROM nodes WHERE farm_id = ? ORDER BY id",
                    (farm_id,),
                ).fetchall()
            ]
        else:
            nodes = [
                dict(row)
                for row in connection.execute(
                    """
                    SELECT n.* FROM nodes n
                    JOIN farms f ON f.id = n.farm_id
                    WHERE f.user_id = ?
                    ORDER BY n.id
                    """,
                    (current_user["id"],),
                ).fetchall()
            ]
    return {"items": nodes, "total": len(nodes)}


@app.patch("/api/nodes/{node_id}/location")
def update_node_location(
    node_id: str,
    payload: NodeLocationUpdate,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    with get_connection() as connection:
        _get_node_owned(connection, node_id, current_user["id"])
        connection.execute(
            """
            UPDATE nodes
            SET location = ?,
                region = ?,
                latitude = ?,
                longitude = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (
                payload.location,
                payload.region,
                payload.latitude,
                payload.longitude,
                node_id,
            ),
        )
        node = row_to_dict(
            connection.execute("SELECT * FROM nodes WHERE id = ?", (node_id,)).fetchone()
        )
    return {"node": node}


@app.get("/api/nodes/{node_id}/readings")
def list_readings(
    node_id: str,
    current_user: Annotated[dict, Depends(get_current_user)],
    limit: int = Query(default=20, ge=1, le=100),
) -> dict:
    with get_connection() as connection:
        _get_node_owned(connection, node_id, current_user["id"])
        rows = connection.execute(
            """
            SELECT * FROM readings
            WHERE node_id = ?
            ORDER BY created_at DESC, id DESC
            LIMIT ?
            """,
            (node_id, limit),
        ).fetchall()
    return {"items": [dict(row) for row in rows]}


@app.post("/api/nodes/{node_id}/readings", status_code=201)
def create_reading(
    node_id: str,
    payload: SensorReadingIn,
    current_user: Annotated[dict, Depends(get_current_user)],
    adm4: str = Query(..., min_length=2, description="Kode wilayah adm4 BMKG"),
) -> dict:
    weather = fetch_weather_with_cache(adm4)
    decision = calculate_decision(payload.soil_moisture, weather["rain_next_3h"])

    with get_connection() as connection:
        _get_node_owned(connection, node_id, current_user["id"])

        cursor = connection.execute(
            """
            INSERT INTO readings (node_id, soil_moisture, soil_temp, air_temp, air_humidity)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                node_id,
                payload.soil_moisture,
                payload.soil_temp,
                payload.air_temp,
                payload.air_humidity,
            ),
        )
        reading_id = cursor.lastrowid
        connection.execute(
            """
            UPDATE nodes
            SET status = 'online', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (node_id,),
        )
        connection.execute(
            """
            INSERT INTO decision_logs
                (node_id, soil_moisture, weather, decision, valve_state, reason)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                node_id,
                payload.soil_moisture,
                weather["condition"],
                decision["decision"],
                decision["valve_state"],
                decision["reason"],
            ),
        )

    reading = payload.model_dump()
    reading["id"] = reading_id
    reading["node_id"] = node_id

    return {"reading": reading, "decision": decision}


# ---------------------------------------------------------------------------
# Weather (debug endpoint, requires auth)
# ---------------------------------------------------------------------------

@app.get("/api/weather")
def get_weather(
    current_user: Annotated[dict, Depends(get_current_user)],
    adm4: str = Query(..., min_length=2, description="Kode wilayah adm4 BMKG"),
) -> dict:
    return fetch_bmkg_weather(adm4)


# ---------------------------------------------------------------------------
# Decision simulator (stateless math, requires auth)
# ---------------------------------------------------------------------------

@app.get("/api/decision")
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


@app.get("/api/logs")
def list_logs(
    current_user: Annotated[dict, Depends(get_current_user)],
    limit: int = Query(default=20, ge=1, le=100),
) -> dict:
    """Decision logs hanya dari node-node milik user yang terotentikasi."""
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT dl.* FROM decision_logs dl
            JOIN nodes n ON n.id = dl.node_id
            JOIN farms f ON f.id = n.farm_id
            WHERE f.user_id = ?
            ORDER BY dl.created_at DESC, dl.id DESC
            LIMIT ?
            """,
            (current_user["id"], limit),
        ).fetchall()
    return {"items": [dict(row) for row in rows]}


# ---------------------------------------------------------------------------
# SPA fallback — HARUS PALING BAWAH (di-evaluasi terakhir oleh FastAPI).
# Semua route non-API non-asset diarahkan ke React Router via dist/index.html.
# ---------------------------------------------------------------------------

@app.get("/{full_path:path}", include_in_schema=False)
def spa_fallback(full_path: str):
    if full_path.startswith(("api/", "docs", "redoc", "openapi", "health")):
        raise HTTPException(status_code=404, detail="Not found")
    react_index = _serve_react_index()
    if react_index is not None:
        return react_index
    raise HTTPException(status_code=404, detail="Not found")
