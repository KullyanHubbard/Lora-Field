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
from app.bmkg import set_cached_weather  # noqa: E402
from app.main import app  # noqa: E402


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
                },
                headers=auth,
            ),
            201,
            ("reading", "decision", "node_created", "node_status"),
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
