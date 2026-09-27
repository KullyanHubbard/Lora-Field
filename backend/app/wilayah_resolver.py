"""Resolusi kode adm4 BMKG dari nama wilayah, offline, via daftar Kemendagri.

Dipakai sebagai fallback di resolve_bmkg_adm4 (adm4.py): saat OSM tidak punya
tag kode BPS, kita pakai nama wilayah hasil reverse-geocode Nominatim (atau
alamat ketikan user) lalu cocokkan hierarkis ke tabel `wilayah`.

Tabel `wilayah` di-seed dari backend/app/data/wilayah.csv (lihat database.py).
Kolom `nama_norm` dihitung dengan normalize_region_name(nama, level) yang sama
seperti yang dipakai di sini, supaya pencocokan konsisten.
"""

from __future__ import annotations

import re
import unicodedata

from .database import get_connection

# Prefix tipe dilepas dari awal nama. Data kab/kota menyimpannya ("Kabupaten Aceh Selatan"),
# kec/desa tidak dilepas supaya nama seperti "Kota Baru" (desa) tetap utuh.
_PREFIXES = {
    1: ("provinsi", "daerah istimewa", "dki", "di"),
    2: ("kabupaten administrasi", "kota administrasi", "kabupaten", "kota", "kab"),
    3: ("kecamatan", "distrik", "kec"),
    4: ("kelurahan", "desa", "nagari", "gampong", "kel", "ds"),
}


def _deaccent(text: str) -> str:
    return "".join(
        ch for ch in unicodedata.normalize("NFKD", text) if not unicodedata.combining(ch)
    )


def normalize_region_name(name: str, level: int = 0) -> str:
    """Normalisasi nama wilayah untuk pencocokan.

    Lowercase, buang diakritik, ganti non-alfanumerik jadi spasi, rapatkan spasi.
    Bila `level` diberikan, lepas kata tipe administrasi di awal nama untuk level
    itu (mis. "Kabupaten Kaur" -> "kaur", "Kecamatan Tetap" -> "tetap").
    """
    norm = _deaccent(name or "").lower()
    norm = re.sub(r"[^a-z0-9]+", " ", norm).strip()
    for prefix in _PREFIXES.get(level, ()):  # prefix terpanjang dicek lebih dulu
        if norm == prefix:
            break
        if norm.startswith(prefix + " "):
            norm = norm[len(prefix) + 1 :].strip()
            break
    return norm


def _match_level(connection, level: int, name: str, ancestor: str | None) -> str | None:
    """Cari kode satu level via nama_norm; exact dulu, lalu contains. Sempitkan
    ke wilayah turunan `ancestor` (mis. semua desa di dalam suatu kabupaten)
    lewat prefix kode, sehingga lompat level (kab -> desa) tetap jalan. Hanya
    kembalikan kode bila kandidatnya tunggal."""
    key = normalize_region_name(name, level)
    if not key:
        return None

    scoped = "SELECT kode FROM wilayah WHERE level = ?"
    if ancestor:
        scoped += " AND kode LIKE ?"  # ancestor + '.%' -> turunannya

    def run(where_extra: str, value: str) -> list[str]:
        params: list = [level]
        if ancestor:
            params.append(f"{ancestor}.%")
        params.append(value)
        return [
            row["kode"]
            for row in connection.execute(f"{scoped} AND {where_extra}", params).fetchall()
        ]

    exact = run("nama_norm = ?", key)
    if len(exact) == 1:
        return exact[0]
    if len(exact) > 1:
        return None  # ambigu

    contains = run("nama_norm LIKE ?", f"%{key}%")
    if len(contains) == 1:
        return contains[0]
    return None


def resolve_adm4_from_region_names(
    province: str = "",
    regency: str = "",
    district: str = "",
    village: str = "",
    require_parent: bool = False,
) -> str:
    """Cocokkan nama wilayah hierarkis -> kode adm4 (13 char) desa.

    Mengembalikan kode hanya bila bisa dipersempit sampai satu desa. Tahan
    terhadap level atas yang hilang: tiap level menyempitkan `parent` untuk
    level berikutnya, tapi minimal kecamatan+desa (atau kabupaten+desa) yang
    membuat hasil tak ambigu yang bisa sukses.
    """
    if not village:
        return ""  # BMKG butuh adm4 desa; tanpa nama desa tak bisa pasti.

    with get_connection() as connection:
        prov_code = _match_level(connection, 1, province, None) if province else None
        kab_code = (
            _match_level(connection, 2, regency, prov_code) if regency else None
        )
        kec_code = (
            _match_level(connection, 3, district, kab_code) if district else None
        )

        # Desa: sempitkan ke kecamatan kalau ada, kalau tidak ke kabupaten.
        parent = kec_code or kab_code
        if require_parent and parent is None:
            return ""
        desa_code = _match_level(connection, 4, village, parent)
        if desa_code:
            return desa_code

        # Kalau parent kecamatan gagal tapi kabupaten ada, coba lewat kabupaten.
        if kec_code and kab_code:
            desa_code = _match_level(connection, 4, village, kab_code)
            if desa_code:
                return desa_code

    return ""


_KAB_RE = re.compile(r"\b(?:kabupaten|kota|kab)\.?\s+([a-z]+(?:\s+[a-z]+)?)")
_KEC_RE = re.compile(r"\b(?:kecamatan|distrik|kec)\.?\s+([a-z]+(?:\s+[a-z]+)?)")


def resolve_adm4_from_freetext(text: str) -> str:
    """Best-effort: ekstrak kab/kota & kecamatan dari alamat bebas user, dan
    pakai token awal sebagai dugaan desa. Dipakai hanya sebagai fallback kalau
    Nominatim gagal; kalau alamat tidak konsisten hasilnya "" (aman)."""
    norm = normalize_region_name(text)
    if not norm:
        return ""

    regency_match = _KAB_RE.search(norm)
    district_match = _KEC_RE.search(norm)
    regency = regency_match.group(1) if regency_match else ""
    district = district_match.group(1) if district_match else ""

    # Dugaan desa: potongan kata di awal sebelum kata tipe pertama.
    head = re.split(r"\b(?:kabupaten|kota|kecamatan|distrik|kelurahan|desa|kab|kec)\b", norm, 1)[0]
    village = head.strip()

    # Alamat tanpa kata tipe, mis. "Balecatur, Gamping, Sleman": urutannya dianggap
    # desa, kecamatan, kabupaten. Desa hanya dicari di bawah kecamatan/kabupaten yang
    # ketemu, supaya nama desa kembar di provinsi lain tidak ikut tercocokkan.
    parts = [part.strip() for part in text.split(",") if part.strip()]
    comma_format = not regency and not district and len(parts) >= 2
    if comma_format:
        village = parts[0]
        district = parts[1]
        regency = parts[2] if len(parts) > 2 else ""

    if not village:
        return ""
    return resolve_adm4_from_region_names(
        regency=regency, district=district, village=village, require_parent=comma_format
    )
