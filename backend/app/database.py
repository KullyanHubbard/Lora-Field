from contextlib import contextmanager
from pathlib import Path
import sqlite3
from typing import Generator


BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "lorafield.db"


DEFAULT_NODES = [
    {
        "id": "node-01",
        "name": "Node 01",
        "location": "Lahan Padi Bantul",
        "region": "Bantul",
        "latitude": -7.8881,
        "longitude": 110.3289,
        "status": "online",
        "battery": 92,
        "reading": (38, 27.5, 30.2, 78),
    },
    {
        "id": "node-02",
        "name": "Node 02",
        "location": "Kebun Salak Sleman",
        "region": "Sleman",
        "latitude": -7.6528,
        "longitude": 110.4207,
        "status": "standby",
        "battery": 86,
        "reading": (55, 26.8, 29.7, 75),
    },
    {
        "id": "node-03",
        "name": "Node 03",
        "location": "Lahan Uji",
        "region": "Bantul",
        "latitude": -7.8294,
        "longitude": 110.3816,
        "status": "offline",
        "battery": 0,
        "reading": (0, 0, 0, 0),
    },
]


@contextmanager
def get_connection() -> Generator[sqlite3.Connection, None, None]:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def ensure_column(connection: sqlite3.Connection, table: str, column: str, definition: str) -> None:
    columns = {
        row["name"]
        for row in connection.execute(f"PRAGMA table_info({table})").fetchall()
    }
    if column not in columns:
        connection.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def init_db() -> None:
    with get_connection() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS nodes (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                location TEXT NOT NULL,
                region TEXT NOT NULL DEFAULT '',
                latitude REAL,
                longitude REAL,
                status TEXT NOT NULL,
                battery INTEGER NOT NULL,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS readings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                node_id TEXT NOT NULL,
                soil_moisture REAL NOT NULL,
                soil_temp REAL NOT NULL,
                air_temp REAL NOT NULL,
                air_humidity REAL NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (node_id) REFERENCES nodes(id)
            );

            CREATE TABLE IF NOT EXISTS weather (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                location TEXT NOT NULL,
                condition TEXT NOT NULL,
                code INTEGER NOT NULL,
                temperature REAL NOT NULL,
                humidity INTEGER NOT NULL,
                rain_next_3h INTEGER NOT NULL,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS decision_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                node_id TEXT NOT NULL,
                soil_moisture REAL NOT NULL,
                weather TEXT NOT NULL,
                decision TEXT NOT NULL,
                valve_state TEXT NOT NULL,
                reason TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (node_id) REFERENCES nodes(id)
            );
            """
        )

        ensure_column(connection, "nodes", "region", "TEXT NOT NULL DEFAULT ''")
        ensure_column(connection, "nodes", "latitude", "REAL")
        ensure_column(connection, "nodes", "longitude", "REAL")

        for node in DEFAULT_NODES:
            connection.execute(
                """
                INSERT OR IGNORE INTO nodes
                    (id, name, location, region, latitude, longitude, status, battery)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    node["id"],
                    node["name"],
                    node["location"],
                    node["region"],
                    node["latitude"],
                    node["longitude"],
                    node["status"],
                    node["battery"],
                ),
            )
            connection.execute(
                """
                UPDATE nodes
                SET region = CASE WHEN region = '' THEN ? ELSE region END,
                    latitude = COALESCE(latitude, ?),
                    longitude = COALESCE(longitude, ?)
                WHERE id = ?
                """,
                (node["region"], node["latitude"], node["longitude"], node["id"]),
            )

            reading_count = connection.execute(
                "SELECT COUNT(*) FROM readings WHERE node_id = ?",
                (node["id"],),
            ).fetchone()[0]
            if reading_count == 0:
                connection.execute(
                    """
                    INSERT INTO readings (node_id, soil_moisture, soil_temp, air_temp, air_humidity)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (node["id"], *node["reading"]),
                )

        weather_count = connection.execute("SELECT COUNT(*) FROM weather").fetchone()[0]
        if weather_count == 0:
            connection.execute(
                """
                INSERT INTO weather
                    (id, location, condition, code, temperature, humidity, rain_next_3h)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (1, "Bantul, D.I. Yogyakarta", "Berawan", 3, 29, 80, 0),
            )

        log_count = connection.execute("SELECT COUNT(*) FROM decision_logs").fetchone()[0]
        if log_count == 0:
            connection.execute(
                """
                INSERT INTO decision_logs
                    (node_id, soil_moisture, weather, decision, valve_state, reason)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    "node-01",
                    38,
                    "Berawan",
                    "Irigasi aktif",
                    "open",
                    "Kelembapan tanah berada di bawah threshold bawah dan tidak ada prediksi hujan.",
                ),
            )


def row_to_dict(row: sqlite3.Row | None) -> dict | None:
    if row is None:
        return None
    return dict(row)
