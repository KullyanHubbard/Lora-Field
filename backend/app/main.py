import json
import uuid
import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .database import get_connection, init_db, row_to_dict
from .schemas import FarmCreate, NodeLocationUpdate, SensorReadingIn, ThresholdConfig


THRESHOLDS = ThresholdConfig()
BMKG_FORECAST_URL = "https://api.bmkg.go.id/publik/prakiraan-cuaca"
RAIN_KEYWORDS = ("hujan", "rain", "shower", "thunderstorm")
WEATHER_CACHE_TTL_MINUTES = 30

app = FastAPI(
    title="LoraField Backend",
    description="API untuk dashboard monitoring pertanian LoraField.",
    version="1.3.0",
)

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
# Farm endpoints
# ---------------------------------------------------------------------------

@app.get("/api/farms")
def list_farms(user_id: str = Query(..., min_length=1, description="ID user pemilik kebun")) -> dict:
    with get_connection() as connection:
        farms = [
            dict(row)
            for row in connection.execute(
                "SELECT * FROM farms WHERE user_id = ? ORDER BY name",
                (user_id,),
            ).fetchall()
        ]
    return {"items": farms, "total": len(farms)}


@app.get("/api/farms/{farm_id}")
def get_farm(farm_id: str) -> dict:
    with get_connection() as connection:
        farm = row_to_dict(
            connection.execute("SELECT * FROM farms WHERE id = ?", (farm_id,)).fetchone()
        )
    if farm is None:
        raise HTTPException(status_code=404, detail="Kebun tidak ditemukan")
    return farm


@app.post("/api/farms", status_code=201)
def create_farm(payload: FarmCreate) -> dict:
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
                payload.user_id,
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
def get_farm_weather(farm_id: str) -> dict:
    with get_connection() as connection:
        farm = row_to_dict(
            connection.execute("SELECT * FROM farms WHERE id = ?", (farm_id,)).fetchone()
        )
    if farm is None:
        raise HTTPException(status_code=404, detail="Kebun tidak ditemukan")
    return fetch_weather_with_cache(farm["bmkg_adm4_code"])


@app.get("/api/farms/{farm_id}/summary")
def get_farm_summary(farm_id: str) -> dict:
    with get_connection() as connection:
        farm = row_to_dict(
            connection.execute("SELECT * FROM farms WHERE id = ?", (farm_id,)).fetchone()
        )
        if farm is None:
            raise HTTPException(status_code=404, detail="Kebun tidak ditemukan")
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
