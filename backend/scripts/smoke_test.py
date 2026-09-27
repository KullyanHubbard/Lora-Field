"""Smoke test end-to-end backend LoraField, dijalankan in-process tanpa server.

Tujuannya jadi jaring pengaman sebelum backend dirapikan: sekali jalan, script ini
menembak hampir semua endpoint lalu memeriksa status code dan kunci-kunci penting di
response. Kalau ada route yang kececer atau shape response berubah saat refactor,
hasilnya langsung merah.

Isolasi:
  - Database dialihkan ke file SQLite sementara. Database dev di backend/data/ TIDAK
    disentuh sama sekali.
  - Cuaca BMKG di-seed manual ke weather_cache, jadi tidak ada panggilan keluar.
  - Resend dimatikan (resend_api_key dikosongkan), OTP dibaca lewat expose_dev_tokens.

Dua endpoint memang butuh internet (GET /api/weather dan GET /api/utils/resolve-adm4).
Keduanya dilewati secara default; aktifkan dengan flag --network.

Jalankan dari root project atau dari folder backend/:
    python backend/scripts/smoke_test.py
    python backend/scripts/smoke_test.py --network

Exit code 0 kalau semua cek lolos, 1 kalau ada yang gagal.
"""

from __future__ import annotations

import shutil
import sys
import tempfile
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from app import database  # noqa: E402
from app.config import settings  # noqa: E402

# Isolasi database harus terjadi sebelum startup event jalan.
TMP_DIR = Path(tempfile.mkdtemp(prefix="lorafield-smoke-"))
database.DATA_DIR = TMP_DIR
database.DB_PATH = TMP_DIR / "smoke.db"

settings.jwt_secret_key = settings.jwt_secret_key or "smoke-test-secret-not-for-production"
settings.resend_api_key = ""       # jangan sampai kirim email sungguhan
settings.expose_dev_tokens = True  # supaya OTP bisa dibaca dari response

from fastapi.testclient import TestClient  # noqa: E402
import app.bmkg as bmkg_module  # noqa: E402
from app.bmkg import set_cached_weather  # noqa: E402
from app.main import app  # noqa: E402
from app.routers import auth as auth_router  # noqa: E402


ADM4 = "34.04.01.2001"
FAKE_WEATHER = {
    "provider": "BMKG",
    "adm4": ADM4,
    "location": "Balecatur",
    "condition": "Cerah Berawan",
    "code": 1,
    "temperature": 29,
    "humidity": 70,
    "rain_next_3h": False,
    "forecast": [],
    "source": "smoke-test-seed",
}


class Report:
    """Kumpulkan hasil cek. Tidak berhenti di kegagalan pertama supaya satu kali
    jalan langsung kelihatan semua yang rusak."""

    def __init__(self) -> None:
        self.passed = 0
        self.failed: list[tuple[str, str]] = []
        self.skipped: list[str] = []

    def ok(self, name: str) -> None:
        self.passed += 1
        print(f"  PASS  {name}")

    def fail(self, name: str, detail: str) -> None:
        self.failed.append((name, detail))
        print(f"  FAIL  {name}")
        print(f"          {detail}")

    def skip(self, name: str, reason: str) -> None:
        self.skipped.append(name)
        print(f"  SKIP  {name} ({reason})")

    def check(self, name: str, condition: bool, detail: str = "") -> bool:
        if condition:
            self.ok(name)
            return True
        self.fail(name, detail or "kondisi tidak terpenuhi")
        return False

    def expect(self, name: str, response, status: int, keys: tuple[str, ...] = ()) -> dict:
        """Cek status code, lalu pastikan kunci wajib ada di body JSON."""
        if response.status_code != status:
            body = response.text[:200].replace("\n", " ")
            self.fail(name, f"status {response.status_code} (harusnya {status}) | {body}")
            return {}
        try:
            data = response.json()
        except ValueError:
            data = {}
        if not isinstance(data, dict):
            data = {}
        missing = [k for k in keys if k not in data]
        if missing:
            self.fail(name, f"kunci hilang di response: {', '.join(missing)}")
            return data
        self.ok(name)
        return data


def section(title: str) -> None:
    print(f"\n{title}")


def run(report: Report, with_network: bool) -> None:
    suffix = uuid.uuid4().hex[:8]
    email = f"smoke-{suffix}@lorafield-smoke.com"
    password = "smoke-pass-123"
    device_id = f"GW-SMOKE-{suffix}"

    # raise_server_exceptions=False supaya error 500 dilaporkan sebagai response,
    # persis seperti yang diterima frontend, bukan meledak dan menghentikan test.
    with TestClient(app, raise_server_exceptions=False) as client:
        set_cached_weather(ADM4, FAKE_WEATHER)

        section("Public")
        report.expect("GET /health", client.get("/health"), 200)
        crops = report.expect("GET /api/crops", client.get("/api/crops"), 200, ("crops",))
        report.check(
            "GET /api/crops berisi 30 tanaman",
            len(crops.get("crops", [])) == 30,
            f"dapat {len(crops.get('crops', []))}",
        )
        filtered = report.expect(
            "GET /api/crops?q=padi",
            client.get("/api/crops", params={"q": "padi"}),
            200,
            ("crops",),
        )
        report.check(
            "filter ?q= mempersempit hasil",
            0 < len(filtered.get("crops", [])) < 30,
            f"dapat {len(filtered.get('crops', []))}",
        )

        section("Auth guard")
        no_token = client.get("/api/farms")
        report.check(
            "GET /api/farms tanpa token ditolak",
            no_token.status_code in (401, 403),
            f"status {no_token.status_code}",
        )

        section("Auth")
        report.expect(
            "POST /api/auth/register",
            client.post(
                "/api/auth/register",
                json={"name": "Smoke Test", "email": email, "password": password, "language": "id"},
            ),
            201,
            ("id", "email", "name", "language"),
        )
        login = report.expect(
            "POST /api/auth/login",
            client.post(
                "/api/auth/login",
                json={"email": email, "password": password, "language": "id"},
            ),
            200,
            ("access_token", "token_type", "user"),
        )
        auth = {"Authorization": f"Bearer {login.get('access_token', '')}"}
        report.check(
            "login mengembalikan objek user lengkap",
            set(login.get("user", {})) >= {"id", "email", "name", "phone", "language"},
            f"kunci: {sorted(login.get('user', {}))}",
        )

        report.expect(
            "GET /api/auth/me",
            client.get("/api/auth/me", headers=auth),
            200,
            ("id", "email", "language"),
        )
        report.expect(
            "PATCH /api/auth/profile",
            client.patch("/api/auth/profile", json={"phone": "081234567890"}, headers=auth),
            200,
            ("user",),
        )
        lang = report.expect(
            "PATCH /api/auth/preferences/language",
            client.patch("/api/auth/preferences/language", json={"language": "en"}, headers=auth),
            200,
            ("language",),
        )
        report.check(
            "preferensi bahasa tersimpan",
            lang.get("language") == "en",
            f"dapat {lang.get('language')}",
        )

        new_password = "smoke-pass-456"
        report.expect(
            "POST /api/auth/change-password",
            client.post(
                "/api/auth/change-password",
                json={"current_password": password, "new_password": new_password},
                headers=auth,
            ),
            200,
        )
        relogin = report.expect(
            "login dengan password baru",
            client.post("/api/auth/login", json={"email": email, "password": new_password}),
            200,
            ("access_token",),
        )
        auth = {"Authorization": f"Bearer {relogin.get('access_token', '')}"}
        report.check(
            "password lama ditolak setelah diganti",
            client.post("/api/auth/login", json={"email": email, "password": password}).status_code == 401,
        )

        forgot = report.expect(
            "POST /api/auth/forgot-password",
            client.post("/api/auth/forgot-password", json={"email": email}),
            200,
            ("message",),
        )
        otp = forgot.get("reset_token", "")
        captured_emails: list[str] = []
        original_send = auth_router.send_email_via_resend
        original_frontend_url = settings.frontend_url
        auth_router.send_email_via_resend = lambda to, subject, html: captured_emails.append(html) or False
        try:
            settings.frontend_url = ""
            client.post(
                "/api/auth/forgot-password",
                json={"email": email},
                headers={"Host": "evil.example.com"},
            )
            settings.frontend_url = "https://app.lorafield.test"
            client.post(
                "/api/auth/forgot-password",
                json={"email": email},
                headers={"Host": "evil.example.com"},
            )
        finally:
            auth_router.send_email_via_resend = original_send
            settings.frontend_url = original_frontend_url
        report.check(
            "email reset tanpa FRONTEND_URL tidak memuat link",
            len(captured_emails) == 2 and "href" not in captured_emails[0],
            f"email = {captured_emails[:1]}",
        )
        report.check(
            "link email reset memakai FRONTEND_URL, bukan header Host",
            len(captured_emails) == 2
            and "https://app.lorafield.test/reset-password" in captured_emails[1]
            and "evil.example.com" not in "".join(captured_emails),
            f"email = {captured_emails[1:]}",
        )
        # OTP lama sudah dimatikan oleh permintaan di atas; ambil OTP baru.
        forgot = client.post("/api/auth/forgot-password", json={"email": email}).json()
        otp = forgot.get("reset_token", "")
        if report.check("OTP terbit (expose_dev_tokens)", bool(otp), "reset_token tidak ada di response"):
            report.expect(
                "POST /api/auth/reset-password/verify",
                client.post("/api/auth/reset-password/verify", json={"token": otp}),
                200,
            )
            report.expect(
                "POST /api/auth/reset-password",
                client.post(
                    "/api/auth/reset-password",
                    json={"token": otp, "new_password": password},
                ),
                200,
            )
            report.check(
                "OTP tidak bisa dipakai dua kali",
                client.post("/api/auth/reset-password/verify", json={"token": otp}).status_code == 400,
            )
            relogin = report.expect(
                "login dengan password hasil reset",
                client.post("/api/auth/login", json={"email": email, "password": password}),
                200,
                ("access_token",),
            )
            auth = {"Authorization": f"Bearer {relogin.get('access_token', '')}"}
        report.check(
            "email tak dikenal tidak dibocorkan",
            client.post(
                "/api/auth/forgot-password",
                json={"email": "entah-siapa@lorafield-smoke.com"},
            ).status_code == 200,
        )

        section("Farms & gateway")
        created = report.expect(
            "POST /api/farms",
            client.post(
                "/api/farms",
                json={
                    "name": "Kebun Smoke",
                    "owner": "Smoke Test",
                    "location": "Balecatur, Gamping, Sleman",
                    "crop_type": "Padi",
                    "area_ha": 1.5,
                    "bmkg_adm4_code": ADM4,
                    "latitude": -7.79,
                    "longitude": 110.31,
                    "gateway_device_id": device_id,
                    "gateway_display_name": "Gateway Smoke",
                },
                headers=auth,
            ),
            201,
            ("farm", "gateway"),
        )
        farm_id = created.get("farm", {}).get("id", "")
        report.check(
            "POST /api/farms dengan tanaman di luar daftar ditolak",
            client.post(
                "/api/farms",
                json={
                    "name": "Kebun Tanaman Asing",
                    "crop_type": "Durian",
                    "latitude": -7.79,
                    "longitude": 110.31,
                    "bmkg_adm4_code": ADM4,
                    "gateway_device_id": f"gw-{suffix}-asing",
                },
                headers=auth,
            ).status_code == 422,
        )
        report.check(
            "POST /api/farms langsung mengklaim gateway",
            created.get("gateway", {}).get("farm_id") == farm_id,
            f"gateway.farm_id = {created.get('gateway', {}).get('farm_id')}",
        )
        report.check(
            "gateway_device_id wajib diisi",
            client.post("/api/farms", json={"name": "Tanpa Gateway"}, headers=auth).status_code == 422,
        )
        dobel = client.post(
            "/api/farms",
            json={
                "name": "Kebun Rebutan",
                "crop_type": "Jagung",
                "bmkg_adm4_code": ADM4,
                "gateway_device_id": device_id,
                "gateway_display_name": "Gateway Sama",
            },
            headers=auth,
        )
        report.check(
            "buat kebun dengan gateway yang sudah dipakai ditolak 409",
            dobel.status_code == 409,
            f"status {dobel.status_code}",
        )
        report.check(
            "kebun gagal tidak tertinggal di database (transaksi ter-rollback)",
            not any(f.get("name") == "Kebun Rebutan" for f in client.get("/api/farms", headers=auth).json().get("items", [])),
        )

        listed = report.expect(
            "GET /api/farms",
            client.get("/api/farms", headers=auth),
            200,
            ("items", "total"),
        )
        report.check(
            "kebun baru muncul di daftar",
            any(f.get("id") == farm_id for f in listed.get("items", [])),
        )
        report.expect(
            "GET /api/farms/{id}",
            client.get(f"/api/farms/{farm_id}", headers=auth),
            200,
            ("farm",),
        )
        patched = report.expect(
            "PATCH /api/farms/{id}",
            client.patch(f"/api/farms/{farm_id}", json={"name": "Kebun Smoke Revisi"}, headers=auth),
            200,
            ("farm",),
        )
        report.check(
            "PATCH benar-benar mengubah data",
            patched.get("farm", {}).get("name") == "Kebun Smoke Revisi",
        )
        report.expect(
            "GET /api/farms/{id}/gateway",
            client.get(f"/api/farms/{farm_id}/gateway", headers=auth),
            200,
            ("gateway",),
        )

        section("Nodes")
        node_a = f"node-{suffix}-a"
        node_b = f"node-{suffix}-b"
        registered = report.expect(
            "POST /api/gateways/{id}/register",
            client.post(
                f"/api/gateways/{device_id}/register",
                json={
                    "farm_id": farm_id,
                    "nodes": [
                        {
                            "node_id": node_a,
                            "name": "Node A",
                            "region": "Blok A",
                            "latitude": -7.79,
                            "longitude": 110.31,
                        },
                        {"node_id": node_b, "name": "Node B", "region": "Blok B"},
                    ],
                },
                headers=auth,
            ),
            200,
            ("gateway_id", "farm_id", "status", "nodes", "created_count"),
        )
        report.check(
            "dua node terbuat",
            registered.get("created_count") == 2,
            f"created_count = {registered.get('created_count')}",
        )
        report.check(
            "node baru berstatus pending",
            all(n.get("status") == "pending" for n in registered.get("nodes", [])),
            f"status: {[n.get('status') for n in registered.get('nodes', [])]}",
        )
        rerun = report.expect(
            "register ulang bersifat idempoten",
            client.post(
                f"/api/gateways/{device_id}/register",
                json={"farm_id": farm_id, "nodes": [{"node_id": node_a, "name": "Node A"}]},
                headers=auth,
            ),
            200,
            ("created_count",),
        )
        report.check("register ulang tidak menduplikasi node", rerun.get("created_count") == 0)

        nodes = report.expect(
            "GET /api/nodes?farm_id=",
            client.get("/api/nodes", params={"farm_id": farm_id}, headers=auth),
            200,
            ("items", "total"),
        )
        report.check("dua node terdaftar di kebun", nodes.get("total") == 2, f"total = {nodes.get('total')}")
        report.expect(
            "PATCH /api/nodes/{id}/location",
            client.patch(
                f"/api/nodes/{node_a}/location",
                json={
                    "location": "Petak Utara",
                    "region": "Blok A",
                    "latitude": -7.7912,
                    "longitude": 110.3121,
                },
                headers=auth,
            ),
            200,
            ("node",),
        )

        section("Readings & decision")
        reading = report.expect(
            "POST /api/nodes/{id}/readings",
            client.post(
                f"/api/nodes/{node_a}/readings",
                params={"adm4": ADM4},
                json={
                    "soil_moisture": 30.0,
                    "soil_temp": 26.0,
                    "air_temp": 30.0,
                    "air_humidity": 70.0,
                    "battery": 76,
                    "rssi": -92.5,
                },
                headers=auth,
            ),
            201,
            ("reading", "decision", "node_created", "node_status"),
        )
        report.check(
            "rssi ikut tersimpan di reading",
            reading.get("reading", {}).get("rssi") == -92.5,
            f"dapat {reading.get('reading', {}).get('rssi')}",
        )
        report.check(
            "kelembapan 30% tanpa hujan -> valve open",
            reading.get("decision", {}).get("valve_state") == "open",
            f"decision = {reading.get('decision')}",
        )
        report.check("node lama tidak dibuat ulang", reading.get("node_created") is False)

        node_self = f"node-{suffix}-self"
        selfreg = report.expect(
            "POST readings auto-create node (self-registration)",
            client.post(
                f"/api/nodes/{node_self}/readings",
                params={"adm4": ADM4},
                json={
                    "soil_moisture": 80.0,
                    "soil_temp": 26.0,
                    "air_temp": 30.0,
                    "air_humidity": 70.0,
                    "farm_id": farm_id,
                },
                headers=auth,
            ),
            201,
            ("reading", "decision", "node_created"),
        )
        report.check("node baru terbuat lewat readings", selfreg.get("node_created") is True)
        with database.get_connection() as connection:
            connection.execute(
                "UPDATE readings SET created_at = datetime('now', '-2 days') WHERE node_id = ?",
                (node_self,),
            )
        stale_window = client.get(
            f"/api/nodes/{node_self}/readings", params={"hours": 12}, headers=auth
        ).json()
        report.check(
            "readings?hours node yang lama diam tetap berisi data terakhirnya",
            len(stale_window.get("items", [])) == 1,
            f"dapat {len(stale_window.get('items', []))}",
        )
        report.check(
            "kelembapan 80% -> valve closed",
            selfreg.get("decision", {}).get("valve_state") == "closed",
            f"decision = {selfreg.get('decision')}",
        )
        report.check(
            "readings tanpa farm_id untuk node baru ditolak",
            client.post(
                f"/api/nodes/node-{suffix}-nofarm/readings",
                params={"adm4": ADM4},
                json={
                    "soil_moisture": 50.0,
                    "soil_temp": 26.0,
                    "air_temp": 30.0,
                    "air_humidity": 70.0,
                },
                headers=auth,
            ).status_code == 400,
        )
        readings = report.expect(
            "GET /api/nodes/{id}/readings",
            client.get(f"/api/nodes/{node_a}/readings", headers=auth),
            200,
            ("items",),
        )
        report.check(
            "reading tersimpan",
            len(readings.get("items", [])) == 1,
            f"dapat {len(readings.get('items', []))}",
        )
        windowed = report.expect(
            "GET /api/nodes/{id}/readings?hours=12",
            client.get(f"/api/nodes/{node_a}/readings", params={"hours": 12}, headers=auth),
            200,
            ("items",),
        )
        report.check(
            "readings per rentang jam ikut reading terbaru",
            len(windowed.get("items", [])) == 1,
            f"dapat {len(windowed.get('items', []))}",
        )
        report.check(
            "readings hours di atas batas ditolak",
            client.get(f"/api/nodes/{node_a}/readings", params={"hours": 1000}, headers=auth).status_code == 422,
        )

        dec = report.expect(
            "GET /api/decision",
            client.get("/api/decision", params={"soil_moisture": 30, "rain_next_3h": True}, headers=auth),
            200,
            ("soil_moisture", "rain_next_3h", "thresholds", "decision"),
        )
        report.check(
            "kelembapan rendah + hujan -> irigasi ditunda",
            dec.get("decision", {}).get("type") == "delayed",
            f"type = {dec.get('decision', {}).get('type')}",
        )

        logs = report.expect("GET /api/logs", client.get("/api/logs", headers=auth), 200, ("items",))
        log_items = logs.get("items") or []
        report.check("decision log tercatat", len(log_items) == 2, f"dapat {len(log_items)}")
        first_log = log_items[0] if log_items else {}
        report.check(
            "kolom weather di decision_logs berisi string kondisi",
            isinstance(first_log.get("weather"), str),
            f"tipe = {type(first_log.get('weather')).__name__}",
        )
        report.check(
            "decision log menyimpan decision_type",
            {item.get("decision_type") for item in log_items} == {"open", "standby"},
            f"dapat {[item.get('decision_type') for item in log_items]}",
        )

        section("Summary & cuaca")
        summary = report.expect(
            "GET /api/farms/{id}/summary",
            client.get(f"/api/farms/{farm_id}/summary", headers=auth),
            200,
            (
                "farm",
                "weather",
                "thresholds",
                "gateway_status",
                "average_soil_moisture",
                "nodes_total",
                "nodes_online",
                "nodes_problem",
                "nodes",
            ),
        )
        report.check("summary menghitung 3 node", summary.get("nodes_total") == 3, f"dapat {summary.get('nodes_total')}")
        report.check(
            "rata-rata kelembapan dari 2 node yang punya reading",
            summary.get("average_soil_moisture") == 55.0,
            f"dapat {summary.get('average_soil_moisture')}",
        )
        report.check(
            "threshold summary ikut tanaman kebun (Padi 60-80)",
            summary.get("thresholds") == {"lower": 60.0, "upper": 80.0},
            f"dapat {summary.get('thresholds')}",
        )
        summary_nodes = {ns["node"]["id"]: ns for ns in summary.get("nodes", [])}
        node_a_summary = summary_nodes.get(node_a, {})
        report.check(
            "baterai node diisi dari laporan perangkat",
            node_a_summary.get("node", {}).get("battery") == 76,
            f"dapat {node_a_summary.get('node', {}).get('battery')}",
        )
        report.check(
            "rssi reading terakhir ikut di summary",
            (node_a_summary.get("latest_reading") or {}).get("rssi") == -92.5,
            f"dapat {(node_a_summary.get('latest_reading') or {}).get('rssi')}",
        )
        report.check(
            "rssi reading tanpa laporan gateway = null",
            (summary_nodes.get(node_self, {}).get("latest_reading") or {}).get("rssi", "x") is None,
            f"dapat {(summary_nodes.get(node_self, {}).get('latest_reading') or {}).get('rssi', 'x')}",
        )
        report.check(
            "baterai node yang belum melapor = null",
            summary_nodes.get(node_self, {}).get("node", {}).get("battery", "x") is None,
            f"dapat {summary_nodes.get(node_self, {}).get('node', {}).get('battery', 'x')}",
        )
        report.check(
            "decision summary membawa type",
            node_a_summary.get("decision", {}).get("type") == "open",
            f"dapat {node_a_summary.get('decision')}",
        )
        with database.get_connection() as connection:
            connection.execute(
                "UPDATE nodes SET last_seen_at = datetime('now', '-1 day') WHERE farm_id = ?",
                (farm_id,),
            )
            connection.execute(
                "UPDATE gateways SET last_seen_at = datetime('now', '-1 day') WHERE farm_id = ?",
                (farm_id,),
            )
        stale = client.get(f"/api/farms/{farm_id}/summary", headers=auth).json()
        report.check(
            "node tanpa data lebih dari batas waktu -> offline",
            stale.get("nodes_online") == 0
            and stale.get("nodes_problem") == 3
            and stale.get("gateway_status") == "offline",
            f"online={stale.get('nodes_online')} problem={stale.get('nodes_problem')} gateway={stale.get('gateway_status')}",
        )
        stale_types = {(ns.get("decision") or {}).get("type") for ns in stale.get("nodes", [])}
        report.check(
            "node offline -> decision disconnected, bukan keputusan lama",
            stale_types == {"disconnected"},
            f"dapat {stale_types}",
        )
        with database.get_connection() as connection:
            connection.execute(
                "UPDATE gateways SET last_seen_at = CURRENT_TIMESTAMP WHERE farm_id = ?",
                (farm_id,),
            )
        gateway_seen = client.get(f"/api/farms/{farm_id}/summary", headers=auth).json()
        report.check(
            "gateway yang baru melapor tetap online walau node diam",
            gateway_seen.get("gateway_status") == "online",
            f"gateway={gateway_seen.get('gateway_status')}",
        )
        weather = report.expect(
            "GET /api/farms/{id}/weather",
            client.get(f"/api/farms/{farm_id}/weather", headers=auth),
            200,
            ("provider", "adm4", "condition", "rain_next_3h", "from_cache"),
        )
        report.check("cuaca dilayani dari cache", weather.get("from_cache") is True)

        if with_network:
            report.expect(
                "GET /api/weather?adm4= (internet)",
                client.get("/api/weather", params={"adm4": ADM4}, headers=auth),
                200,
                ("provider", "condition"),
            )
            report.expect(
                "GET /api/utils/resolve-adm4 (internet)",
                client.get("/api/utils/resolve-adm4", params={"lat": -7.79, "lon": 110.31}, headers=auth),
                200,
            )
        else:
            report.skip("GET /api/weather?adm4=", "butuh internet, pakai --network")
            report.skip("GET /api/utils/resolve-adm4", "butuh internet, pakai --network")

        section("Kendali valve")
        # Node dibuat offline di section sebelumnya; hidupkan lagi untuk tes mode manual.
        with database.get_connection() as connection:
            connection.execute(
                "UPDATE nodes SET last_seen_at = CURRENT_TIMESTAMP WHERE farm_id = ?", (farm_id,)
            )
        report.check(
            "valve per node ditolak di mode otomatis",
            client.patch(f"/api/nodes/{node_a}/valve", json={"open": True}, headers=auth).status_code
            == 409,
        )
        switched = report.expect(
            "PATCH /api/farms/{id}/irrigation-mode manual",
            client.patch(f"/api/farms/{farm_id}/irrigation-mode", json={"mode": "manual"}, headers=auth),
            200,
            ("farm",),
        )
        report.check(
            "mode kebun tersimpan manual",
            switched.get("farm", {}).get("irrigation_mode") == "manual",
            f"dapat {switched.get('farm', {}).get('irrigation_mode')}",
        )
        manual_summary = client.get(f"/api/farms/{farm_id}/summary", headers=auth).json()
        report.check(
            "mode manual mulai dengan semua valve tertutup",
            {(ns.get("decision") or {}).get("type") for ns in manual_summary.get("nodes", [])}
            == {"manual_closed"},
            f"dapat {[(ns.get('decision') or {}).get('type') for ns in manual_summary.get('nodes', [])]}",
        )
        opened = report.expect(
            "PATCH /api/nodes/{id}/valve buka",
            client.patch(f"/api/nodes/{node_a}/valve", json={"open": True}, headers=auth),
            200,
            ("node",),
        )
        report.check(
            "valve terbuka membawa waktu tutup otomatis, belum terkirim ke alat",
            opened.get("node", {}).get("valve_command") == "open"
            and opened.get("node", {}).get("valve_auto_close_at") is not None
            and opened.get("node", {}).get("valve_command_sent_at") is None,
            f"node = {opened.get('node')}",
        )
        report.check(
            "node tanpa data sensor tidak bisa dibuka",
            client.patch(f"/api/nodes/{node_b}/valve", json={"open": True}, headers=auth).status_code
            == 409,
        )
        manual_reading = client.post(
            f"/api/nodes/{node_a}/readings",
            params={"adm4": ADM4},
            json={"soil_moisture": 90.0, "soil_temp": 26.0, "air_temp": 30.0, "air_humidity": 70.0},
            headers=auth,
        ).json()
        report.check(
            "mode manual: reading mengikuti perintah valve, bukan kelembapan",
            manual_reading.get("decision", {}).get("type") == "manual_open",
            f"decision = {manual_reading.get('decision')}",
        )
        with database.get_connection() as connection:
            connection.execute(
                "UPDATE nodes SET valve_command_at = datetime('now', '-1 day') WHERE id = ?",
                (node_a,),
            )
        expired_summary = client.get(f"/api/farms/{farm_id}/summary", headers=auth).json()
        expired_a = next(
            (ns for ns in expired_summary.get("nodes", []) if ns["node"]["id"] == node_a), {}
        )
        report.check(
            "valve manual tertutup otomatis setelah batas waktu",
            expired_a.get("decision", {}).get("valve_state") == "closed",
            f"decision = {expired_a.get('decision')}",
        )
        timeout_logs = [
            item
            for item in client.get("/api/logs", headers=auth).json().get("items", [])
            if item.get("decision_type") == "manual_timeout"
        ]
        report.check("penutupan otomatis tercatat di riwayat", len(timeout_logs) == 1, f"dapat {len(timeout_logs)}")
        started = report.expect(
            "POST /api/farms/{id}/irrigation/start",
            client.post(f"/api/farms/{farm_id}/irrigation/start", headers=auth),
            200,
            ("nodes",),
        )
        report.check(
            "jalankan pengairan membuka valve node yang punya data",
            {n["id"]: n.get("valve_command") for n in started.get("nodes", [])}.get(node_a) == "open",
            f"nodes = {[(n['id'], n.get('valve_command')) for n in started.get('nodes', [])]}",
        )
        stopped = report.expect(
            "POST /api/farms/{id}/irrigation/stop",
            client.post(f"/api/farms/{farm_id}/irrigation/stop", headers=auth),
            200,
            ("nodes",),
        )
        report.check(
            "hentikan pengairan menutup semua valve",
            all(n.get("valve_command") != "open" for n in stopped.get("nodes", [])),
            f"nodes = {[(n['id'], n.get('valve_command')) for n in stopped.get('nodes', [])]}",
        )
        with database.get_connection() as connection:
            connection.execute(
                "UPDATE nodes SET last_seen_at = datetime('now', '-1 day') WHERE farm_id = ?",
                (farm_id,),
            )
        report.check(
            "mode tidak bisa diganti saat semua node offline",
            client.patch(
                f"/api/farms/{farm_id}/irrigation-mode", json={"mode": "auto"}, headers=auth
            ).status_code
            == 409,
        )
        with database.get_connection() as connection:
            connection.execute(
                "UPDATE nodes SET last_seen_at = CURRENT_TIMESTAMP WHERE farm_id = ?", (farm_id,)
            )
        back_to_auto = report.expect(
            "PATCH /api/farms/{id}/irrigation-mode auto",
            client.patch(f"/api/farms/{farm_id}/irrigation-mode", json={"mode": "auto"}, headers=auth),
            200,
            ("farm",),
        )
        report.check(
            "kembali ke mode otomatis",
            back_to_auto.get("farm", {}).get("irrigation_mode") == "auto",
            f"dapat {back_to_auto.get('farm', {}).get('irrigation_mode')}",
        )
        decimal_battery = client.post(
            f"/api/nodes/{node_a}/readings",
            params={"adm4": ADM4},
            json={
                "soil_moisture": 50.0,
                "soil_temp": 26.0,
                "air_temp": 30.0,
                "air_humidity": 70.0,
                "battery": 76.6,
            },
            headers=auth,
        )
        battery_nodes = {
            ns["node"]["id"]: ns["node"]["battery"]
            for ns in client.get(f"/api/farms/{farm_id}/summary", headers=auth).json().get("nodes", [])
        }
        report.check(
            "baterai desimal diterima dan dibulatkan",
            decimal_battery.status_code == 201 and battery_nodes.get(node_a) == 77,
            f"status {decimal_battery.status_code}, battery {battery_nodes.get(node_a)}",
        )

        section("Cuaca cadangan")

        from fastapi import HTTPException as _HTTPException  # noqa: E402

        def slot(hours_offset: float, desc: str) -> dict:
            waktu = (datetime.now(timezone.utc) + timedelta(hours=hours_offset)).strftime(
                "%Y-%m-%d %H:%M:%S"
            )
            return {
                "utc_datetime": waktu,
                "weather_desc": desc,
                "weather": 1 if "Hujan" in desc else 0,
                "t": 28,
                "hu": 70,
            }

        def age_cache(hours: int) -> None:
            with database.get_connection() as connection:
                connection.execute(
                    "UPDATE weather_cache SET updated_at = datetime('now', ?) WHERE adm4 = ?",
                    (f"-{hours} hours", ADM4),
                )

        def bmkg_gagal_dengan(exc_factory):
            calls = {"count": 0}

            def gagal(adm4: str) -> dict:
                calls["count"] += 1
                raise exc_factory()

            return calls, gagal

        def kering_payload() -> dict:
            return {
                "soil_moisture": 30.0,
                "soil_temp": 26.0,
                "air_temp": 30.0,
                "air_humidity": 70.0,
            }

        def reset_cuaca_cadangan() -> None:
            bmkg_module.fetch_bmkg_weather = original_fetch_bmkg
            set_cached_weather(ADM4, FAKE_WEATHER)
            bmkg_module._bmkg_failed_at.clear()

        original_fetch_bmkg = bmkg_module.fetch_bmkg_weather

        # 1. Slot sekarang dipilih benar: cache lama 2 jam, slot hujan ada di masa lalu dekat.
        calls, gagal = bmkg_gagal_dengan(lambda: _HTTPException(status_code=502, detail="gangguan"))
        bmkg_module.fetch_bmkg_weather = gagal
        try:
            set_cached_weather(
                ADM4,
                {
                    **FAKE_WEATHER,
                    "forecast": [
                        slot(-7, "Cerah"),
                        slot(-4, "Cerah"),
                        slot(-1, "Hujan Ringan"),
                        slot(2, "Cerah"),
                        slot(5, "Cerah"),
                    ],
                },
            )
            age_cache(2)
            resp = client.post(
                f"/api/nodes/{node_a}/readings",
                params={"adm4": ADM4},
                json=kering_payload(),
                headers=auth,
            )
            body = resp.json() if resp.status_code == 201 else {}
            report.check(
                "cuaca cadangan: slot sekarang dipilih benar -> irigasi ditunda",
                resp.status_code == 201 and body.get("decision", {}).get("type") == "delayed",
                f"status {resp.status_code}, decision {body.get('decision')}",
            )
        finally:
            reset_cuaca_cadangan()

        # 2. Info hujan tersimpan di level atas tidak boleh dipakai, hanya forecast yang dihitung ulang.
        calls, gagal = bmkg_gagal_dengan(lambda: _HTTPException(status_code=502, detail="gangguan"))
        bmkg_module.fetch_bmkg_weather = gagal
        try:
            set_cached_weather(
                ADM4,
                {
                    **FAKE_WEATHER,
                    "rain_next_3h": True,
                    "condition": "Hujan Lebat",
                    "forecast": [
                        slot(-4, "Hujan Ringan"),
                        slot(-1, "Cerah"),
                        slot(2, "Cerah"),
                    ],
                },
            )
            age_cache(2)
            resp = client.post(
                f"/api/nodes/{node_a}/readings",
                params={"adm4": ADM4},
                json=kering_payload(),
                headers=auth,
            )
            body = resp.json() if resp.status_code == 201 else {}
            report.check(
                "cuaca cadangan: info hujan tersimpan tidak dipakai -> irigasi jalan",
                resp.status_code == 201 and body.get("decision", {}).get("type") == "open",
                f"status {resp.status_code}, decision {body.get('decision')}",
            )
        finally:
            reset_cuaca_cadangan()

        # 3. Cache terlalu tua (13 jam, batas 12) -> dianggap tidak tersedia, weather log kosong.
        calls, gagal = bmkg_gagal_dengan(lambda: _HTTPException(status_code=502, detail="gangguan"))
        bmkg_module.fetch_bmkg_weather = gagal
        try:
            set_cached_weather(
                ADM4,
                {
                    **FAKE_WEATHER,
                    "forecast": [slot(-1, "Hujan Ringan"), slot(2, "Hujan Ringan")],
                },
            )
            age_cache(13)
            resp = client.post(
                f"/api/nodes/{node_a}/readings",
                params={"adm4": ADM4},
                json=kering_payload(),
                headers=auth,
            )
            body = resp.json() if resp.status_code == 201 else {}
            with database.get_connection() as connection:
                log_row = connection.execute(
                    """
                    SELECT weather FROM decision_logs
                    WHERE node_id = ?
                    ORDER BY created_at DESC, id DESC
                    LIMIT 1
                    """,
                    (node_a,),
                ).fetchone()
            report.check(
                "cuaca cadangan: cache terlalu tua -> tanpa cuaca, irigasi tetap jalan",
                resp.status_code == 201
                and body.get("decision", {}).get("type") == "open"
                and log_row is not None
                and log_row["weather"] == "",
                f"status {resp.status_code}, decision {body.get('decision')}, weather log {log_row['weather'] if log_row else None!r}",
            )
        finally:
            reset_cuaca_cadangan()

        # 4. Error jenis lain (bukan HTTPException) tertangkap, tanpa cache sama sekali.
        calls, gagal = bmkg_gagal_dengan(lambda: ValueError("data BMKG rusak"))
        bmkg_module.fetch_bmkg_weather = gagal
        try:
            with database.get_connection() as connection:
                connection.execute("DELETE FROM weather_cache WHERE adm4 = ?", (ADM4,))
            resp = client.post(
                f"/api/nodes/{node_a}/readings",
                params={"adm4": ADM4},
                json=kering_payload(),
                headers=auth,
            )
            body = resp.json() if resp.status_code == 201 else {}
            latest = client.get(
                f"/api/nodes/{node_a}/readings", params={"limit": 1}, headers=auth
            ).json()
            latest_id = (latest.get("items") or [{}])[0].get("id")
            node_status = {
                n["id"]: n.get("status")
                for n in client.get("/api/nodes", params={"farm_id": farm_id}, headers=auth)
                .json()
                .get("items", [])
            }
            report.check(
                "cuaca cadangan: error non-HTTPException tertangkap, reading tetap tersimpan",
                resp.status_code == 201
                and latest_id == body.get("reading", {}).get("id")
                and node_status.get(node_a) == "online",
                f"status {resp.status_code}, latest_id {latest_id}, reading_id {body.get('reading', {}).get('id')}, node_status {node_status.get(node_a)}",
            )
        finally:
            reset_cuaca_cadangan()

        # 5. Jeda percobaan ulang: BMKG gagal sekali, lalu tidak dicoba lagi dalam 5 menit.
        calls, gagal = bmkg_gagal_dengan(lambda: _HTTPException(status_code=502, detail="gangguan"))
        bmkg_module.fetch_bmkg_weather = gagal
        try:
            with database.get_connection() as connection:
                connection.execute("DELETE FROM weather_cache WHERE adm4 = ?", (ADM4,))
            resp1 = client.post(
                f"/api/nodes/{node_a}/readings",
                params={"adm4": ADM4},
                json=kering_payload(),
                headers=auth,
            )
            resp2 = client.post(
                f"/api/nodes/{node_a}/readings",
                params={"adm4": ADM4},
                json=kering_payload(),
                headers=auth,
            )
            report.check(
                "cuaca cadangan: jeda percobaan ulang, BMKG cuma dipanggil sekali",
                resp1.status_code == 201 and resp2.status_code == 201 and calls["count"] == 1,
                f"status {resp1.status_code}/{resp2.status_code}, panggilan BMKG = {calls['count']}",
            )
        finally:
            reset_cuaca_cadangan()

        # 6. Summary ikut memakai cache lama dan menandai is_stale.
        calls, gagal = bmkg_gagal_dengan(lambda: _HTTPException(status_code=502, detail="gangguan"))
        bmkg_module.fetch_bmkg_weather = gagal
        try:
            set_cached_weather(
                ADM4,
                {
                    **FAKE_WEATHER,
                    "forecast": [
                        slot(-7, "Cerah"),
                        slot(-4, "Cerah"),
                        slot(-1, "Hujan Ringan"),
                        slot(2, "Cerah"),
                        slot(5, "Cerah"),
                    ],
                },
            )
            age_cache(2)
            summary_stale = client.get(f"/api/farms/{farm_id}/summary", headers=auth).json()
            weather_stale = summary_stale.get("weather")
            report.check(
                "cuaca cadangan: summary menandai is_stale dan rain_next_3h benar",
                weather_stale is not None
                and weather_stale.get("is_stale") is True
                and weather_stale.get("rain_next_3h") is True,
                f"weather = {weather_stale}",
            )
        finally:
            reset_cuaca_cadangan()

        # 7. Endpoint cuaca kebun balas 502 kalau BMKG gagal dan tidak ada cache.
        calls, gagal = bmkg_gagal_dengan(lambda: _HTTPException(status_code=502, detail="gangguan"))
        bmkg_module.fetch_bmkg_weather = gagal
        try:
            with database.get_connection() as connection:
                connection.execute("DELETE FROM weather_cache WHERE adm4 = ?", (ADM4,))
            resp = client.get(f"/api/farms/{farm_id}/weather", headers=auth)
            report.check(
                "cuaca cadangan: GET weather kebun 502 saat BMKG gagal tanpa cache",
                resp.status_code == 502,
                f"status {resp.status_code}",
            )
        finally:
            reset_cuaca_cadangan()

        section("Penutup tanah")
        try:
            farm_default = client.get(f"/api/farms/{farm_id}", headers=auth).json().get("farm", {})
            report.check(
                "kebun tanpa ground_cover eksplisit -> default 'open'",
                farm_default.get("ground_cover") == "open",
                f"dapat {farm_default.get('ground_cover')}",
            )

            patch_mulch = client.patch(
                f"/api/farms/{farm_id}", json={"ground_cover": "mulch"}, headers=auth
            )
            report.check(
                "PATCH ground_cover 'mulch' tersimpan",
                patch_mulch.status_code == 200
                and patch_mulch.json().get("farm", {}).get("ground_cover") == "mulch",
                f"status {patch_mulch.status_code}, body {patch_mulch.json()}",
            )

            patch_invalid = client.patch(
                f"/api/farms/{farm_id}", json={"ground_cover": "kaca"}, headers=auth
            )
            report.check(
                "PATCH ground_cover 'kaca' ditolak 422",
                patch_invalid.status_code == 422,
                f"status {patch_invalid.status_code}",
            )

            patch_null = client.patch(
                f"/api/farms/{farm_id}", json={"ground_cover": None}, headers=auth
            )
            report.check(
                "PATCH ground_cover null ditolak 422",
                patch_null.status_code == 422,
                f"status {patch_null.status_code}",
            )

            set_cached_weather(ADM4, {**FAKE_WEATHER, "rain_next_3h": True})

            reading_mulch = client.post(
                f"/api/nodes/{node_a}/readings",
                params={"adm4": ADM4},
                json=kering_payload(),
                headers=auth,
            )
            reading_mulch_body = reading_mulch.json() if reading_mulch.status_code == 201 else {}
            summary_mulch = client.get(f"/api/farms/{farm_id}/summary", headers=auth).json()
            summary_mulch_decision = next(
                (
                    ns.get("decision", {}).get("type")
                    for ns in summary_mulch.get("nodes", [])
                    if ns.get("node", {}).get("id") == node_a
                ),
                None,
            )
            report.check(
                "kebun mulsa + hujan diprediksi -> irigasi tetap jalan (reading dan summary)",
                reading_mulch.status_code == 201
                and reading_mulch_body.get("decision", {}).get("type") == "open"
                and summary_mulch_decision == "open",
                f"status {reading_mulch.status_code}, decision {reading_mulch_body.get('decision')}, "
                f"summary {summary_mulch_decision}",
            )

            patch_roofed = client.patch(
                f"/api/farms/{farm_id}", json={"ground_cover": "roofed"}, headers=auth
            )
            reading_roofed = client.post(
                f"/api/nodes/{node_a}/readings",
                params={"adm4": ADM4},
                json=kering_payload(),
                headers=auth,
            )
            reading_roofed_body = reading_roofed.json() if reading_roofed.status_code == 201 else {}
            report.check(
                "kebun beratap + hujan diprediksi -> irigasi tetap jalan",
                patch_roofed.status_code == 200
                and reading_roofed.status_code == 201
                and reading_roofed_body.get("decision", {}).get("type") == "open",
                f"patch status {patch_roofed.status_code}, reading status {reading_roofed.status_code}, "
                f"decision {reading_roofed_body.get('decision')}",
            )

            patch_open = client.patch(
                f"/api/farms/{farm_id}", json={"ground_cover": "open"}, headers=auth
            )
            reading_open = client.post(
                f"/api/nodes/{node_a}/readings",
                params={"adm4": ADM4},
                json=kering_payload(),
                headers=auth,
            )
            reading_open_body = reading_open.json() if reading_open.status_code == 201 else {}
            report.check(
                "kebun tanah terbuka + hujan diprediksi -> irigasi ditunda",
                patch_open.status_code == 200
                and reading_open.status_code == 201
                and reading_open_body.get("decision", {}).get("type") == "delayed",
                f"patch status {patch_open.status_code}, reading status {reading_open.status_code}, "
                f"decision {reading_open_body.get('decision')}",
            )
        finally:
            client.patch(f"/api/farms/{farm_id}", json={"ground_cover": "open"}, headers=auth)
            set_cached_weather(ADM4, FAKE_WEATHER)

        section("Kode wilayah dari kebun")
        # BMKG selalu gagal, jadi hanya kode ADM4 (cache hujan) yang menghasilkan "delayed".
        calls, gagal = bmkg_gagal_dengan(lambda: _HTTPException(status_code=502, detail="gangguan"))
        bmkg_module.fetch_bmkg_weather = gagal
        try:
            set_cached_weather(ADM4, {**FAKE_WEATHER, "rain_next_3h": True})

            def kirim_reading(target_node: str, params: dict | None = None, extra: dict | None = None):
                resp = client.post(
                    f"/api/nodes/{target_node}/readings",
                    params=params,
                    json={**kering_payload(), **(extra or {})},
                    headers=auth,
                )
                body = resp.json() if resp.status_code == 201 else {}
                return resp.status_code, body.get("decision", {}).get("type"), body

            status, decision_type, _ = kirim_reading(node_a, {"adm4": "99.99.99.9999"})
            report.check(
                "kode wilayah kebun menang atas kode dari alat",
                status == 201 and decision_type == "delayed" and calls["count"] == 0,
                f"status {status}, decision {decision_type}, panggilan BMKG = {calls['count']}",
            )

            status, decision_type, _ = kirim_reading(node_a)
            report.check(
                "reading tanpa query adm4 memakai kode kebun",
                status == 201 and decision_type == "delayed",
                f"status {status}, decision {decision_type}",
            )

            status, decision_type, body = kirim_reading(
                f"node-{suffix}-wilayah", {"adm4": "99.99.99.9999"}, {"farm_id": farm_id}
            )
            report.check(
                "node baru (self-registration) memakai kode kebun",
                status == 201 and body.get("node_created") is True and decision_type == "delayed",
                f"status {status}, node_created {body.get('node_created')}, decision {decision_type}",
            )

            with database.get_connection() as connection:
                connection.execute("UPDATE farms SET bmkg_adm4_code = '' WHERE id = ?", (farm_id,))

            status, decision_type, _ = kirim_reading(node_a, {"adm4": ADM4})
            report.check(
                "kebun tanpa kode -> kode dari alat dipakai sebagai cadangan",
                status == 201 and decision_type == "delayed",
                f"status {status}, decision {decision_type}",
            )

            status, decision_type, _ = kirim_reading(node_a, {"adm4": f" {ADM4} "})
            report.check(
                "kode dari alat berspasi tetap terbaca",
                status == 201 and decision_type == "delayed",
                f"status {status}, decision {decision_type}",
            )

            status, decision_type, _ = kirim_reading(node_a, {"adm4": ""})
            report.check(
                "adm4 kosong tidak ditolak, tanpa cuaca",
                status == 201 and decision_type == "open",
                f"status {status}, decision {decision_type}",
            )

            status, decision_type, _ = kirim_reading(node_a)
            report.check(
                "tanpa kode wilayah sama sekali -> tanpa cuaca",
                status == 201 and decision_type == "open",
                f"status {status}, decision {decision_type}",
            )
        finally:
            bmkg_module.fetch_bmkg_weather = original_fetch_bmkg
            set_cached_weather(ADM4, FAKE_WEATHER)
            bmkg_module._bmkg_failed_at.clear()
            with database.get_connection() as connection:
                connection.execute(
                    "UPDATE farms SET bmkg_adm4_code = ? WHERE id = ?", (ADM4, farm_id)
                )

        section("Gateway logs")
        report.expect(
            "POST /api/farms/{id}/gateway-logs",
            client.post(
                f"/api/farms/{farm_id}/gateway-logs",
                json={"event": "connected", "detail": "smoke test"},
                headers=auth,
            ),
            201,
            ("log",),
        )
        glogs = report.expect(
            "GET /api/farms/{id}/gateway-logs",
            client.get(f"/api/farms/{farm_id}/gateway-logs", headers=auth),
            200,
            ("items", "total"),
        )
        report.check("gateway log tercatat", glogs.get("total") == 1, f"total = {glogs.get('total')}")

        section("Gateway claim/unclaim")
        unclaimed = report.expect(
            "POST /api/farms/{id}/gateway/unclaim",
            client.post(f"/api/farms/{farm_id}/gateway/unclaim", headers=auth),
            200,
            ("gateway",),
        )
        report.check("gateway terlepas dari kebun", unclaimed.get("gateway", {}).get("farm_id") is None)
        reclaimed = report.expect(
            "POST /api/farms/{id}/gateway/claim",
            client.post(
                f"/api/farms/{farm_id}/gateway/claim",
                json={"device_id": device_id, "display_name": "Gateway Smoke"},
                headers=auth,
            ),
            200,
            ("gateway",),
        )
        report.check("gateway terklaim ulang", reclaimed.get("gateway", {}).get("farm_id") == farm_id)
        second = client.post(
            f"/api/farms/{farm_id}/gateway/claim",
            json={"device_id": f"GW-KEDUA-{suffix}", "display_name": "Gateway Kedua"},
            headers=auth,
        )
        report.check(
            "klaim gateway kedua ke kebun yang sudah punya gateway ditolak 409",
            second.status_code == 409 and second.json().get("detail") == "Kebun ini sudah punya gateway",
            f"status {second.status_code}, detail {second.json().get('detail')!r}",
        )
        still = client.get(f"/api/farms/{farm_id}/gateway", headers=auth).json().get("gateway") or {}
        report.check("gateway lama tetap terpasang", still.get("device_id") == device_id)

        section("Isolasi antar user")
        other_email = f"smoke-other-{suffix}@lorafield-smoke.com"
        client.post(
            "/api/auth/register",
            json={"name": "Orang Lain", "email": other_email, "password": password},
        )
        other_login = client.post(
            "/api/auth/login",
            json={"email": other_email, "password": password},
        ).json()
        other_auth = {"Authorization": f"Bearer {other_login.get('access_token', '')}"}
        report.check(
            "user lain tidak bisa baca kebun orang",
            client.get(f"/api/farms/{farm_id}", headers=other_auth).status_code == 404,
        )
        report.check(
            "user lain tidak bisa baca summary kebun orang",
            client.get(f"/api/farms/{farm_id}/summary", headers=other_auth).status_code == 404,
        )
        other_farms = client.get("/api/farms", headers=other_auth).json()
        report.check("daftar kebun user lain kosong", other_farms.get("total") == 0, f"total = {other_farms.get('total')}")

        section("SPA serving")
        dist_ada = (BACKEND_DIR.parent / "frontend" / "dist" / "index.html").exists()
        if dist_ada:
            report.check("GET / melayani index.html", client.get("/").status_code == 200)
            report.check("SPA fallback /dashboard melayani index.html", client.get("/dashboard").status_code == 200)
            report.check(
                "URL lama /dashboard.html melayani index.html",
                client.get("/dashboard.html").status_code == 200,
            )
        else:
            report.skip("GET / dan SPA fallback", "frontend/dist belum di-build")
        report.check(
            "path /api/ tak dikenal tetap 404 (tidak ketelan SPA fallback)",
            client.get("/api/entah-apa").status_code == 404,
        )

        section("Hapus kebun")
        report.expect(
            "DELETE /api/farms/{id}",
            client.delete(f"/api/farms/{farm_id}", headers=auth),
            200,
            ("message",),
        )
        report.check(
            "kebun benar-benar hilang",
            client.get(f"/api/farms/{farm_id}", headers=auth).status_code == 404,
        )
        after = client.get(f"/api/farms/{farm_id}/gateway", headers=auth)
        report.check(
            "gateway ikut dilepas saat kebun dihapus",
            after.status_code == 404,
            f"status {after.status_code}",
        )


def main() -> int:
    with_network = "--network" in sys.argv
    report = Report()
    print(f"Database sementara: {database.DB_PATH}")
    try:
        run(report, with_network)
    except Exception as exc:  # noqa: BLE001 - smoke test, laporkan apa pun yang meledak
        report.fail("eksekusi smoke test", f"{type(exc).__name__}: {exc}")
        import traceback

        traceback.print_exc()
    finally:
        shutil.rmtree(TMP_DIR, ignore_errors=True)

    total = report.passed + len(report.failed)
    print()
    print("=" * 60)
    print(f"HASIL: {report.passed}/{total} lolos, {len(report.failed)} gagal, {len(report.skipped)} dilewati")
    if report.failed:
        print()
        print("Yang gagal:")
        for name, detail in report.failed:
            print(f"  - {name}: {detail}")
        return 1
    print("Semua cek lolos.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
