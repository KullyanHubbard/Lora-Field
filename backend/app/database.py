from pathlib import Path
import sqlite3


BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "lorafield.db"


def get_connection() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db() -> None:
    with get_connection() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS nodes (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                location TEXT NOT NULL,
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

        node_count = connection.execute("SELECT COUNT(*) FROM nodes").fetchone()[0]
        if node_count == 0:
            connection.execute(
                """
                INSERT INTO nodes (id, name, location, status, battery)
                VALUES (?, ?, ?, ?, ?)
                """,
                ("node-01", "Node 01", "Lahan Padi Bantul", "online", 92),
            )
            connection.execute(
                """
                INSERT INTO readings (node_id, soil_moisture, soil_temp, air_temp, air_humidity)
                VALUES (?, ?, ?, ?, ?)
                """,
                ("node-01", 38, 27.5, 30.2, 78),
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
