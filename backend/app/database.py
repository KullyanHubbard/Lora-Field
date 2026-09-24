from contextlib import contextmanager
import csv
from pathlib import Path
import sqlite3
from typing import Generator


BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "lorafield.db"

# Aset sumber (di-commit) untuk daftar wilayah Kemendagri/BMKG, dipisah dari
# runtime DB. Lihat seed_wilayah().
WILAYAH_CSV = Path(__file__).resolve().parent / "data" / "wilayah.csv"


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
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                language TEXT CHECK (language IN ('id', 'en')),
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS password_resets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                token TEXT NOT NULL UNIQUE,
                expires_at TEXT NOT NULL,
                used INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

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
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
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
                farm_id TEXT NOT NULL,
                node_id TEXT NOT NULL,
                soil_moisture REAL NOT NULL,
                soil_temp REAL NOT NULL,
                air_temp REAL NOT NULL,
                air_humidity REAL NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (farm_id) REFERENCES farms(id),
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

            CREATE TABLE IF NOT EXISTS gateway_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                farm_id TEXT NOT NULL,
                event TEXT NOT NULL,
                detail TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (farm_id) REFERENCES farms(id)
            );

            CREATE INDEX IF NOT EXISTS idx_gateway_logs_farm ON gateway_logs(farm_id);

            CREATE TABLE IF NOT EXISTS gateways (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT UNIQUE NOT NULL,
                farm_id TEXT UNIQUE,
                display_name TEXT,
                first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                last_seen_at TEXT,
                claimed_at TEXT,
                FOREIGN KEY (farm_id) REFERENCES farms(id)
            );

            CREATE TABLE IF NOT EXISTS wilayah (
                kode TEXT PRIMARY KEY,
                nama TEXT NOT NULL,
                nama_norm TEXT NOT NULL,
                level INTEGER NOT NULL,
                parent TEXT NOT NULL DEFAULT ''
            );

            CREATE INDEX IF NOT EXISTS idx_wilayah_level_norm ON wilayah(level, nama_norm);
            CREATE INDEX IF NOT EXISTS idx_wilayah_parent ON wilayah(parent);
            """
        )

        ensure_column(connection, "nodes", "region", "TEXT NOT NULL DEFAULT ''")
        ensure_column(connection, "nodes", "latitude", "REAL")
        ensure_column(connection, "nodes", "longitude", "REAL")
        ensure_column(connection, "nodes", "farm_id", "TEXT REFERENCES farms(id)")
        ensure_column(connection, "users", "phone", "TEXT NOT NULL DEFAULT ''")
        ensure_column(
            connection,
            "users",
            "language",
            "TEXT CHECK (language IN ('id', 'en'))",
        )
        ensure_column(connection, "nodes", "gateway_id", "TEXT")
        ensure_column(connection, "nodes", "first_seen_at", "TEXT")
        ensure_column(connection, "readings", "farm_id", "TEXT REFERENCES farms(id)")
        backfill_reading_farm_ids(connection)

        seed_wilayah(connection)


def backfill_reading_farm_ids(connection: sqlite3.Connection) -> None:
    """Isi farm_id snapshot untuk readings lama berdasarkan node pemiliknya."""
    connection.execute(
        """
        UPDATE readings
        SET farm_id = (
            SELECT nodes.farm_id
            FROM nodes
            WHERE nodes.id = readings.node_id
        )
        WHERE (farm_id IS NULL OR farm_id = '')
          AND EXISTS (
              SELECT 1
              FROM nodes
              WHERE nodes.id = readings.node_id
                AND nodes.farm_id IS NOT NULL
          )
        """
    )


def seed_wilayah(connection: sqlite3.Connection) -> None:
    """Isi tabel wilayah dari aset CSV sekali saja (idempoten). Kode sudah format adm4 BMKG.

    nama_norm wajib memakai normalize_region_name yang sama dengan saat query.
    """
    already = connection.execute("SELECT COUNT(*) FROM wilayah").fetchone()[0]
    if already:
        return
    if not WILAYAH_CSV.exists():
        return

    # Import di sini untuk hindari circular import (wilayah_resolver -> database).
    from .wilayah_resolver import normalize_region_name

    rows = []
    with open(WILAYAH_CSV, encoding="utf-8", newline="") as handle:
        reader = csv.reader(handle)
        next(reader, None)  # header
        for record in reader:
            if len(record) < 2:
                continue
            kode, nama = record[0].strip(), record[1].strip()
            if not kode or not nama:
                continue
            level = kode.count(".") + 1
            parent = kode.rsplit(".", 1)[0] if level > 1 else ""
            rows.append((kode, nama, normalize_region_name(nama, level), level, parent))

    connection.executemany(
        "INSERT OR IGNORE INTO wilayah (kode, nama, nama_norm, level, parent) "
        "VALUES (?, ?, ?, ?, ?)",
        rows,
    )


def row_to_dict(row: sqlite3.Row | None) -> dict | None:
    if row is None:
        return None
    return dict(row)
