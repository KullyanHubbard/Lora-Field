from contextlib import contextmanager
from pathlib import Path
import sqlite3
from typing import Generator


BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "lorafield.db"


DEFAULT_FARMS = [
    {
        "id": "farm-01",
        "user_id": "user-01",
        "name": "Kebun Salak Bantul",
        "owner": "Pak Budi",
        "location": "Bantul, D.I. Yogyakarta",
        "crop_type": "Salak",
        "area_ha": 0.5,
        "bmkg_adm4_code": "34.02.01.2001",
        "latitude": -7.8881,
        "longitude": 110.3289,
        "status": "active",
    },
    {
        "id": "farm-02",
        "user_id": "user-01",
        "name": "Kebun Cabai Sleman",
        "owner": "Pak Budi",
        "location": "Sleman, D.I. Yogyakarta",
        "crop_type": "Cabai",
        "area_ha": 0.3,
        "bmkg_adm4_code": "34.04.01.1001",
        "latitude": -7.6528,
        "longitude": 110.4207,
        "status": "active",
    },
    {
        "id": "farm-03",
        "user_id": "user-02",
        "name": "Kebun Melon Bantul",
        "owner": "Bu Sari",
        "location": "Bantul, D.I. Yogyakarta",
        "crop_type": "Melon",
        "area_ha": 0.4,
        "bmkg_adm4_code": "34.02.01.2001",
        "latitude": -7.8500,
        "longitude": 110.3400,
        "status": "active",
    },
]

DEFAULT_NODES = [
    {
        "id": "node-01",
        "farm_id": "farm-01",
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
        "farm_id": "farm-02",
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
        "farm_id": "farm-01",
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
            CREATE TABLE IF NOT EXISTS farms (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                owner TEXT NOT NULL DEFAULT '',
                location TEXT NOT NULL DEFAULT '',
                crop_type TEXT NOT NULL DEFAULT '',
                area_ha REAL,
                bmkg_adm4_code TEXT NOT NULL,
                latitude REAL,
                longitude REAL,
                status TEXT NOT NULL DEFAULT 'active',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS nodes (
                id TEXT PRIMARY KEY,
                farm_id TEXT REFERENCES farms(id),
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

            CREATE TABLE IF NOT EXISTS weather_cache (
                adm4 TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            """
        )

        ensure_column(connection, "nodes", "region", "TEXT NOT NULL DEFAULT ''")
        ensure_column(connection, "nodes", "latitude", "REAL")
        ensure_column(connection, "nodes", "longitude", "REAL")
        ensure_column(connection, "nodes", "farm_id", "TEXT REFERENCES farms(id)")

        for farm in DEFAULT_FARMS:
            connection.execute(
                """
                INSERT OR IGNORE INTO farms
                    (id, user_id, name, owner, location, crop_type, area_ha,
                     bmkg_adm4_code, latitude, longitude, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    farm["id"],
                    farm["user_id"],
                    farm["name"],
                    farm["owner"],
                    farm["location"],
                    farm["crop_type"],
                    farm["area_ha"],
                    farm["bmkg_adm4_code"],
                    farm["latitude"],
                    farm["longitude"],
                    farm["status"],
                ),
            )

        for node in DEFAULT_NODES:
            connection.execute(
                """
                INSERT OR IGNORE INTO nodes
                    (id, farm_id, name, location, region, latitude, longitude, status, battery)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    node["id"],
                    node.get("farm_id"),
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
                    longitude = COALESCE(longitude, ?),
                    farm_id = COALESCE(farm_id, ?)
                WHERE id = ?
                """,
                (node["region"], node["latitude"], node["longitude"], node.get("farm_id"), node["id"]),
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
