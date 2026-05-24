import json
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated

import httpx
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .auth import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from .database import get_connection, init_db, row_to_dict
from .schemas import (
    FarmCreate,
    NodeLocationUpdate,
    SensorReadingIn,
    ThresholdConfig,
    TokenResponse,
    ForgotPasswordRequest,
    ResetCodeVerifyRequest,
    ResetPasswordRequest,
    ResendVerificationRequest,
    UserLogin,
    UserPublic,
    UserRegister,
)
from .config import settings


THRESHOLDS = ThresholdConfig()
BMKG_FORECAST_URL = "https://api.bmkg.go.id/publik/prakiraan-cuaca"
RAIN_KEYWORDS = ("hujan", "rain", "shower", "thunderstorm")
WEATHER_CACHE_TTL_MINUTES = 30
RESET_TOKEN_EXPIRE_MINUTES = 30

app = FastAPI(
    title="LoraField Backend",
    description="API untuk dashboard monitoring pertanian LoraField.",
    version="1.3.0",
)

FRONTEND_STATIC_DIR = Path(__file__).resolve().parents[2] / "frontend" / "public" / "static"
if FRONTEND_STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_STATIC_DIR)), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:5501",
        "http://localhost:5501",
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


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

    return {
        "provider": "BMKG",
        "adm4": adm4,
        "location": location.get("desa") or location.get("kotkab") or adm4,
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

@app.get("/")
def root() -> dict:
    return {
        "service": "LoraField Backend",
        "version": "1.3.0",
        "status": "ready",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------

@app.post("/api/auth/register", response_model=UserPublic, status_code=201)
def register(payload: UserRegister) -> dict:
    email = payload.email.lower().strip()
    with get_connection() as connection:
        existing = connection.execute(
            "SELECT id FROM users WHERE email = ?", (email,)
        ).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="Email sudah terdaftar.")

        user_id = f"user-{uuid.uuid4().hex[:12]}"
        connection.execute(
            """
            INSERT INTO users (id, email, name, password_hash)
            VALUES (?, ?, ?, ?)
            """,
            (user_id, email, payload.name.strip(), hash_password(payload.password)),
        )

    return {"id": user_id, "email": email, "name": payload.name.strip()}


@app.post("/api/auth/login", response_model=TokenResponse)
def login(payload: UserLogin) -> dict:
    email = payload.email.lower().strip()
    with get_connection() as connection:
        row = connection.execute(
            "SELECT id, email, name, password_hash FROM users WHERE email = ?",
            (email,),
        ).fetchone()

    user = row_to_dict(row)
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email atau password salah.")

    token = create_access_token(subject=user["id"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user["id"], "email": user["email"], "name": user["name"]},
    }


@app.get("/api/auth/me", response_model=UserPublic)
def get_me(current_user: Annotated[dict, Depends(get_current_user)]) -> dict:
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "name": current_user["name"],
    }


@app.post("/api/auth/forgot-password")
def forgot_password(payload: ForgotPasswordRequest) -> dict:
    email = payload.email.lower().strip()
    with get_connection() as connection:
        user = row_to_dict(
            connection.execute(
                "SELECT id, email, name FROM users WHERE email = ?",
                (email,),
            ).fetchone()
        )

        # Jangan bocorkan apakah email ada/tidak.
        if user is None:
            return {"message": "Jika email terdaftar, tautan reset password akan dikirim."}

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
    reset_link = f"{frontend_base}/reset-password.html"
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
    # Dev-friendly fallback jika Resend belum dikonfigurasi.
    if not email_sent:
        response["reset_token"] = reset_token
        response["note"] = "Email provider belum aktif. Gunakan kode reset ini untuk pengujian."
    return response


@app.post("/api/auth/reset-password")
def reset_password(payload: ResetPasswordRequest) -> dict:
    token = payload.token.strip()
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

    return {"message": "Password berhasil diperbarui."}


@app.post("/api/auth/reset-password/verify")
def verify_reset_code(payload: ResetCodeVerifyRequest) -> dict:
    token = payload.token.strip()
    with get_connection() as connection:
        get_active_reset_row(connection, token)
    return {"message": "Kode reset valid."}


@app.post("/api/auth/resend-verification")
def resend_verification(payload: ResendVerificationRequest) -> dict:
    email = payload.email.lower().strip()
    with get_connection() as connection:
        user = row_to_dict(
            connection.execute(
                "SELECT id, email, name FROM users WHERE email = ?",
                (email,),
            ).fetchone()
        )

    if user is None:
        return {"message": "Jika email terdaftar, email verifikasi akan dikirim."}

    verify_token = secrets.token_urlsafe(24)
    frontend_base = settings.frontend_url.rstrip("/")
    verify_link = f"{frontend_base}/login.html?verify_token={verify_token}"
    email_html = (
        "<p>Halo,</p>"
        "<p>Berikut tautan verifikasi akun LoraField Anda:</p>"
        f"<p><a href=\"{verify_link}\">{verify_link}</a></p>"
    )

    email_sent = False
    try:
        email_sent = send_email_via_resend(user["email"], "Verifikasi Akun LoraField", email_html)
    except Exception:
        email_sent = False

    response = {"message": "Jika email terdaftar, email verifikasi akan dikirim."}
    if not email_sent:
        response["verify_token"] = verify_token
        response["note"] = "Email provider belum aktif. Ini token verifikasi untuk pengujian."
    return response


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
        return _get_farm_owned(connection, farm_id, current_user["id"])


@app.post("/api/farms", status_code=201)
def create_farm(
    payload: FarmCreate,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
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
                payload.bmkg_adm4_code,
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

    try:
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
# Node endpoints
# ---------------------------------------------------------------------------

@app.get("/api/nodes")
def list_nodes(farm_id: str | None = Query(default=None, description="Filter node berdasarkan kebun")) -> dict:
    with get_connection() as connection:
        if farm_id is not None:
            nodes = [
                dict(row)
                for row in connection.execute(
                    "SELECT * FROM nodes WHERE farm_id = ? ORDER BY id",
                    (farm_id,),
                ).fetchall()
            ]
        else:
            nodes = [dict(row) for row in connection.execute("SELECT * FROM nodes ORDER BY id")]
    return {"items": nodes}


@app.patch("/api/nodes/{node_id}/location")
def update_node_location(node_id: str, payload: NodeLocationUpdate) -> dict:
    with get_connection() as connection:
        cursor = connection.execute(
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
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Node tidak ditemukan")

        node = row_to_dict(
            connection.execute("SELECT * FROM nodes WHERE id = ?", (node_id,)).fetchone()
        )
    return {"node": node}


@app.get("/api/nodes/{node_id}/readings")
def list_readings(node_id: str, limit: int = Query(default=20, ge=1, le=100)) -> dict:
    with get_connection() as connection:
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
    adm4: str = Query(..., min_length=2, description="Kode wilayah adm4 BMKG"),
) -> dict:
    weather = fetch_weather_with_cache(adm4)
    decision = calculate_decision(payload.soil_moisture, weather["rain_next_3h"])

    with get_connection() as connection:
        node = connection.execute("SELECT id FROM nodes WHERE id = ?", (node_id,)).fetchone()
        if node is None:
            raise HTTPException(status_code=404, detail="Node tidak ditemukan")

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
# Weather (debug/test endpoint)
# ---------------------------------------------------------------------------

@app.get("/api/weather")
def get_weather(adm4: str = Query(..., min_length=2, description="Kode wilayah adm4 BMKG")) -> dict:
    return fetch_bmkg_weather(adm4)


# ---------------------------------------------------------------------------
# Legacy summary (backward compatible)
# ---------------------------------------------------------------------------

@app.get("/api/summary")
def get_summary(adm4: str = Query(..., min_length=2, description="Kode wilayah adm4 BMKG")) -> dict:
    with get_connection() as connection:
        node = row_to_dict(connection.execute("SELECT * FROM nodes LIMIT 1").fetchone())
    if node is None:
        raise HTTPException(status_code=404, detail="Node belum tersedia")

    weather = fetch_weather_with_cache(adm4)
    reading = get_latest_reading(node["id"])
    decision = calculate_decision(reading["soil_moisture"], weather["rain_next_3h"])

    return {
        "node": node,
        "latest_reading": reading,
        "weather": weather,
        "thresholds": THRESHOLDS.model_dump(),
        "decision": decision,
    }


# ---------------------------------------------------------------------------
# Decision simulator & logs
# ---------------------------------------------------------------------------

@app.get("/api/decision")
def get_decision(
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
def list_logs(limit: int = Query(default=20, ge=1, le=100)) -> dict:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT * FROM decision_logs
            ORDER BY created_at DESC, id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return {"items": [dict(row) for row in rows]}
