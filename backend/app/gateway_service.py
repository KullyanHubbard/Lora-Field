"""Klaim dan pelepasan gateway dari kebun.

Klaim dipecah jadi dua langkah supaya pemanggil bisa menyisipkan pengecekannya
sendiri di antara keduanya. Semua fungsi jalan di dalam transaksi pemanggil, jadi
kegagalan apa pun ikut ter-rollback.
"""

import sqlite3

from fastapi import HTTPException

from .database import row_to_dict


def ensure_gateway_unclaimed(connection, device_id: str) -> dict:
    """Daftarkan device kalau belum tercatat, lalu pastikan belum dipegang kebun lain."""
    connection.execute(
        """
        INSERT OR IGNORE INTO gateways (device_id, first_seen_at)
        VALUES (?, CURRENT_TIMESTAMP)
        """,
        (device_id,),
    )
    gateway = row_to_dict(
        connection.execute(
            "SELECT * FROM gateways WHERE device_id = ?",
            (device_id,),
        ).fetchone()
    )
    if gateway is None:
        raise HTTPException(status_code=404, detail="Gateway gagal disiapkan")
    if gateway.get("farm_id") is not None:
        raise HTTPException(status_code=409, detail="Gateway sudah terhubung ke kebun lain")
    return gateway


def claim_gateway_for_farm(connection, device_id: str, display_name: str, farm_id: str) -> dict:
    """Ikat device ke kebun. Panggil ensure_gateway_unclaimed() lebih dulu."""
    try:
        claim_cursor = connection.execute(
            """
            UPDATE gateways
            SET farm_id = ?,
                display_name = ?,
                claimed_at = CURRENT_TIMESTAMP
            WHERE device_id = ?
              AND farm_id IS NULL
            """,
            (farm_id, display_name, device_id),
        )
    except sqlite3.IntegrityError as exc:
        # Kolom gateways.farm_id UNIQUE: kebun ini sudah memegang device lain.
        raise HTTPException(status_code=409, detail="Kebun ini sudah punya gateway") from exc
    if claim_cursor.rowcount != 1:
        raise HTTPException(status_code=409, detail="Gateway sudah diklaim. Muat ulang daftar gateway.")

    return row_to_dict(
        connection.execute(
            "SELECT * FROM gateways WHERE device_id = ?",
            (device_id,),
        ).fetchone()
    )


def release_gateway(connection, farm_id: str) -> None:
    """Lepas gateway dari kebun. Baris device tetap ada supaya bisa diklaim kebun lain."""
    connection.execute(
        """
        UPDATE gateways
        SET farm_id = NULL,
            display_name = NULL,
            claimed_at = NULL
        WHERE farm_id = ?
        """,
        (farm_id,),
    )
