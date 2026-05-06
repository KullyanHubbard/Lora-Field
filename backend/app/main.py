from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .database import get_connection, init_db, row_to_dict
from .schemas import NodeLocationUpdate, SensorReadingIn, ThresholdConfig, WeatherUpdate


THRESHOLDS = ThresholdConfig()

app = FastAPI(
    title="LoraField Backend",
    description="Basic API untuk dashboard LoraField.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
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


def get_latest_weather() -> dict:
    with get_connection() as connection:
        weather = row_to_dict(connection.execute("SELECT * FROM weather WHERE id = 1").fetchone())
    if weather is None:
        raise HTTPException(status_code=404, detail="Weather data belum tersedia")
    weather["rain_next_3h"] = bool(weather["rain_next_3h"])
    return weather


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


@app.get("/")
def root() -> dict:
    return {
        "service": "LoraField Backend",
        "status": "ready",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/summary")
def get_summary() -> dict:
    with get_connection() as connection:
        node = row_to_dict(connection.execute("SELECT * FROM nodes LIMIT 1").fetchone())
    if node is None:
        raise HTTPException(status_code=404, detail="Node belum tersedia")

    weather = get_latest_weather()
    reading = get_latest_reading(node["id"])
    decision = calculate_decision(reading["soil_moisture"], weather["rain_next_3h"])

    return {
        "node": node,
        "latest_reading": reading,
        "weather": weather,
        "thresholds": THRESHOLDS.model_dump(),
        "decision": decision,
    }


@app.get("/api/nodes")
def list_nodes() -> dict:
    with get_connection() as connection:
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
def create_reading(node_id: str, payload: SensorReadingIn) -> dict:
    weather = get_latest_weather()
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


@app.get("/api/weather")
def get_weather() -> dict:
    return get_latest_weather()


@app.put("/api/weather")
def update_weather(payload: WeatherUpdate) -> dict:
    with get_connection() as connection:
        connection.execute(
            """
            UPDATE weather
            SET location = ?,
                condition = ?,
                code = ?,
                temperature = ?,
                humidity = ?,
                rain_next_3h = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = 1
            """,
            (
                payload.location,
                payload.condition,
                payload.code,
                payload.temperature,
                payload.humidity,
                int(payload.rain_next_3h),
            ),
        )
    return get_latest_weather()


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
