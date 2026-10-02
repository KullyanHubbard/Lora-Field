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

import json
import shutil
import sqlite3
import sys
import tempfile
import threading
import time
import types
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
settings.mqtt_host = ""            # jangan sambung ke broker sungguhan; bagian MQTT memakai klien palsu

from fastapi.testclient import TestClient  # noqa: E402
import app.bmkg as bmkg_module  # noqa: E402
from app.bmkg import set_cached_weather  # noqa: E402
from app.irrigation import auto_decision  # noqa: E402
from app.reading_service import apply_reading  # noqa: E402
from app import mqtt_bridge  # noqa: E402
from app import reading_service  # noqa: E402
from app.main import app  # noqa: E402
from app.node_service import default_node_name  # noqa: E402
from app.routers import auth as auth_router  # noqa: E402
from app.routers import valves  # noqa: E402
from app.schemas import MqttReadingIn, ThresholdConfig  # noqa: E402


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

        def daftar_akun(target: str, pw: str, name: str) -> None:
            """Daftar lalu verifikasi email, untuk akun yang hanya jadi bahan tes lain."""
            kode = client.post(
                "/api/auth/register", json={"name": name, "email": target, "password": pw}
            ).json().get("verification_token", "")
            client.post(
                "/api/auth/register/verify",
                json={"name": name, "email": target, "password": pw, "token": kode},
            )

        daftar = report.expect(
            "POST /api/auth/register",
            client.post(
                "/api/auth/register",
                json={"name": "Smoke Test", "email": email, "password": password, "language": "id"},
            ),
            202,
            ("message", "verification_token"),
        )
        status = client.post("/api/auth/login", json={"email": email, "password": password}).status_code
        report.check("login sebelum verifikasi email ditolak 403", status == 403, f"status {status}")
        report.expect(
            "POST /api/auth/register/verify",
            client.post(
                "/api/auth/register/verify",
                json={
                    "name": "Smoke Test",
                    "email": email,
                    "password": password,
                    "language": "id",
                    "token": daftar.get("verification_token", ""),
                },
            ),
            200,
            ("message",),
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
        report.check(
            "link email reset membawa email ter-encode di fragmen",
            len(captured_emails) == 2
            and f'/reset-password#email={email.replace("@", "%40")}"' in captured_emails[1],
            f"email = {captured_emails[1:]}",
        )
        # OTP lama sudah dimatikan oleh permintaan di atas; ambil OTP baru.
        forgot = client.post("/api/auth/forgot-password", json={"email": email}).json()
        otp = forgot.get("reset_token", "")
        if report.check("OTP terbit (expose_dev_tokens)", bool(otp), "reset_token tidak ada di response"):
            report.expect(
                "POST /api/auth/reset-password/verify",
                client.post("/api/auth/reset-password/verify", json={"email": email, "token": otp}),
                200,
            )
            report.expect(
                "POST /api/auth/reset-password",
                client.post(
                    "/api/auth/reset-password",
                    json={"email": email, "token": otp, "new_password": password},
                ),
                200,
            )
            report.check(
                "OTP tidak bisa dipakai dua kali",
                client.post("/api/auth/reset-password/verify", json={"email": email, "token": otp}).status_code == 400,
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

        section("Keamanan auth")
        sec_email = f"smoke-sec-{suffix}@lorafield-smoke.com"
        ghost = f"tidak-ada-{suffix}@lorafield-smoke.com"

        def reset_limits() -> None:
            auth_router._login_failures.clear()
            auth_router._reset_requests.clear()

        def minta_kode(target: str) -> str:
            return client.post("/api/auth/forgot-password", json={"email": target}).json().get("reset_token", "")

        def kode_salah(kode: str, geser: int = 1) -> str:
            return f"{(int(kode) + geser) % 1_000_000:06d}"

        def cek_kode(target: str, kode: str) -> int:
            return client.post(
                "/api/auth/reset-password/verify", json={"email": target, "token": kode}
            ).status_code

        def status_login(target: str, pw: str) -> int:
            return client.post("/api/auth/login", json={"email": target, "password": pw}).status_code

        def baris_reset(target: str) -> dict:
            with database.get_connection() as connection:
                row = connection.execute(
                    """
                    SELECT pr.attempts, pr.used
                    FROM password_resets pr JOIN users u ON u.id = pr.user_id
                    WHERE u.email = ?
                    ORDER BY pr.id DESC
                    LIMIT 1
                    """,
                    (target,),
                ).fetchone()
            return dict(row) if row else {}

        try:
            reset_limits()
            daftar_akun(sec_email, password, "Smoke Sec")

            status = client.post("/api/auth/reset-password/verify", json={"token": "123456"}).status_code
            report.check("A1 verify tanpa email ditolak (422)", status == 422, f"status {status}")
            kode_user1 = minta_kode(email)
            status = cek_kode(sec_email, kode_user1)
            report.check("A2 OTP user lain ditolak untuk email berbeda", status == 400, f"status {status}")
            status = cek_kode(email, kode_user1)
            report.check("A3 OTP diterima dengan email pemiliknya", status == 200, f"status {status}")

            kode_sec = minta_kode(sec_email)
            status = cek_kode(sec_email, kode_salah(kode_sec))
            row = baris_reset(sec_email)
            report.check(
                "A4 kode salah ditolak dan tercatat",
                status == 400 and row == {"attempts": 1, "used": 0},
                f"status {status}, baris {row}",
            )
            statuses = [cek_kode(sec_email, kode_salah(kode_sec)) for _ in range(3)]
            statuses.append(cek_kode(sec_email, kode_sec))
            report.check(
                "A5 setelah 4 kali salah, kode benar masih berlaku",
                statuses == [400, 400, 400, 200],
                f"status {statuses}",
            )
            statuses = [cek_kode(sec_email, kode_salah(kode_sec)), cek_kode(sec_email, kode_sec)]
            row = baris_reset(sec_email)
            report.check(
                "A6 salah ke-5 menghanguskan kode",
                statuses == [400, 400] and row == {"attempts": 5, "used": 1},
                f"status {statuses}, baris {row}",
            )
            status = client.post(
                "/api/auth/reset-password",
                json={"email": sec_email, "token": kode_sec, "new_password": password},
            ).status_code
            report.check("A7 reset-password dengan kode hangus ditolak", status == 400, f"status {status}")

            reset_limits()
            statuses = [status_login(sec_email, "password-salah") for _ in range(5)]
            statuses.append(status_login(sec_email, password))
            report.check(
                "L1 5 kali gagal login mengunci akun, password benar pun ditolak (401)",
                statuses == [401] * 6,
                f"status {statuses}",
            )
            terkunci = client.post("/api/auth/login", json={"email": sec_email, "password": password})
            salah = client.post("/api/auth/login", json={"email": email, "password": "password-salah"})
            asing = client.post("/api/auth/login", json={"email": ghost, "password": password})
            balasan = {(r.status_code, r.json().get("detail")) for r in (terkunci, salah, asing)}
            report.check(
                "K1 login terkunci, password salah, dan email tak dikenal dibalas sama persis",
                len(balasan) == 1 and next(iter(balasan))[0] == 401,
                f"balasan {balasan}",
            )
            cek_hash: list[str] = []
            verify_asli = auth_router.verify_password
            auth_router.verify_password = lambda plain, hashed: cek_hash.append(hashed) or verify_asli(plain, hashed)
            try:
                status_login(ghost, password)
                status_login(sec_email, password)
            finally:
                auth_router.verify_password = verify_asli
            report.check(
                "K2 bcrypt tetap jalan untuk email tak dikenal dan akun terkunci",
                cek_hash == [auth_router._DUMMY_PASSWORD_HASH] * 2,
                f"{len(cek_hash)} kali, dummy {[h == auth_router._DUMMY_PASSWORD_HASH for h in cek_hash]}",
            )

            reset_limits()
            statuses = [status_login(sec_email, "password-salah") for _ in range(4)]
            statuses.append(status_login(sec_email, password))
            statuses += [status_login(sec_email, "password-salah") for _ in range(4)]
            report.check(
                "L2 login berhasil mereset hitungan gagal",
                statuses == [401] * 4 + [200] + [401] * 4,
                f"status {statuses}",
            )

            reset_limits()
            statuses = [status_login(ghost, password) for _ in range(6)]
            report.check(
                "L3 login email tak terdaftar tidak dicatat",
                statuses == [401] * 6 and len(auth_router._login_failures) == 0,
                f"status {statuses}, catatan {len(auth_router._login_failures)}",
            )

            reset_limits()
            respons = [client.post("/api/auth/forgot-password", json={"email": sec_email}) for _ in range(6)]
            report.check(
                "F1 forgot-password dibatasi 5 kode per hari, tanpa 429",
                [r.status_code for r in respons] == [200] * 6
                and [bool(r.json().get("reset_token")) for r in respons] == [True] * 5 + [False]
                and respons[5].json().get("message") == respons[0].json().get("message"),
                f"status {[r.status_code for r in respons]}, kode {[bool(r.json().get('reset_token')) for r in respons]}",
            )
            statuses = [
                client.post("/api/auth/forgot-password", json={"email": ghost}).status_code
                for _ in range(6)
            ]
            report.check(
                "F2 forgot-password email tak terdaftar selalu 200",
                statuses == [200] * 6,
                f"status {statuses}",
            )

            reset_limits()
            # Yang diuji memori pembatas, bukan bcrypt: pengecek password diganti versi cepat.
            verify_asli = auth_router.verify_password
            auth_router.verify_password = lambda plain, hashed: False
            try:
                for i in range(300):
                    acak = f"acak{i}-{suffix}@lorafield-smoke.com"
                    client.post("/api/auth/login", json={"email": acak, "password": password})
                    client.post("/api/auth/forgot-password", json={"email": acak})
            finally:
                auth_router.verify_password = verify_asli
            report.check(
                "M1 banjir email acak tidak mengisi memori pembatas",
                len(auth_router._login_failures) == 0 and len(auth_router._reset_requests) == 0,
                f"login {len(auth_router._login_failures)}, reset {len(auth_router._reset_requests)}",
            )

            reset_limits()
            kode_sec = minta_kode(sec_email)
            compare_calls: list[int] = []
            original_compare = auth_router.secrets.compare_digest

            def hitung_compare(a, b):
                compare_calls.append(1)
                return original_compare(a, b)

            auth_router.secrets.compare_digest = hitung_compare
            try:
                threads = [
                    threading.Thread(target=cek_kode, args=(sec_email, kode_salah(kode_sec, geser)))
                    for geser in range(1, 31)
                ]
                for thread in threads:
                    thread.start()
                for thread in threads:
                    thread.join()
            finally:
                auth_router.secrets.compare_digest = original_compare
            row = baris_reset(sec_email)
            report.check(
                "P1 30 tebakan OTP paralel hanya 5 yang dicocokkan",
                len(compare_calls) == 5 and row == {"attempts": 5, "used": 1},
                f"dicocokkan {len(compare_calls)}, baris {row}",
            )

            reset_limits()
            original_verify = auth_router.verify_password

            hash_dicek: list[str] = []

            def verify_lambat(plain, hashed):
                hash_dicek.append(hashed)
                time.sleep(0.2)
                return original_verify(plain, hashed)

            login_statuses: list[int] = []
            auth_router.verify_password = verify_lambat
            try:
                threads = [
                    threading.Thread(
                        target=lambda: login_statuses.append(status_login(sec_email, "password-salah"))
                    )
                    for _ in range(20)
                ]
                for thread in threads:
                    thread.start()
                for thread in threads:
                    thread.join()
            finally:
                auth_router.verify_password = original_verify
            asli = [h for h in hash_dicek if h != auth_router._DUMMY_PASSWORD_HASH]
            report.check(
                "P2 20 login paralel: tepat 5 dicek dengan password asli, semua 401",
                sorted(login_statuses) == [401] * 20 and len(asli) == 5,
                f"status {sorted(login_statuses)}, dicek asli {len(asli)}",
            )
        finally:
            reset_limits()

        section("Verifikasi email")
        pw_baru = "verif-pass-123"

        def daftar_mentah(target: str, pw: str, name: str = "Petani Uji"):
            return client.post("/api/auth/register", json={"name": name, "email": target, "password": pw})

        def verifikasi(target: str, kode: str, pw: str, name: str = "Petani Uji") -> int:
            return client.post(
                "/api/auth/register/verify",
                json={"name": name, "email": target, "password": pw, "token": kode},
            ).status_code

        def baris_user(target: str) -> dict:
            with database.get_connection() as connection:
                row = connection.execute(
                    "SELECT name, email_verified_at, created_at FROM users WHERE email = ?", (target,)
                ).fetchone()
            return dict(row) if row else {}

        terkirim: list[tuple[str, str, str]] = []
        original_send = auth_router.send_email_via_resend
        auth_router.send_email_via_resend = lambda to, subject, html: terkirim.append((to, subject, html)) or False
        try:
            reset_limits()
            baru_email = f"verif-{suffix}@lorafield-smoke.com"
            baru = daftar_mentah(baru_email, pw_baru, name="Klik http://spam.example")
            lama = daftar_mentah(email, pw_baru)
            baru_body, lama_body = baru.json(), lama.json()
            report.check(
                "V1 respons daftar sama untuk email baru dan email yang sudah terdaftar",
                baru.status_code == lama.status_code == 202
                and baru_body.get("message") == lama_body.get("message")
                and "id" not in baru_body
                and "verification_token" not in lama_body,
                f"baru {baru.status_code} {baru_body}, lama {lama.status_code} {lama_body}",
            )
            kode_baru = baru_body.get("verification_token", "")
            report.check(
                "V2 email verifikasi hanya ke email baru, tanpa isi dari pengguna",
                len(terkirim) == 1
                and terkirim[0][0] == baru_email
                and kode_baru in terkirim[0][2]
                and "spam.example" not in terkirim[0][1] + terkirim[0][2]
                and "href" not in terkirim[0][2],
                f"terkirim {[(t[0], t[1]) for t in terkirim]}",
            )
            report.check(
                "V3 daftar email baru tidak mengisi memori pembatas",
                len(auth_router._reset_requests) == 0,
                f"catatan {len(auth_router._reset_requests)}",
            )
            statuses = [status_login(email, password), status_login(email, pw_baru)]
            report.check(
                "V4 daftar ulang email terdaftar tidak mengubah password",
                statuses == [200, 401],
                f"status {statuses}",
            )
            statuses = [status_login(baru_email, pw_baru), status_login(baru_email, "password-salah")]
            report.check(
                "V5 akun belum verifikasi tidak bisa login (403), password salah tetap 401",
                statuses == [403, 401],
                f"status {statuses}",
            )
            statuses = [verifikasi(baru_email, kode_salah(kode_baru), pw_baru), verifikasi(baru_email, kode_baru, pw_baru)]
            statuses.append(status_login(baru_email, pw_baru))
            report.check(
                "V6 kode salah ditolak, kode benar memverifikasi lalu login berhasil",
                statuses == [400, 200, 200] and baris_user(baru_email).get("name") == "Petani Uji",
                f"status {statuses}, baris {baris_user(baru_email)}",
            )
            status = verifikasi(baru_email, kode_baru, pw_baru)
            report.check("V7 kode verifikasi tidak bisa dipakai dua kali", status == 400, f"status {status}")

            reset_limits()
            korban = f"korban-{suffix}@lorafield-smoke.com"
            daftar_mentah(korban, "pw-penyerang", name="Penyerang")
            daftar_mentah(korban, "pw-korban", name="Korban Asli")
            # Penyerang daftar ulang: kode baru tetap hanya terkirim ke kotak masuk korban.
            kode_terakhir = daftar_mentah(korban, "pw-penyerang", name="Penyerang").json().get(
                "verification_token", ""
            )
            verifikasi(korban, kode_terakhir, "pw-korban", name="Korban Asli")
            statuses = [status_login(korban, "pw-penyerang"), status_login(korban, "pw-korban")]
            report.check(
                "V8 pendaftar lebih dulu tidak bisa membajak akun, password dari pemegang kode",
                statuses == [401, 200] and baris_user(korban).get("name") == "Korban Asli",
                f"status {statuses}, baris {baris_user(korban)}",
            )

            reset_limits()
            ulang = f"ulang-{suffix}@lorafield-smoke.com"
            respons = [daftar_mentah(ulang, pw_baru) for _ in range(8)]
            kode_terbit = sum(1 for r in respons if r.json().get("verification_token"))
            report.check(
                "V9 daftar ulang dibatasi 1 + 5 kode per hari, tanpa 429",
                [r.status_code for r in respons] == [202] * 8 and kode_terbit == 6,
                f"status {[r.status_code for r in respons]}, kode {kode_terbit}",
            )

            def kirim_gagal(to, subject, html):
                raise RuntimeError("Resend mati")

            auth_router.send_email_via_resend = kirim_gagal
            # Klien ketat: error yang lolos dari background task ikut dilempar ke sini.
            try:
                status = TestClient(app).post(
                    "/api/auth/register",
                    json={"name": "Petani Uji", "email": f"resend-mati-{suffix}@lorafield-smoke.com", "password": pw_baru},
                ).status_code
            except Exception as exc:  # noqa: BLE001 - justru yang dicari
                status = f"error lolos: {exc!r}"
            report.check("V10 email gagal terkirim tidak menggagalkan daftar", status == 202, f"status {status}")
        finally:
            auth_router.send_email_via_resend = original_send
            reset_limits()

        hash_calls: list[int] = []
        original_hash = auth_router.hash_password
        auth_router.hash_password = lambda plain: hash_calls.append(1) or original_hash(plain)
        try:
            daftar_mentah(email, pw_baru)
        finally:
            auth_router.hash_password = original_hash
        report.check(
            "V11 password tetap di-hash untuk email terdaftar (lama respons tidak membedakan)",
            len(hash_calls) == 1,
            f"hash dipanggil {len(hash_calls)}x",
        )

        try:
            reset_limits()
            lupa = f"lupa-verif-{suffix}@lorafield-smoke.com"
            daftar_mentah(lupa, pw_baru)
            kode = minta_kode(lupa)
            client.post("/api/auth/reset-password", json={"email": lupa, "token": kode, "new_password": pw_baru})
            status = status_login(lupa, pw_baru)
            report.check("V12 reset password ikut memverifikasi akun", status == 200, f"status {status}")

            restart = f"restart-{suffix}@lorafield-smoke.com"
            daftar_mentah(restart, pw_baru)
            database.init_db()
            status = status_login(restart, pw_baru)
            report.check("V13 restart server tidak memverifikasi akun baru", status == 403, f"status {status}")

            # Akun dengan email sama dibuat permintaan lain tepat di antara cek email dan INSERT.
            bersamaan = f"bersamaan-{suffix}@lorafield-smoke.com"
            uuid_asli = auth_router.uuid

            def sisip_dulu():
                with database.get_connection() as connection:
                    connection.execute(
                        "INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, 'Duluan', 'x')",
                        (f"user-duluan-{suffix}", bersamaan),
                    )
                return uuid_asli.uuid4()

            auth_router.uuid = types.SimpleNamespace(uuid4=sisip_dulu)
            try:
                respons = daftar_mentah(bersamaan, pw_baru)
            finally:
                auth_router.uuid = uuid_asli
            with database.get_connection() as connection:
                jumlah = connection.execute("SELECT COUNT(*) FROM users WHERE email = ?", (bersamaan,)).fetchone()[0]
            report.check(
                "V14 email sama didaftarkan bersamaan: 202 tanpa error, satu akun",
                respons.status_code == 202 and "verification_token" not in respons.json() and jumlah == 1,
                f"status {respons.status_code}, body {respons.text[:120]}, akun {jumlah}",
            )
        finally:
            reset_limits()

        # Akun belum verifikasi yang kedaluwarsa dihapus saat ada pendaftaran berikutnya.
        def buat_akun_lama(target: str, umur_hari: int, verified: bool, punya_kebun: bool = False) -> None:
            user_id = f"user-lama-{target.split('@')[0]}"
            with database.get_connection() as connection:
                connection.execute(
                    """
                    INSERT INTO users (id, email, name, password_hash, created_at, email_verified_at)
                    VALUES (?, ?, 'Lama', 'x', datetime('now', ?), CASE WHEN ? THEN CURRENT_TIMESTAMP END)
                    """,
                    (user_id, target, f"-{umur_hari} days", verified),
                )
                connection.execute(
                    "INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, '2000-01-01')",
                    (user_id, f"lama-{target}"),
                )
                if punya_kebun:
                    connection.execute(
                        "INSERT INTO farms (id, user_id, name, bmkg_adm4_code) VALUES (?, ?, 'Kebun Lama', '')",
                        (f"farm-{user_id}", user_id),
                    )

        kedaluwarsa = f"kedaluwarsa-{suffix}@lorafield-smoke.com"
        muda = f"muda-{suffix}@lorafield-smoke.com"
        tua_verified = f"tua-verified-{suffix}@lorafield-smoke.com"
        tua_berkebun = f"tua-kebun-{suffix}@lorafield-smoke.com"
        buat_akun_lama(kedaluwarsa, 8, verified=False)
        buat_akun_lama(muda, 6, verified=False)
        buat_akun_lama(tua_verified, 30, verified=True)
        buat_akun_lama(tua_berkebun, 30, verified=False, punya_kebun=True)
        reset_limits()
        daftar_mentah(f"pemicu-{suffix}@lorafield-smoke.com", pw_baru)
        with database.get_connection() as connection:
            sisa = {
                row["email"]
                for row in connection.execute(
                    "SELECT email FROM users WHERE email IN (?, ?, ?, ?)", (kedaluwarsa, muda, tua_verified, tua_berkebun)
                )
            }
            kode_yatim = connection.execute(
                "SELECT COUNT(*) FROM password_resets WHERE user_id NOT IN (SELECT id FROM users)"
            ).fetchone()[0]
        report.check(
            "K3 akun belum verifikasi > 7 hari dihapus, yang lain tetap",
            sisa == {muda, tua_verified, tua_berkebun} and kode_yatim == 0,
            f"sisa {sisa}, kode tanpa akun {kode_yatim}",
        )
        ulang = daftar_mentah(kedaluwarsa, pw_baru).json()
        report.check(
            "K4 email akun yang dihapus bisa daftar lagi dan dapat kode",
            bool(ulang.get("verification_token")),
            f"respons {ulang}",
        )
        with database.get_connection() as connection:
            connection.execute("DELETE FROM farms WHERE id = ?", (f"farm-user-lama-tua-kebun-{suffix}",))

        # Migrasi: database lama tanpa kolom email_verified_at. Akun lamanya harus dianggap terverifikasi.
        db_asli = database.DB_PATH
        database.DB_PATH = TMP_DIR / "migrasi.db"
        try:
            lama_conn = sqlite3.connect(database.DB_PATH)
            lama_conn.executescript(
                """
                CREATE TABLE users (
                    id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
                    password_hash TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                INSERT INTO users (id, email, name, password_hash, created_at)
                VALUES ('user-lama', 'lama@lorafield-smoke.com', 'Akun Lama', 'x', '2026-01-02 03:04:05');
                """
            )
            lama_conn.commit()
            lama_conn.close()
            database.init_db()
            baris = baris_user("lama@lorafield-smoke.com")
        finally:
            database.DB_PATH = db_asli
        report.check(
            "V15 migrasi: akun lama dianggap terverifikasi sejak dibuat",
            baris.get("email_verified_at") == "2026-01-02 03:04:05",
            f"baris {baris}",
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
        # Batas gateway terpisah dari batas node (temuan 2026-10-02): gateway tanpa node hanya mengirim
        # heartbeat tiap 10 menit, jadi batas node yang pendek tidak boleh membuatnya offline bergantian.
        batas_node_asli = settings.node_offline_after_minutes
        settings.node_offline_after_minutes = 5
        try:
            def summary_setelah_diam(tabel: str, menit: int) -> dict:
                with database.get_connection() as connection:
                    connection.execute(
                        f"UPDATE {tabel} SET last_seen_at = datetime('now', ?) WHERE farm_id = ?",
                        (f"-{menit} minutes", farm_id),
                    )
                return client.get(f"/api/farms/{farm_id}/summary", headers=auth).json()

            jeda_heartbeat = summary_setelah_diam("gateways", 8)
            report.check(
                "gateway diam 8 menit (di antara heartbeat 10 menit) tetap online walau batas node 5 menit",
                jeda_heartbeat.get("gateway_status") == "online",
                f"gateway={jeda_heartbeat.get('gateway_status')}",
            )
            gateway_hilang = summary_setelah_diam("gateways", 16)
            report.check(
                "gateway diam 16 menit (lewat batas gateway 15 menit) -> offline",
                gateway_hilang.get("gateway_status") == "offline",
                f"gateway={gateway_hilang.get('gateway_status')}",
            )
            node_diam = summary_setelah_diam("nodes", 8)
            report.check(
                "node diam 8 menit dengan batas node 5 menit tetap offline (batas node tidak berubah)",
                node_diam.get("nodes_online") == 0 and node_diam.get("nodes_problem") == 3,
                f"online={node_diam.get('nodes_online')} problem={node_diam.get('nodes_problem')}",
            )
        finally:
            settings.node_offline_after_minutes = batas_node_asli
            with database.get_connection() as connection:
                connection.execute(
                    "UPDATE nodes SET last_seen_at = datetime('now', '-1 day') WHERE farm_id = ?",
                    (farm_id,),
                )
                connection.execute(
                    "UPDATE gateways SET last_seen_at = CURRENT_TIMESTAMP WHERE farm_id = ?",
                    (farm_id,),
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
                "soil_moisture": 50.0,
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
            # Riwayat hanya ditulis saat keputusan berubah, jadi kosongkan riwayat node_a
            # supaya reading ini pasti menulis baris baru yang bisa dicek.
            with database.get_connection() as connection:
                connection.execute("DELETE FROM decision_logs WHERE node_id = ?", (node_a,))
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

        section("Siram bertahap")
        padi = ThresholdConfig(lower=60, upper=80)
        now = datetime.now(timezone.utc)

        def ago(minutes: int) -> str:
            return (now - timedelta(minutes=minutes)).strftime("%Y-%m-%d %H:%M:%S")

        # (nama, kelembapan, hujan, pulsa, mulai pulsa, batas pulsa) -> (tipe, pulsa di state).
        # "-" = auto_pulse_count tidak ada di state hasil. Hanya S6 yang mengisi auto_limit_at.
        kasus = [
            ("S1", 50, False, 0, None, None, "open", 1),
            ("S2", 55, False, 1, ago(5), None, "open", "-"),
            ("S3", 65, False, 1, ago(15), None, "soaking", "-"),
            ("S4", 65, False, 1, ago(45), None, "open", 2),
            ("S5", 76, False, 2, ago(45), None, "standby", 0),
            ("S6", 65, False, 4, ago(45), None, "pulse_limit", 0),
            ("S7", 50, False, 0, None, ago(60), "pulse_limit", "-"),
            ("S8", 50, False, 0, None, ago(240), "open", 1),
            ("S9", 50, True, 0, None, None, "delayed", "-"),
            ("S10", 30, True, 0, None, None, "open", 1),
            ("S11", 30, False, 0, None, ago(60), "pulse_limit", "-"),
            ("S12", 50, True, 2, ago(5), None, "delayed", 0),
            ("S13", 70, False, 0, None, None, "standby", "-"),
            ("S14", 85, False, 0, None, None, "closed", "-"),
        ]
        for nama, moisture, rain, count, started, limit, tipe, count_baru in kasus:
            decision, state = auto_decision(
                moisture,
                rain,
                padi,
                {"auto_pulse_count": count, "auto_pulse_started_at": started, "auto_limit_at": limit},
                now,
            )
            report.check(
                f"{nama} {moisture}% {'hujan' if rain else 'tanpa hujan'}, pulsa {count} -> {tipe}",
                decision["type"] == tipe
                and state.get("auto_pulse_count", "-") == count_baru
                and ("auto_limit_at" in state) == (nama == "S6"),
                f"dapat {decision['type']}, state {state}",
            )

        pulse_state = {
            "auto_pulse_count": 1,
            "auto_pulse_started_at": ago(5),
            "auto_limit_at": None,
            "auto_cycle_baseline": 50.0,
            "auto_confirmed_pulse_count": 0,
            "auto_paused_at": None,
        }
        _, confirmed = auto_decision(50, False, padi, pulse_state, now, "open")
        report.check(
            "laporan valve buka mengonfirmasi satu pulsa",
            confirmed.get("auto_confirmed_pulse_count") == 1,
            f"state {confirmed}",
        )
        pulse_state.update(confirmed)
        pulse_state["auto_pulse_started_at"] = ago(
            settings.auto_pulse_minutes + settings.auto_soak_minutes + 5
        )
        decision, second = auto_decision(50, False, padi, pulse_state, now, "closed")
        report.check(
            "pulsa kedua menunggu bacaan setelah resapan",
            decision["type"] == "open" and second.get("auto_pulse_count") == 2,
            f"decision {decision}, state {second}",
        )
        pulse_state.update(second)
        pulse_state["auto_pulse_started_at"] = ago(5)
        _, confirmed = auto_decision(50, False, padi, pulse_state, now, "open")
        pulse_state.update(confirmed)
        pulse_state["auto_pulse_started_at"] = ago(
            settings.auto_pulse_minutes + settings.auto_soak_minutes + 5
        )
        decision, paused = auto_decision(50, False, padi, pulse_state, now, "closed")
        report.check(
            "dua pulsa terkonfirmasi tanpa kenaikan menjeda node",
            decision["type"] == "check_irrigation" and paused.get("auto_paused_at") is not None,
            f"decision {decision}, state {paused}",
        )
        http_decision, http_paused = auto_decision(50, False, padi, pulse_state, now)
        report.check(
            "bacaan HTTP juga menjeda setelah dua pulsa terkonfirmasi",
            http_decision["type"] == "check_irrigation"
            and http_decision["valve_state"] == "closed"
            and http_paused.get("auto_paused_at") is not None,
            f"decision {http_decision}, state {http_paused}",
        )
        summary_decision, summary_state = auto_decision(
            50, False, padi, pulse_state, now, advance_after_soak=False
        )
        report.check(
            "ringkasan menunggu bacaan baru setelah resapan",
            summary_decision["type"] == "soaking" and not summary_state,
            f"decision {summary_decision}, state {summary_state}",
        )
        for moisture in (49.0, 50.0, 50.5, 51.9):
            fluctuating, paused_state = auto_decision(
                moisture, False, padi, pulse_state, now, "closed"
            )
            report.check(
                f"sensor naik turun di {moisture}% tetap menjeda setelah dua pulsa",
                fluctuating["type"] == "check_irrigation"
                and paused_state.get("auto_paused_at") is not None,
                f"decision {fluctuating}, state {paused_state}",
            )
        for moisture in (52.0, 53.0):
            rising, next_state = auto_decision(moisture, False, padi, pulse_state, now, "closed")
            report.check(
                f"kenaikan {moisture - 50.0} poin tidak menjeda node",
                rising["type"] == "open" and next_state.get("auto_paused_at") is None,
                f"decision {rising}, state {next_state}",
            )
        for pulse_count in (3, 4):
            later_state = {
                **pulse_state,
                "auto_pulse_count": pulse_count,
                "auto_confirmed_pulse_count": pulse_count,
            }
            decision, paused_state = auto_decision(51.9, False, padi, later_state, now, "closed")
            report.check(
                f"kenaikan kecil setelah pulsa ke-{pulse_count} menjeda node",
                decision["type"] == "check_irrigation"
                and paused_state.get("auto_paused_at") is not None,
                f"decision {decision}, state {paused_state}",
            )
        third_state = {**pulse_state, "auto_pulse_count": 3, "auto_confirmed_pulse_count": 3}
        third_rising, third_result = auto_decision(52.0, False, padi, third_state, now, "closed")
        report.check(
            "kenaikan tepat dua poin setelah pulsa ketiga tidak menjeda",
            third_rising["type"] == "open" and third_result.get("auto_paused_at") is None,
            f"decision {third_rising}, state {third_result}",
        )
        fourth_state = {**pulse_state, "auto_pulse_count": 4, "auto_confirmed_pulse_count": 4}
        fourth_rising, fourth_result = auto_decision(52.0, False, padi, fourth_state, now, "closed")
        report.check(
            "kenaikan tepat dua poin setelah pulsa keempat tidak menjeda",
            fourth_rising["type"] == "pulse_limit"
            and fourth_result.get("auto_paused_at") is None,
            f"decision {fourth_rising}, state {fourth_result}",
        )
        unconfirmed, _ = auto_decision(
            50, False, padi, {**pulse_state, "auto_confirmed_pulse_count": 1}, now, "closed"
        )
        report.check(
            "pulsa tanpa laporan valve buka tidak dihitung",
            unconfirmed["type"] == "open",
            f"decision {unconfirmed}",
        )
        third_unconfirmed, _ = auto_decision(
            51.9,
            False,
            padi,
            {**third_state, "auto_confirmed_pulse_count": 2},
            now,
            "closed",
        )
        report.check(
            "pulsa ketiga tanpa konfirmasi valve buka tidak menjeda",
            third_unconfirmed["type"] == "open",
            f"decision {third_unconfirmed}",
        )
        latched, _ = auto_decision(
            80, False, padi, {**pulse_state, "auto_paused_at": ago(5)}, now, "closed"
        )
        report.check(
            "kenaikan kelembapan tidak menghapus jeda tanpa pemeriksaan pengguna",
            latched["type"] == "check_irrigation",
            f"decision {latched}",
        )

        def pulsa_node_a() -> int:
            with database.get_connection() as connection:
                return connection.execute(
                    "SELECT auto_pulse_count FROM nodes WHERE id = ?", (node_a,)
                ).fetchone()["auto_pulse_count"]

        def ubah_node_a(assignments: str) -> None:
            with database.get_connection() as connection:
                connection.execute(f"UPDATE nodes SET {assignments} WHERE id = ?", (node_a,))

        def kirim_node_a(payload: dict) -> dict:
            resp = client.post(f"/api/nodes/{node_a}/readings", json=payload, headers=auth)
            return (resp.json() if resp.status_code == 201 else {}).get("decision", {})

        try:
            ubah_node_a("auto_pulse_count = 0, auto_pulse_started_at = NULL, auto_limit_at = NULL")
            decision = kirim_node_a(kering_payload())
            report.check(
                "reading kering -> pulsa pertama, valve dibuka",
                decision.get("type") == "open" and pulsa_node_a() == 1,
                f"decision {decision}, pulsa {pulsa_node_a()}",
            )

            ubah_node_a("auto_pulse_started_at = datetime('now', '-15 minutes')")
            decision = kirim_node_a({**kering_payload(), "soil_moisture": 65.0})
            report.check(
                "pulsa selesai -> valve ditutup menunggu air meresap",
                decision.get("type") == "soaking" and decision.get("valve_state") == "closed",
                f"decision {decision}",
            )

            summary_soak = client.get(f"/api/farms/{farm_id}/summary", headers=auth).json()
            soak_type = next(
                (
                    (ns.get("decision") or {}).get("type")
                    for ns in summary_soak.get("nodes", [])
                    if ns["node"]["id"] == node_a
                ),
                None,
            )
            report.check("summary ikut menampilkan soaking", soak_type == "soaking", f"dapat {soak_type}")

            ke_manual = client.patch(
                f"/api/farms/{farm_id}/irrigation-mode", json={"mode": "manual"}, headers=auth
            )
            ke_auto = client.patch(
                f"/api/farms/{farm_id}/irrigation-mode", json={"mode": "auto"}, headers=auth
            )
            report.check(
                "ganti mode mereset siklus siram",
                ke_manual.status_code == 200 and ke_auto.status_code == 200 and pulsa_node_a() == 0,
                f"status {ke_manual.status_code}/{ke_auto.status_code}, pulsa {pulsa_node_a()}",
            )

            ubah_node_a(
                "auto_pulse_count = 3, auto_pulse_started_at = datetime('now', '-1 day'), "
                "auto_limit_at = NULL, last_seen_at = datetime('now', '-1 day')"
            )
            decision = kirim_node_a(kering_payload())
            report.check(
                "node sempat offline -> siklus baru, bukan pulsa ke-4",
                decision.get("type") == "open" and pulsa_node_a() == 1,
                f"decision {decision}, pulsa {pulsa_node_a()}",
            )

            def seed_two_confirmed_pulses() -> None:
                with database.get_connection() as connection:
                    connection.execute(
                        """
                        UPDATE nodes
                        SET auto_pulse_count = ?, auto_pulse_started_at = ?,
                            auto_cycle_baseline = ?, auto_confirmed_pulse_count = ?,
                            auto_paused_at = NULL, last_seen_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                        """,
                        (
                            settings.auto_no_rise_pulses,
                            ago(settings.auto_pulse_minutes + settings.auto_soak_minutes + 5),
                            50.0,
                            settings.auto_no_rise_pulses,
                            node_a,
                        ),
                    )

            seed_two_confirmed_pulses()
            pending_summary = client.get(f"/api/farms/{farm_id}/summary", headers=auth).json()
            pending_node = next(ns for ns in pending_summary["nodes"] if ns["node"]["id"] == node_a)
            report.check(
                "summary tidak mengarang pulsa ketiga sebelum bacaan baru",
                pending_node["decision"]["type"] == "soaking"
                and pending_node["node"]["auto_paused_at"] is None,
                f"node {pending_node}",
            )
            with database.get_connection() as connection:
                farm = dict(
                    connection.execute("SELECT * FROM farms WHERE id = ?", (farm_id,)).fetchone()
                )
                _, decision = apply_reading(
                    connection,
                    node_a,
                    farm,
                    MqttReadingIn.model_validate({**kering_payload(), "valve": "closed"}),
                    FAKE_WEATHER,
                )
            report.check(
                "bacaan MQTT menjeda otomatis pada node yang tidak membaik",
                decision["type"] == "check_irrigation",
                f"decision {decision}",
            )
            summary_paused = client.get(f"/api/farms/{farm_id}/summary", headers=auth).json()
            paused_node = next(ns for ns in summary_paused["nodes"] if ns["node"]["id"] == node_a)
            report.check(
                "summary menampilkan jeda per node",
                paused_node["node"]["auto_paused_at"] is not None
                and paused_node["decision"]["type"] == "check_irrigation",
                f"node {paused_node}",
            )
            other_node = next(ns for ns in summary_paused["nodes"] if ns["node"]["id"] == node_b)
            report.check(
                "jeda hanya berlaku untuk node yang tidak membaik",
                other_node["node"]["auto_paused_at"] is None,
                f"node {other_node}",
            )
            client.patch(
                f"/api/farms/{farm_id}/irrigation-mode", json={"mode": "manual"}, headers=auth
            )
            rejected = client.post(f"/api/nodes/{node_a}/irrigation/resume", headers=auth)
            report.check(
                "jeda tidak bisa diaktifkan lagi saat mode manual",
                rejected.status_code == 409,
                f"status {rejected.status_code}",
            )
            client.patch(
                f"/api/farms/{farm_id}/irrigation-mode", json={"mode": "auto"}, headers=auth
            )
            report.check(
                "ganti mode tidak menghapus jeda pengaman",
                next(
                    ns
                    for ns in client.get(f"/api/farms/{farm_id}/summary", headers=auth).json()[
                        "nodes"
                    ]
                    if ns["node"]["id"] == node_a
                )["node"]["auto_paused_at"] is not None,
                "jeda hilang setelah ganti mode",
            )
            resumed = client.post(f"/api/nodes/{node_a}/irrigation/resume", headers=auth)
            report.check(
                "pengguna mengaktifkan lagi otomatis node",
                resumed.status_code == 200 and resumed.json()["node"]["auto_paused_at"] is None,
                f"status {resumed.status_code}",
            )
            seed_two_confirmed_pulses()
            http_decision = kirim_node_a(kering_payload())
            report.check(
                "route HTTP menjeda node setelah dua pulsa terkonfirmasi",
                http_decision.get("type") == "check_irrigation"
                and http_decision.get("valve_state") == "closed",
                f"decision {http_decision}",
            )
            client.post(f"/api/nodes/{node_a}/irrigation/resume", headers=auth)
        finally:
            client.patch(f"/api/farms/{farm_id}/irrigation-mode", json={"mode": "auto"}, headers=auth)

        section("Curah hujan")
        from app.bmkg import rain_outlook  # noqa: E402

        def tp_slot(tp: float | None, desc: str) -> dict:
            return {"weather_desc": desc} if tp is None else {"weather_desc": desc, "tp": tp}

        kasus_hujan = [
            ("R1", [(2.2, "Hujan Ringan"), (2.0, "Hujan Ringan")], (False, 4.2)),
            ("R2", [(1.0, "Hujan Ringan"), (4.0, "Hujan Ringan")], (True, 5.0)),
            ("R3", [(6.4, "Hujan Sedang"), (0, "Berawan")], (True, 6.4)),
            ("R4", [(1.5, "Hujan Petir"), (0, "Cerah")], (False, 1.5)),
            ("R5", [(None, "Hujan Ringan"), (0, "Cerah")], (True, None)),
            ("R6", [(None, "Cerah")], (False, None)),
            ("R7", [], (False, None)),
        ]
        for nama, isi, harapan in kasus_hujan:
            hasil = rain_outlook([tp_slot(tp, desc) for tp, desc in isi])
            report.check(f"{nama} {isi} -> {harapan}", hasil == harapan, f"dapat {hasil}")

        def reset_siklus_node_a() -> None:
            ubah_node_a("auto_pulse_count = 0, auto_pulse_started_at = NULL, auto_limit_at = NULL")

        def cache_tp(tp1: float, tp2: float) -> dict:
            return {
                **FAKE_WEATHER,
                "forecast": [
                    {**slot(-1, "Hujan Ringan"), "tp": tp1},
                    {**slot(2, "Hujan Ringan"), "tp": tp2},
                ],
            }

        # H1-H2: jalur cache lama, total tp dihitung ulang dari forecast.
        for nama, tp1, tp2, tipe in [("H1", 2.0, 2.0, "open"), ("H2", 3.0, 3.0, "delayed")]:
            _, gagal = bmkg_gagal_dengan(lambda: _HTTPException(status_code=502, detail="gangguan"))
            bmkg_module.fetch_bmkg_weather = gagal
            try:
                reset_siklus_node_a()
                set_cached_weather(ADM4, cache_tp(tp1, tp2))
                age_cache(2)
                decision = kirim_node_a(kering_payload())
                weather = (
                    client.get(f"/api/farms/{farm_id}/summary", headers=auth).json().get("weather")
                    or {}
                )
                total = round(tp1 + tp2, 1)
                report.check(
                    f"{nama} cache lama tp {tp1}+{tp2} mm -> {tipe}",
                    decision.get("type") == tipe
                    and weather.get("rain_next_3h") is (tipe == "delayed")
                    and weather.get("rain_next_3h_mm") == total,
                    f"decision {decision.get('type')}, weather rain {weather.get('rain_next_3h')}/"
                    f"{weather.get('rain_next_3h_mm')}",
                )
            finally:
                bmkg_module.fetch_bmkg_weather = original_fetch_bmkg
                set_cached_weather(ADM4, FAKE_WEATHER)
                bmkg_module._bmkg_failed_at.clear()
                reset_siklus_node_a()

        # H3-H4: jalur data BMKG baru. Ganti httpx milik bmkg saja, TestClient juga memakai httpx.
        original_httpx = bmkg_module.httpx

        def bmkg_palsu(tps: list[float]):
            cuaca = []
            for i, tp in enumerate(tps):
                s = slot(3 * i, "Hujan Ringan")
                cuaca.append({**s, "local_datetime": s["utc_datetime"], "weather": 61, "tp": tp})

            class Response:
                def raise_for_status(self) -> None:
                    pass

                def json(self) -> dict:
                    return {"lokasi": {}, "data": [{"cuaca": [cuaca]}]}

            class Client:
                def __init__(self, **kwargs) -> None:
                    pass

                def __enter__(self):
                    return self

                def __exit__(self, *args) -> None:
                    pass

                def get(self, *args, **kwargs) -> Response:
                    return Response()

            return types.SimpleNamespace(
                Client=Client,
                HTTPStatusError=original_httpx.HTTPStatusError,
                HTTPError=original_httpx.HTTPError,
            )

        for nama, tps, tipe in [("H3", [2.2, 2.0, 0], "open"), ("H4", [6.5, 0, 0], "delayed")]:
            bmkg_module.fetch_bmkg_weather = original_fetch_bmkg
            bmkg_module.httpx = bmkg_palsu(tps)
            try:
                reset_siklus_node_a()
                age_cache(2)
                decision = kirim_node_a(kering_payload())
                with database.get_connection() as connection:
                    row = connection.execute(
                        "SELECT data FROM weather_cache WHERE adm4 = ?", (ADM4,)
                    ).fetchone()
                cache = json.loads(row["data"]) if row else {}
                total = round(tps[0] + tps[1], 1)
                report.check(
                    f"{nama} BMKG baru tp {tps} -> {tipe}",
                    decision.get("type") == tipe
                    and cache.get("rain_next_3h") is (tipe == "delayed")
                    and cache.get("rain_next_3h_mm") == total,
                    f"decision {decision.get('type')}, cache rain {cache.get('rain_next_3h')}/"
                    f"{cache.get('rain_next_3h_mm')}",
                )
            finally:
                bmkg_module.httpx = original_httpx
                bmkg_module.fetch_bmkg_weather = original_fetch_bmkg
                set_cached_weather(ADM4, FAKE_WEATHER)
                bmkg_module._bmkg_failed_at.clear()
                reset_siklus_node_a()

        section("Riwayat saat berubah")
        set_cached_weather(ADM4, FAKE_WEATHER)
        reset_siklus_node_a()
        node_d = f"node-{suffix}-riwayat"

        def post_d(m: float):
            return client.post(
                f"/api/nodes/{node_d}/readings",
                json={**kering_payload(), "soil_moisture": m, "farm_id": farm_id},
                headers=auth,
            )

        respons_d = [
            post_d(70.0),
            post_d(70.0),
            client.post(
                f"/api/nodes/{node_a}/readings", json=kering_payload(), headers=auth
            ),
            post_d(70.0),
            post_d(85.0),
            post_d(85.0),
            post_d(70.0),
        ]
        assert all(r.status_code == 201 for r in respons_d), [r.status_code for r in respons_d]
        with database.get_connection() as connection:
            tipe_d = [
                row["decision_type"]
                for row in connection.execute(
                    """
                    SELECT decision_type FROM decision_logs
                    WHERE node_id = ?
                    ORDER BY created_at ASC, id ASC
                    """,
                    (node_d,),
                ).fetchall()
            ]
            jumlah_readings_d = connection.execute(
                "SELECT COUNT(*) AS n FROM readings WHERE node_id = ?", (node_d,)
            ).fetchone()["n"]
        report.check(
            "riwayat saat berubah: decision_type hanya ditulis kalau berbeda dari sebelumnya",
            tipe_d == ["standby", "closed", "standby"],
            f"decision_type node_d {tipe_d}",
        )
        report.check(
            "riwayat saat berubah: bacaan sensor tetap tersimpan tiap reading",
            jumlah_readings_d == 6,
            f"jumlah readings node_d {jumlah_readings_d}",
        )
        logs_d = [
            item["decision_type"]
            for item in client.get("/api/logs", headers=auth).json()["items"]
            if item["node_id"] == node_d
        ]
        report.check(
            "riwayat saat berubah: GET /api/logs cocok dengan decision_logs node_d",
            logs_d == ["standby", "closed", "standby"],
            f"decision_type GET /api/logs untuk node_d {logs_d}",
        )
        reset_siklus_node_a()

        section("Filter riwayat")
        resp_farm2 = client.post(
            "/api/farms",
            json={
                "name": "Kebun Filter",
                "crop_type": "Padi",
                "bmkg_adm4_code": ADM4,
                "latitude": -7.79,
                "longitude": 110.31,
                "gateway_device_id": f"GW-LOGS-{suffix}",
            },
            headers=auth,
        )
        assert resp_farm2.status_code == 201, resp_farm2.text
        farm2 = resp_farm2.json()["farm"]["id"]
        try:
            node_f = f"node-{suffix}-kebun2"
            resp_read_f = client.post(
                f"/api/nodes/{node_f}/readings",
                json={**kering_payload(), "soil_moisture": 70.0, "farm_id": farm2},
                headers=auth,
            )
            assert resp_read_f.status_code == 201, resp_read_f.text

            baris_g = [
                "2026-01-10 16:59:59",
                "2026-01-10 17:00:00",
                "2026-01-11 16:59:59",
                "2026-01-11 17:00:00",
            ]
            with database.get_connection() as connection:
                connection.execute("DELETE FROM decision_logs WHERE node_id = ?", (node_f,))
                for created_at in baris_g:
                    connection.execute(
                        """
                        INSERT INTO decision_logs
                            (node_id, soil_moisture, weather, decision, decision_type, valve_state, reason, created_at)
                        VALUES (?, ?, '', 'Standby', 'standby', 'closed', 'uji', ?)
                        """,
                        (node_f, 60.0, created_at),
                    )

            r_g1a = client.get("/api/logs", params={"limit": 1000}, headers=auth)
            r_g1b = client.get("/api/logs", params={"limit": 1001}, headers=auth)
            report.check(
                "G1 batas limit: 1000 diterima, 1001 ditolak",
                r_g1a.status_code == 200 and r_g1b.status_code == 422,
                f"status {r_g1a.status_code}, {r_g1b.status_code}",
            )

            items_main = (
                client.get("/api/logs", params={"farm_id": farm_id, "limit": 1000}, headers=auth)
                .json()
                .get("items", [])
            )
            items_farm2 = (
                client.get("/api/logs", params={"farm_id": farm2, "limit": 1000}, headers=auth)
                .json()
                .get("items", [])
            )
            report.check(
                "G2 farm_id menyaring log per kebun",
                len(items_main) > 0
                and all(item["node_id"] != node_f for item in items_main)
                and len(items_farm2) > 0
                and all(item["node_id"] == node_f for item in items_farm2),
                f"main={len(items_main)}, farm2={len(items_farm2)}",
            )

            r_g3 = client.get("/api/logs", params={"farm_id": "farm-tidak-ada"}, headers=auth)
            report.check(
                "G3 farm_id yang tidak ada -> 404",
                r_g3.status_code == 404,
                f"status {r_g3.status_code}",
            )

            expect_g4 = ["2026-01-11 16:59:59", "2026-01-10 17:00:00"]

            r_g4 = client.get(
                "/api/logs",
                params={
                    "farm_id": farm2,
                    "start": "2026-01-11T00:00:00+07:00",
                    "end": "2026-01-11T23:59:59.999+07:00",
                    "limit": 1000,
                },
                headers=auth,
            )
            items_g4 = (
                [i["created_at"] for i in r_g4.json().get("items", [])]
                if r_g4.status_code == 200
                else []
            )
            report.check(
                "G4 filter tanggal zona WIB: batas inklusif tepat",
                r_g4.status_code == 200 and items_g4 == expect_g4,
                f"status {r_g4.status_code}, items {items_g4}",
            )

            r_g4b = client.get(
                "/api/logs",
                params={
                    "farm_id": farm2,
                    "start": "2026-01-10T17:00:00.000Z",
                    "end": "2026-01-11T16:59:59.999Z",
                    "limit": 1000,
                },
                headers=auth,
            )
            items_g4b = (
                [i["created_at"] for i in r_g4b.json().get("items", [])]
                if r_g4b.status_code == 200
                else []
            )
            report.check(
                "G4b format web (Z) hasil sama persis dengan G4",
                r_g4b.status_code == 200 and items_g4b == expect_g4,
                f"status {r_g4b.status_code}, items {items_g4b}",
            )

            r_g5 = client.get(
                "/api/logs",
                params={
                    "farm_id": farm2,
                    "start": "2026-01-10T17:00:00",
                    "end": "2026-01-11T16:59:59",
                    "limit": 1000,
                },
                headers=auth,
            )
            items_g5 = (
                [i["created_at"] for i in r_g5.json().get("items", [])]
                if r_g5.status_code == 200
                else []
            )
            report.check(
                "G5 waktu tanpa zona dianggap UTC: hasil sama persis dengan G4",
                r_g5.status_code == 200 and items_g5 == expect_g4,
                f"status {r_g5.status_code}, items {items_g5}",
            )

            r_g6 = client.get("/api/logs", headers=auth)
            items_g6 = r_g6.json().get("items", []) if r_g6.status_code == 200 else []
            report.check(
                "G6 tanpa parameter apa pun: 200 dan maksimal 20 item",
                r_g6.status_code == 200 and len(items_g6) <= 20,
                f"status {r_g6.status_code}, jumlah {len(items_g6)}",
            )

            for label, params in (
                ("start tahun 1 zona +05:00", {"start": "0001-01-01T00:00:00+05:00"}),
                ("end tahun 9999 zona -05:00", {"end": "9999-12-31T23:59:59-05:00"}),
            ):
                status = client.get("/api/logs", params=params, headers=auth).status_code
                report.check(f"G7 filter tanggal ekstrem ({label}) ditolak 422", status == 422, f"status {status}")
        finally:
            client.delete(f"/api/farms/{farm2}", headers=auth)

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

        section("Jembatan MQTT")
        set_cached_weather(ADM4, FAKE_WEATHER)

        class KlienMqttPalsu:
            """Pengganti paho: catat publish, tanpa broker."""

            def __init__(self) -> None:
                self.terkirim: list[tuple[str, dict]] = []
                self.qos_terakhir: int | None = None
                self.retain_terakhir: bool | None = None

            def publish(self, topic, body, qos, retain):
                # Isi kosong = penghapusan perintah retain, dicatat sebagai None.
                self.terkirim.append((topic, json.loads(body) if body else None))
                self.qos_terakhir, self.retain_terakhir = qos, retain
                return types.SimpleNamespace(rc=0)

        gw_mqtt = f"SIM-GW-{suffix}"
        node_mqtt = f"SIM-{suffix}-N1"
        topik = f"lorafield/gw/{gw_mqtt}"
        topik_valve = f"{topik}/node/{node_mqtt}/valve/set"
        klien = KlienMqttPalsu()
        mqtt_bridge._client = klien
        mqtt_bridge._last_published.clear()

        def kirim(sub: str, data, retained: bool = False) -> None:
            body = data if isinstance(data, bytes) else json.dumps(data).encode()
            mqtt_bridge.handle_message(f"{topik}/{sub}", body, retained)

        def reading_mqtt(soil: float, valve: str) -> None:
            kirim(
                f"node/{node_mqtt}/reading",
                {"soil_moisture": soil, "soil_temp": 26.0, "air_temp": 30.0,
                 "air_humidity": 70.0, "battery": 90.0, "rssi": -95, "valve": valve},
            )

        def jumlah_reading() -> int:
            with database.get_connection() as connection:
                return connection.execute(
                    "SELECT COUNT(*) FROM readings WHERE node_id = ?", (node_mqtt,)
                ).fetchone()[0]

        def node_db() -> dict:
            with database.get_connection() as connection:
                row = connection.execute("SELECT * FROM nodes WHERE id = ?", (node_mqtt,)).fetchone()
            return dict(row) if row else {}

        reading_mqtt(10.0, "closed")
        report.check("MQTT: gateway belum diklaim, reading diabaikan", jumlah_reading() == 0 and not node_db())

        resp_mqtt = client.post(
            "/api/farms",
            json={"name": "Kebun MQTT", "crop_type": "Padi", "bmkg_adm4_code": ADM4,
                  "latitude": -7.79, "longitude": 110.31, "gateway_device_id": gw_mqtt},
            headers=auth,
        )
        assert resp_mqtt.status_code == 201, resp_mqtt.text
        farm_mqtt = resp_mqtt.json()["farm"]["id"]
        try:
            kirim("nodes", {"nodes": [{"node_id": node_mqtt, "name": "Blok Utara"}]})
            baru = node_db()
            report.check(
                "MQTT nodes: node terdaftar dengan nama, belum online",
                baru.get("name") == "Blok Utara" and baru.get("last_seen_at") is None,
                f"node {baru}",
            )
            ganti = report.expect(
                "PATCH /api/nodes/{id}/name",
                client.patch(f"/api/nodes/{node_mqtt}/name", json={"name": "  Blok Timur  "}, headers=auth),
                200,
                ("node",),
            )
            kirim("nodes", {"nodes": [{"node_id": node_mqtt, "name": "Blok Utara"}]})
            report.check(
                "nama node dari web tidak ditimpa daftar node gateway",
                ganti.get("node", {}).get("name") == "Blok Timur" and node_db().get("name") == "Blok Timur",
                f"respons {ganti.get('node', {}).get('name')!r}, db {node_db().get('name')!r}",
            )

            reading_mqtt(10.0, "closed")
            report.check("MQTT reading tersimpan", jumlah_reading() == 1, f"{jumlah_reading()} reading")
            buka = klien.terkirim[-1] if klien.terkirim else ("", {})
            sisa = buka[1].get("until", 0) - time.time()
            report.check(
                "MQTT: tanah kering, valve/set buka dengan until = pulsa otomatis",
                buka[0] == topik_valve and buka[1].get("state") == "open" and 590 < sisa <= 600,
                f"terkirim {klien.terkirim}",
            )
            jumlah_kirim = len(klien.terkirim)
            reading_mqtt(10.5, "open")
            report.check(
                "MQTT: perintah sama tidak dikirim ulang",
                len(klien.terkirim) == jumlah_kirim,
                f"terkirim {klien.terkirim}",
            )

            kirim(f"node/{node_mqtt}/reading", {"soil_moisture": 150, "soil_temp": 26, "air_temp": 30,
                                                "air_humidity": 70, "valve": "open"})
            kirim(f"node/{node_mqtt}/reading", b"bukan json")
            kirim(f"node/{node_mqtt}/reading", {"soil_moisture": 20, "soil_temp": 26, "air_temp": 30,
                                                "air_humidity": 70})
            report.check("MQTT: reading tidak valid diabaikan", jumlah_reading() == 2, f"{jumlah_reading()} reading")

            def mundurkan_kiriman_terakhir() -> None:
                isi, _ = mqtt_bridge._last_published[node_mqtt]
                mqtt_bridge._last_published[node_mqtt] = (isi, time.monotonic() - 3600)

            jumlah_kirim = len(klien.terkirim)
            reading_mqtt(10.6, "closed")  # alat belum menjalankan perintah buka yang baru dikirim
            report.check(
                "MQTT: posisi valve beda tapi perintah baru dikirim, belum dikirim ulang",
                len(klien.terkirim) == jumlah_kirim,
                f"terkirim {klien.terkirim[jumlah_kirim:]}",
            )
            mundurkan_kiriman_terakhir()
            reading_mqtt(10.7, "closed")
            report.check(
                "MQTT: posisi valve tetap beda setelah jeda, perintah dikirim ulang",
                len(klien.terkirim) == jumlah_kirim + 1
                and klien.terkirim[-1][0] == topik_valve
                and klien.terkirim[-1][1].get("state") == "open",
                f"terkirim {klien.terkirim[jumlah_kirim:]}",
            )
            mundurkan_kiriman_terakhir()
            reading_mqtt(10.8, "open")
            report.check(
                "MQTT: posisi valve sudah sama, tidak dikirim ulang walau lama",
                len(klien.terkirim) == jumlah_kirim + 1,
                f"terkirim {klien.terkirim[jumlah_kirim:]}",
            )

            report.expect(
                "MQTT: ganti ke mode manual",
                client.patch(f"/api/farms/{farm_mqtt}/irrigation-mode", json={"mode": "manual"}, headers=auth),
                200,
            )
            report.check(
                "MQTT: mode manual mengirim valve/set tutup",
                klien.terkirim[-1] == (topik_valve, {"state": "closed"}),
                f"terakhir {klien.terkirim[-1]}",
            )
            report.check("MQTT: perintah tutup belum terkonfirmasi", node_db().get("valve_command_sent_at") is None)
            reading_mqtt(20.0, "closed")
            report.check(
                "MQTT: alat lapor valve tutup, perintah terkonfirmasi",
                node_db().get("valve_command_sent_at") is not None,
            )

            report.expect(
                "MQTT: buka valve manual lewat web",
                client.patch(f"/api/nodes/{node_mqtt}/valve", json={"open": True}, headers=auth),
                200,
            )
            buka_manual = klien.terkirim[-1][1]
            sisa = buka_manual.get("until", 0) - time.time()
            report.check(
                "MQTT: valve/set buka manual dengan until = batas manual",
                buka_manual.get("state") == "open" and 1790 < sisa <= 1800,
                f"terakhir {buka_manual}",
            )
            reading_mqtt(21.0, "closed")
            report.check(
                "MQTT: posisi valve belum sama, perintah belum terkonfirmasi",
                node_db().get("valve_command_sent_at") is None,
            )
            reading_mqtt(22.0, "open")
            report.check(
                "MQTT: posisi valve sama, perintah terkonfirmasi",
                node_db().get("valve_command_sent_at") is not None,
            )
            reading_mqtt(23.0, "closed")  # node sempat mati: valve tertutup padahal perintah masih buka
            report.check(
                "MQTT: alat lapor beda setelah terkonfirmasi, tanda terkirim dihapus",
                node_db().get("valve_command_sent_at") is None,
            )
            reading_mqtt(24.0, "open")

            kirim("status", {"state": "online", "fw": "sim-1"}, retained=True)
            kirim("status", {"state": "online", "fw": "sim-1"})
            kirim("heartbeat", {"uptime_s": 60, "nodes_heard": 1})
            events = [
                item["event"]
                for item in client.get(f"/api/farms/{farm_mqtt}/gateway-logs", headers=auth).json()["items"]
            ]
            # Riwayat masih kosong: status retain pertama tetap dicatat (belum ada laporan koneksi pembanding).
            # Heartbeat hanya kabar, tidak dicatat.
            report.check(
                "MQTT: status (retain pertama dan tanpa retain) tercatat di log gateway, heartbeat tidak",
                sorted(events) == ["connected", "connected"],
                f"events {events}",
            )
            summary_mqtt = client.get(f"/api/farms/{farm_mqtt}/summary", headers=auth).json()
            report.check(
                "MQTT: gateway dan node online di summary",
                summary_mqtt.get("gateway_status") == "online" and summary_mqtt.get("nodes_online") == 1,
                f"gateway {summary_mqtt.get('gateway_status')}, online {summary_mqtt.get('nodes_online')}",
            )

            def gateway_status_mqtt() -> str | None:
                return client.get(f"/api/farms/{farm_mqtt}/summary", headers=auth).json().get("gateway_status")

            def kabar_terakhir_lalu() -> None:
                # Last Will baru dikirim broker setelah keep alive habis, jadi kabar terakhir gateway lebih lama.
                with database.get_connection() as connection:
                    connection.execute(
                        "UPDATE gateways SET last_seen_at = datetime('now', '-2 minutes') WHERE device_id = ?",
                        (gw_mqtt,),
                    )

            kabar_terakhir_lalu()
            kirim("status", {"state": "offline"})
            status_terputus = gateway_status_mqtt()
            report.check(
                "MQTT: gateway dilaporkan terputus -> langsung offline walau node masih dalam batas waktu",
                status_terputus == "offline",
                f"gateway {status_terputus}",
            )
            kirim("status", {"state": "online", "fw": "sim-1"})
            status_kembali = gateway_status_mqtt()
            report.check("MQTT: gateway tersambung lagi -> online", status_kembali == "online", f"gateway {status_kembali}")
            kabar_terakhir_lalu()
            kirim("status", {"state": "offline"})
            kirim("heartbeat", {"uptime_s": 30, "nodes_heard": 0})
            status_heartbeat = gateway_status_mqtt()
            report.check(
                "MQTT: heartbeat setelah terputus -> online walau status tersambung terlewat",
                status_heartbeat == "online",
                f"gateway {status_heartbeat}",
            )
            # Status retain saat server menyambung ulang ke broker: dicatat hanya kalau berbeda dari laporan
            # koneksi terakhir di log, yaitu kejadian yang terlewat selagi server putus dari broker.
            def log_terbaru() -> dict:
                return client.get(f"/api/farms/{farm_mqtt}/gateway-logs?limit=1", headers=auth).json()["items"][0]

            kirim("status", {"state": "online", "fw": "sim-1"})
            sebelum = log_terbaru()
            kirim("status", {"state": "online", "fw": "sim-1"}, retained=True)
            status_retain = gateway_status_mqtt()
            report.check(
                "MQTT: retain online, log terakhir terhubung -> online, tanpa entri log baru",
                status_retain == "online" and log_terbaru()["id"] == sebelum["id"],
                f"gateway {status_retain}, log {sebelum['id']} -> {log_terbaru()['id']}",
            )
            kabar_terakhir_lalu()
            kirim("status", {"state": "offline"})
            kirim("status", {"state": "online", "fw": "sim-1"}, retained=True)
            terlewat = log_terbaru()
            status_terlewat = gateway_status_mqtt()
            report.check(
                "MQTT: retain online, log terakhir terputus -> dicatat terhubung (tersambung selagi server putus)",
                status_terlewat == "online"
                and terlewat["event"] == "connected"
                and terlewat["detail"] == "firmware sim-1",
                f"gateway {status_terlewat}, log {terlewat['event']} {terlewat['detail']!r}",
            )
            kabar_terakhir_lalu()
            sebelum = log_terbaru()
            kirim("status", {"state": "offline"}, retained=True)
            putus = log_terbaru()
            status_putus = gateway_status_mqtt()
            report.check(
                "MQTT: retain offline, log terakhir terhubung -> dicatat terputus dan langsung offline",
                status_putus == "offline" and putus["event"] == "disconnected" and putus["id"] != sebelum["id"],
                f"gateway {status_putus}, log {putus['event']} {putus['detail']!r}",
            )
            kirim("status", {"state": "offline"}, retained=True)
            report.check(
                "MQTT: retain offline, log terakhir terputus -> tanpa entri log baru",
                log_terbaru()["id"] == putus["id"],
                f"log {putus['id']} -> {log_terbaru()['id']}",
            )
            kirim("status", {"state": "online", "fw": "sim-1"})  # bagian berikutnya butuh gateway online

            # Deteksi restart dari uptime heartbeat: jam menyala = waktu terima dikurangi uptime.
            def log_gateway_mqtt() -> list[dict]:
                return client.get(f"/api/farms/{farm_mqtt}/gateway-logs?limit=100", headers=auth).json()["items"]

            def jumlah_restart() -> int:
                return sum(item["event"] == "restarted" for item in log_gateway_mqtt())

            kirim("heartbeat", {"uptime_s": 5000, "nodes_heard": 0})
            awal = jumlah_restart()
            kirim("heartbeat", {"uptime_s": 4950, "nodes_heard": 0})  # jam menyala maju 50 detik: jeda jaringan
            report.check(
                "MQTT: jam menyala bergeser di bawah 1 menit (jeda jaringan) bukan restart",
                jumlah_restart() == awal,
                f"restart {awal} -> {jumlah_restart()}",
            )
            kirim("heartbeat", {"uptime_s": 30, "nodes_heard": 0})  # gateway baru menyala 30 detik lalu
            restart = [item for item in log_gateway_mqtt() if item["event"] == "restarted"]
            umur_restart = (
                (datetime.now(timezone.utc) - datetime.fromisoformat(restart[0]["created_at"]).replace(tzinfo=timezone.utc))
                .total_seconds()
                if restart
                else None
            )
            report.check(
                "MQTT: uptime mengecil -> tercatat menyala ulang pada perkiraan jam menyala",
                len(restart) == awal + 1 and umur_restart is not None and 25 <= umur_restart <= 40,
                f"restart {awal} -> {len(restart)}, umur {umur_restart}",
            )
            kirim("heartbeat", {"uptime_s": 30, "nodes_heard": 0})
            kirim("heartbeat", {"uptime_s": "rusak", "nodes_heard": 0})
            report.check(
                "MQTT: heartbeat berikutnya dan uptime rusak tidak mencatat restart lagi",
                jumlah_restart() == awal + 1,
                f"restart {jumlah_restart()}",
            )
            kirim("heartbeat", {"uptime_s": 200, "nodes_heard": 0})
            kirim("heartbeat", {"uptime_s": 122, "nodes_heard": 0})  # menyala lagi 78 detik setelah menyala sebelumnya
            report.check(
                "MQTT: restart 78 detik setelah menyala sebelumnya tetap tercatat (uji alat 2026-10-02)",
                jumlah_restart() == awal + 2,
                f"restart {awal} -> {jumlah_restart()}",
            )

            # Penyebab menyala dari gateway (boot_reason) ditulis di detail log restarted; kode asing dikosongkan.
            def restart_terbaru() -> dict:
                return max(
                    (item for item in log_gateway_mqtt() if item["event"] == "restarted"), key=lambda item: item["id"]
                )

            kirim("heartbeat", {"uptime_s": 500, "nodes_heard": 0, "boot_reason": "brownout"})
            kirim("heartbeat", {"uptime_s": 20, "nodes_heard": 0, "boot_reason": "brownout"})
            report.check(
                "MQTT: menyala ulang karena listrik turun -> detail brownout",
                restart_terbaru()["detail"] == "brownout",
                f"detail {restart_terbaru()['detail']!r}",
            )
            kirim("heartbeat", {"uptime_s": 500, "nodes_heard": 0})
            kirim("heartbeat", {"uptime_s": 20, "nodes_heard": 0, "boot_reason": "<script>"})
            report.check(
                "MQTT: kode penyebab menyala asing tidak disimpan",
                restart_terbaru()["detail"] == "",
                f"detail {restart_terbaru()['detail']!r}",
            )

            # Nomor nyala (boot_id): restart pasti terdeteksi berapa pun jaraknya, tanpa alarm palsu.
            kirim("heartbeat", {"uptime_s": 900, "nodes_heard": 0, "boot_id": 111})  # nomor pertama: cara jam menyala
            sebelum_nomor = jumlah_restart()
            kirim("heartbeat", {"uptime_s": 600, "nodes_heard": 0, "boot_id": 111})  # tertahan 5 menit, nomor sama
            report.check(
                "MQTT: nomor nyala sama -> bukan restart walau jam menyala bergeser 5 menit",
                jumlah_restart() == sebelum_nomor,
                f"restart {sebelum_nomor} -> {jumlah_restart()}",
            )
            kirim("heartbeat", {"uptime_s": 580, "nodes_heard": 0, "boot_id": 222, "boot_reason": "power_on"})
            report.check(
                "MQTT: nomor nyala baru 20 detik setelah menyala sebelumnya -> tercatat menyala ulang (uji alat RST)",
                jumlah_restart() == sebelum_nomor + 1 and restart_terbaru()["detail"] == "power_on",
                f"restart {sebelum_nomor} -> {jumlah_restart()}, detail {restart_terbaru()['detail']!r}",
            )
            kirim("heartbeat", {"uptime_s": 10, "nodes_heard": 0, "boot_id": True})
            kirim("heartbeat", {"uptime_s": 10, "nodes_heard": 0, "boot_id": 2**32})
            report.check(
                "MQTT: nomor nyala rusak diabaikan, nomor tersimpan tidak berubah",
                client.get(f"/api/farms/{farm_mqtt}/gateway", headers=auth).json()["gateway"].get("boot_id") == 222,
            )
            report.check(
                "MQTT: heartbeat tidak pernah tercatat di log gateway",
                all(item["event"] != "heartbeat" for item in log_gateway_mqtt()),
            )

            # Nama dan sinyal WiFi dari heartbeat, untuk kartu Gateway di web.
            def wifi_gateway_mqtt() -> tuple:
                gateway = client.get(f"/api/farms/{farm_mqtt}/gateway", headers=auth).json()["gateway"]
                return gateway.get("wifi_ssid"), gateway.get("wifi_rssi")

            kirim("heartbeat", {"uptime_s": 40, "nodes_heard": 0, "wifi_ssid": 'Rumah "Pak" Budi', "wifi_rssi": -58})
            wifi_awal = wifi_gateway_mqtt()
            report.check(
                "MQTT: heartbeat menyimpan nama dan sinyal WiFi gateway",
                wifi_awal == ('Rumah "Pak" Budi', -58),
                f"wifi {wifi_awal}",
            )
            for rusak in (
                {"wifi_ssid": "x" * 33, "wifi_rssi": -121},
                {"wifi_ssid": "Rumah\nBaru", "wifi_rssi": True},
                {"wifi_ssid": "", "wifi_rssi": 5},
                {"wifi_ssid": 123, "wifi_rssi": "-50"},
            ):
                kirim("heartbeat", {"uptime_s": 41, "nodes_heard": 0, **rusak})
            kirim("heartbeat", {"uptime_s": 42, "nodes_heard": 0})  # firmware lama: tanpa field WiFi
            wifi_tetap = wifi_gateway_mqtt()
            report.check(
                "MQTT: nama atau sinyal WiFi tidak sah dan heartbeat tanpa WiFi tidak mengubah data lama",
                wifi_tetap == wifi_awal,
                f"wifi {wifi_tetap}",
            )
            kirim("heartbeat", {"uptime_s": 43, "nodes_heard": 0, "wifi_ssid": "Kantor", "wifi_rssi": -71})
            report.check(
                "MQTT: ganti WiFi -> nama dan sinyal baru tersimpan",
                wifi_gateway_mqtt() == ("Kantor", -71),
                f"wifi {wifi_gateway_mqtt()}",
            )

            # Tombol "Ganti WiFi" di web: perintah cmd ke gateway.
            url_ganti_wifi = f"/api/farms/{farm_mqtt}/gateway/wifi-portal"
            jumlah_kirim = len(klien.terkirim)
            resp_wifi = client.post(url_ganti_wifi, headers=auth)
            events_wifi = [
                item["event"]
                for item in client.get(f"/api/farms/{farm_mqtt}/gateway-logs", headers=auth).json()["items"]
            ]
            report.check(
                "Ganti WiFi: gateway online -> perintah wifi_portal terkirim QoS 1 tanpa retain dan tercatat",
                resp_wifi.status_code == 200
                and klien.terkirim[jumlah_kirim:] == [(f"{topik}/cmd", {"action": "wifi_portal"})]
                and klien.qos_terakhir == 1
                and klien.retain_terakhir is False
                and events_wifi[:1] == ["wifi_portal"],
                f"status {resp_wifi.status_code}, kirim {klien.terkirim[jumlah_kirim:]}, "
                f"qos {klien.qos_terakhir}, retain {klien.retain_terakhir}, log {events_wifi[:1]}",
            )
            mqtt_bridge._client = None
            resp_nonaktif = client.post(url_ganti_wifi, headers=auth)
            mqtt_bridge._client = klien
            report.check(
                "Ganti WiFi: jembatan MQTT nonaktif -> 503",
                resp_nonaktif.status_code == 503,
                f"status {resp_nonaktif.status_code}",
            )
            kabar_terakhir_lalu()
            kirim("status", {"state": "offline"})
            jumlah_kirim = len(klien.terkirim)
            resp_offline = client.post(url_ganti_wifi, headers=auth)
            report.check(
                "Ganti WiFi: gateway offline -> 409, perintah tidak dikirim",
                resp_offline.status_code == 409 and len(klien.terkirim) == jumlah_kirim,
                f"status {resp_offline.status_code}, kirim {klien.terkirim[jumlah_kirim:]}",
            )
            kirim("status", {"state": "online", "fw": "sim-1"})

            # MAC ESP32 satu pabrikan: awalan ID sama, nama bawaan tetap harus beda.
            node_kembar = ["ND-246F28A1B2C3", "ND-246F28D4E5F6"]
            data_valid = {"soil_moisture": 70, "soil_temp": 26, "air_temp": 30, "air_humidity": 70, "valve": "closed"}
            for node_id in node_kembar:
                kirim(f"node/{node_id}/reading", data_valid)
            kirim("node/ND-X1\n/reading", data_valid)
            with database.get_connection() as connection:
                nama = {
                    row["id"]: row["name"]
                    for row in connection.execute("SELECT id, name FROM nodes WHERE farm_id = ?", (farm_mqtt,))
                }
            report.check(
                "MQTT: nama bawaan node beda walau awalan ID sama",
                nama.get(node_kembar[0]) is not None and nama.get(node_kembar[0]) != nama.get(node_kembar[1]),
                f"nama {nama}",
            )
            report.check("MQTT: ID node berakhiran baris baru ditolak", not any("\n" in n for n in nama), f"node {list(nama)}")

            report.expect(
                "MQTT: kembali ke mode otomatis",
                client.patch(f"/api/farms/{farm_mqtt}/irrigation-mode", json={"mode": "auto"}, headers=auth),
                200,
            )
            with database.get_connection() as connection:
                connection.execute(
                    """
                    UPDATE nodes
                    SET auto_pulse_count = ?, auto_pulse_started_at = ?,
                        auto_cycle_baseline = ?, auto_confirmed_pulse_count = ?
                    WHERE id = ?
                    """,
                    (
                        settings.auto_no_rise_pulses,
                        ago(settings.auto_pulse_minutes + settings.auto_soak_minutes + 5),
                        10.0,
                        settings.auto_no_rise_pulses,
                        node_mqtt,
                    ),
                )
            reading_mqtt(10.0, "closed")
            report.check(
                "MQTT: dua pulsa tanpa kenaikan mengirim perintah tutup",
                node_db().get("auto_paused_at") is not None
                and klien.terkirim[-1] == (topik_valve, {"state": "closed"}),
                f"node {node_db()}, terakhir {klien.terkirim[-1]}",
            )
            client.post(f"/api/nodes/{node_mqtt}/irrigation/resume", headers=auth)
            cuaca_asli = mqtt_bridge.get_weather_for_decision

            def cuaca_lalu_ganti_mode(kode):
                # Pengguna mengganti mode tepat saat server menunggu BMKG.
                client.patch(f"/api/farms/{farm_mqtt}/irrigation-mode", json={"mode": "manual"}, headers=auth)
                return cuaca_asli(kode)

            mqtt_bridge.get_weather_for_decision = cuaca_lalu_ganti_mode
            try:
                reading_mqtt(10.0, "closed")  # tanah kering: dengan mode lama (otomatis) valve akan dibuka
            finally:
                mqtt_bridge.get_weather_for_decision = cuaca_asli
            perintah_node = [isi for topik, isi in klien.terkirim if topik == topik_valve]
            with database.get_connection() as connection:
                riwayat = connection.execute(
                    "SELECT decision_type FROM decision_logs WHERE node_id = ? ORDER BY id DESC LIMIT 1", (node_mqtt,)
                ).fetchone()[0]
            report.check(
                "MQTT: mode diganti saat menunggu BMKG, reading memakai mode baru",
                riwayat == "manual_closed" and perintah_node[-1] == {"state": "closed"},
                f"riwayat {riwayat}, perintah terakhir {perintah_node[-1]}",
            )

            with database.get_connection() as connection:
                topik_node = {
                    f"{topik}/node/{row['id']}/valve/set"
                    for row in connection.execute("SELECT id FROM nodes WHERE farm_id = ?", (farm_mqtt,))
                }

            def dihapus_sejak(awal: int) -> set:
                return {t for t, isi in klien.terkirim[awal:] if isi is None}

            awal = len(klien.terkirim)
            report.expect(
                "MQTT: lepas gateway dari kebun",
                client.post(f"/api/farms/{farm_mqtt}/gateway/unclaim", headers=auth),
                200,
            )
            report.check(
                "MQTT: lepas gateway menghapus perintah valve retain semua node kebun",
                dihapus_sejak(awal) == topik_node and node_mqtt not in mqtt_bridge._last_published,
                f"dihapus {dihapus_sejak(awal)}, harusnya {topik_node}",
            )
            client.post(
                f"/api/farms/{farm_mqtt}/gateway/claim",
                json={"device_id": gw_mqtt, "display_name": ""},
                headers=auth,
            )
            reading_mqtt(30.0, "closed")
            report.check(
                "MQTT: setelah gateway diklaim ulang, perintah valve dikirim lagi",
                klien.terkirim[-1] == (topik_valve, {"state": "closed"}),
                f"terakhir {klien.terkirim[-1]}",
            )
            awal = len(klien.terkirim)
            report.expect("MQTT: hapus kebun", client.delete(f"/api/farms/{farm_mqtt}", headers=auth), 200)
            report.check(
                "MQTT: hapus kebun menghapus perintah valve retain semua node kebun",
                dihapus_sejak(awal) == topik_node and node_mqtt not in mqtt_bridge._last_published,
                f"dihapus {dihapus_sejak(awal)}, harusnya {topik_node}",
            )
        finally:
            mqtt_bridge._client = None
            mqtt_bridge._last_published.clear()
            client.delete(f"/api/farms/{farm_mqtt}", headers=auth)

        section("Nama node")
        contoh = {"ND-A1B2C3D4E5F6": "Node E5F6", "SIM-abc123-N1": "Node N1", "GW0011": "Node 0011"}
        hasil = {node_id: default_node_name(node_id) for node_id in contoh}
        report.check("nama bawaan node = 4 karakter terakhir ID (sesuai stiker)", hasil == contoh, f"dapat {hasil}")
        for isi, label in (("", "kosong"), ("   ", "hanya spasi"), ("x" * 41, "lebih dari 40 karakter")):
            status = client.patch(f"/api/nodes/{node_a}/name", json={"name": isi}, headers=auth).status_code
            report.check(f"nama node {label} ditolak (422)", status == 422, f"status {status}")
        with database.get_connection() as connection:
            connection.execute("UPDATE nodes SET name = 'Node ' || id WHERE id = ?", (node_a,))
            connection.execute("UPDATE nodes SET name = 'Blok Kustom' WHERE id = ?", (node_b,))
        database.init_db()
        with database.get_connection() as connection:
            nama_node = dict(connection.execute("SELECT id, name FROM nodes WHERE id IN (?, ?)", (node_a, node_b)).fetchall())
        report.check(
            "startup mengganti nama bawaan lama jadi nama pendek, nama buatan user tetap",
            nama_node == {node_a: default_node_name(node_a), node_b: "Blok Kustom"},
            f"nama {nama_node}",
        )

        section("Tanah jenuh")
        resp_jenuh = client.post(
            "/api/farms",
            json={"name": "Kebun Jenuh", "crop_type": "Padi", "bmkg_adm4_code": ADM4,
                  "latitude": -7.79, "longitude": 110.31, "gateway_device_id": f"GW-JENUH-{suffix}"},
            headers=auth,
        )
        assert resp_jenuh.status_code == 201, resp_jenuh.text
        farm_jenuh = resp_jenuh.json()["farm"]["id"]
        node_jenuh = f"node-{suffix}-jenuh"

        def kirim_tanah(persen: float) -> dict:
            resp = client.post(
                f"/api/nodes/{node_jenuh}/readings",
                json={"soil_moisture": persen, "soil_temp": 26.0, "air_temp": 30.0, "air_humidity": 70.0,
                      "farm_id": farm_jenuh},
                headers=auth,
            )
            assert resp.status_code == 201, resp.text
            return resp.json()["decision"]

        def perintah_jenuh():
            with database.get_connection() as connection:
                return connection.execute(
                    "SELECT valve_command FROM nodes WHERE id = ?", (node_jenuh,)
                ).fetchone()[0]

        try:
            kirim_tanah(90.0)
            client.patch(f"/api/farms/{farm_jenuh}/irrigation-mode", json={"mode": "manual"}, headers=auth)
            report.expect(
                "tanah 90%: valve manual masih bisa dibuka",
                client.patch(f"/api/nodes/{node_jenuh}/valve", json={"open": True}, headers=auth),
                200,
            )
            keputusan = kirim_tanah(98.5)
            report.check(
                "tanah 98,5% saat valve manual terbuka: valve ditutup otomatis (manual_saturated)",
                keputusan["type"] == "manual_saturated" and keputusan["valve_state"] == "closed"
                and perintah_jenuh() == "closed",
                f"keputusan {keputusan}, perintah {perintah_jenuh()}",
            )
            buka = client.patch(f"/api/nodes/{node_jenuh}/valve", json={"open": True}, headers=auth)
            report.check(
                "tanah jenuh: perintah buka valve ditolak 409",
                buka.status_code == 409 and "jenuh" in buka.json().get("detail", ""),
                f"status {buka.status_code}, {buka.text[:120]}",
            )
            mulai = client.post(f"/api/farms/{farm_jenuh}/irrigation/start", headers=auth)
            report.check(
                "tanah semua node jenuh: Jalankan Pengairan ditolak 409",
                mulai.status_code == 409 and "jenuh" in mulai.json().get("detail", ""),
                f"status {mulai.status_code}, {mulai.text[:120]}",
            )
            kirim_tanah(85.0)
            report.expect(
                "tanah turun ke 85%: Jalankan Pengairan bisa lagi",
                client.post(f"/api/farms/{farm_jenuh}/irrigation/start", headers=auth),
                200,
            )
        finally:
            client.delete(f"/api/farms/{farm_jenuh}", headers=auth)

        section("Irigasi Terbatas")
        sekarang = datetime.now(timezone.utc)

        def buat_kebun(nama: str, tanaman: str) -> str:
            resp = client.post(
                "/api/farms",
                json={"name": nama, "crop_type": tanaman, "bmkg_adm4_code": ADM4, "latitude": -7.79,
                      "longitude": 110.31, "gateway_device_id": f"GW-{tanaman.upper()}-{suffix}"},
                headers=auth,
            )
            assert resp.status_code == 201, resp.text
            return resp.json()["farm"]["id"]

        def batas(hari: float) -> str:
            return (sekarang + timedelta(days=hari)).isoformat()

        farm_padi = buat_kebun("Kebun Padi Terbatas", "Padi")
        farm_mangga = buat_kebun("Kebun Mangga Terbatas", "Mangga")
        node_mangga = f"node-{suffix}-mangga"

        def kirim_mangga(persen: float) -> dict:
            resp = client.post(
                f"/api/nodes/{node_mangga}/readings",
                json={"soil_moisture": persen, "soil_temp": 26.0, "air_temp": 30.0, "air_humidity": 70.0,
                      "farm_id": farm_mangga},
                headers=auth,
            )
            assert resp.status_code == 201, resp.text
            return resp.json()["decision"]

        def log_terbatas() -> list[dict]:
            items = client.get(f"/api/logs?farm_id={farm_mangga}&limit=100", headers=auth).json()["items"]
            return [log for log in items if (log.get("decision_type") or "").startswith("limited_")]

        url_mangga = f"/api/farms/{farm_mangga}/limited-irrigation"
        try:
            mulai_padi = client.post(
                f"/api/farms/{farm_padi}/limited-irrigation", json={"reason": "flowering", "until": batas(7)},
                headers=auth,
            )
            report.check(
                "Irigasi Terbatas ditolak untuk padi (409)",
                mulai_padi.status_code == 409 and "padi" in mulai_padi.json().get("detail", ""),
                f"status {mulai_padi.status_code}, {mulai_padi.text[:120]}",
            )
            kirim_mangga(55.0)
            for hari, label in ((-0.5, "sudah lewat"), (40, "lebih dari 28 hari")):
                status = client.post(url_mangga, json={"reason": "other", "until": batas(hari)}, headers=auth).status_code
                report.check(f"tanggal selesai {label} ditolak (422)", status == 422, f"status {status}")
            status = client.post(url_mangga, json={"reason": "entah", "until": batas(7)}, headers=auth).status_code
            report.check("alasan di luar daftar ditolak (422)", status == 422, f"status {status}")
            mulai = report.expect(
                "POST limited-irrigation memulai Irigasi Terbatas",
                client.post(url_mangga, json={"reason": "flowering", "until": batas(21)}, headers=auth),
                200,
                ("farm",),
            )
            report.check(
                "farm menyimpan tanggal selesai dan alasan",
                bool(mulai.get("farm", {}).get("limited_until"))
                and mulai.get("farm", {}).get("limited_reason") == "flowering",
                f"farm {mulai.get('farm')}",
            )
            status = client.post(url_mangga, json={"reason": "harvest", "until": batas(7)}, headers=auth).status_code
            report.check("memulai lagi saat masih aktif ditolak (409)", status == 409, f"status {status}")
            keputusan = kirim_mangga(45.0)
            report.check(
                "Irigasi Terbatas: tanah 45% (batas mangga 50%) belum disiram",
                keputusan["type"] == "standby",
                f"keputusan {keputusan['type']}",
            )
            keputusan = kirim_mangga(38.0)
            report.check(
                "Irigasi Terbatas: tanah 38% (di bawah 50 - 10) tetap disiram",
                keputusan["type"] == "open",
                f"keputusan {keputusan['type']}",
            )
            summary = client.get(f"/api/farms/{farm_mangga}/summary", headers=auth).json()
            report.check(
                "summary.thresholds tetap batas tanaman, farm membawa limited_until",
                summary["thresholds"] == {"lower": 50.0, "upper": 70.0} and summary["farm"]["limited_until"],
                f"thresholds {summary['thresholds']}, limited_until {summary['farm'].get('limited_until')}",
            )
            dimulai = log_terbatas()
            report.check(
                "Riwayat mencatat Irigasi Terbatas dimulai beserta alasan dan tanggal selesai",
                len(dimulai) == 1 and dimulai[0]["decision_type"] == "limited_started"
                and dimulai[0]["limited_reason"] == "flowering"
                and dimulai[0]["limited_until"] == mulai["farm"]["limited_until"],
                f"log {dimulai}",
            )
            ubah = report.expect(
                "PATCH limited-irrigation mengubah tanggal selesai",
                client.patch(url_mangga, json={"until": batas(25)}, headers=auth),
                200,
                ("farm",),
            )
            report.check(
                "Riwayat mencatat Irigasi Terbatas diubah dengan tanggal baru",
                log_terbatas()[0]["decision_type"] == "limited_changed"
                and log_terbatas()[0]["limited_until"] == ubah.get("farm", {}).get("limited_until"),
                f"log {log_terbatas()[:1]}",
            )
            status = client.patch(url_mangga, json={"until": batas(40)}, headers=auth).status_code
            report.check("ubah tanggal lebih dari 28 hari ditolak (422)", status == 422, f"status {status}")
            client.patch(f"/api/farms/{farm_mangga}/irrigation-mode", json={"mode": "manual"}, headers=auth)
            farm_manual = client.get(f"/api/farms/{farm_mangga}", headers=auth).json()["farm"]
            report.check(
                "pindah ke mode manual tidak membatalkan Irigasi Terbatas",
                farm_manual["limited_until"] == ubah.get("farm", {}).get("limited_until"),
                f"limited_until {farm_manual.get('limited_until')}",
            )
            report.expect(
                "tanggal selesai tetap bisa diubah di mode manual",
                client.patch(url_mangga, json={"until": batas(20)}, headers=auth),
                200,
            )
            client.patch(f"/api/farms/{farm_mangga}/irrigation-mode", json={"mode": "auto"}, headers=auth)
            lewat = (sekarang - timedelta(hours=1)).strftime("%Y-%m-%d %H:%M:%S")
            with database.get_connection() as connection:
                # Node sudah melapor sebelum tanggal selesai; catatan selesai hanya memakai data sampai saat itu.
                connection.execute(
                    "UPDATE readings SET created_at = ? WHERE node_id = ?",
                    ((sekarang - timedelta(hours=2)).strftime("%Y-%m-%d %H:%M:%S"), node_mangga),
                )
                connection.execute("UPDATE farms SET limited_until = ? WHERE id = ?", (lewat, farm_mangga))
            summary = client.get(f"/api/farms/{farm_mangga}/summary", headers=auth).json()
            client.get(f"/api/farms/{farm_mangga}/summary", headers=auth)
            selesai = [log for log in log_terbatas() if log["decision_type"] == "limited_ended"]
            report.check(
                "tanggal lewat: Irigasi Terbatas selesai sendiri, tercatat sekali di waktu selesainya",
                summary["farm"]["limited_until"] is None and len(selesai) == 1
                and selesai[0]["created_at"] == lewat,
                f"limited_until {summary['farm'].get('limited_until')}, log selesai {selesai}",
            )
            keputusan = kirim_mangga(45.0)
            report.check(
                "setelah selesai, tanah 45% kembali disiram (batas normal)",
                keputusan["type"] == "open",
                f"keputusan {keputusan['type']}",
            )
            status = client.delete(url_mangga, headers=auth).status_code
            report.check("menghentikan saat tidak aktif ditolak (409)", status == 409, f"status {status}")
            client.post(url_mangga, json={"reason": "harvest", "until": batas(14)}, headers=auth)
            berhenti = report.expect("DELETE limited-irrigation menghentikan", client.delete(url_mangga, headers=auth), 200)
            report.check(
                "dihentikan: farm kosong lagi dan Riwayat mencatat dihentikan",
                berhenti.get("farm", {}).get("limited_until") is None
                and log_terbatas()[0]["decision_type"] == "limited_stopped",
                f"farm {berhenti.get('farm')}, log {log_terbatas()[:1]}",
            )
            client.patch(f"/api/farms/{farm_mangga}/irrigation-mode", json={"mode": "manual"}, headers=auth)
            status = client.post(url_mangga, json={"reason": "other", "until": batas(7)}, headers=auth).status_code
            report.check("memulai di mode manual ditolak (409)", status == 409, f"status {status}")
        finally:
            client.delete(f"/api/farms/{farm_padi}", headers=auth)
            client.delete(f"/api/farms/{farm_mangga}", headers=auth)

        section("Irigasi Terbatas: balapan dan tepi")
        kebun_uji: list[str] = []

        def kebun_baru(tanaman: str) -> str:
            kebun_uji.append(buat_kebun(f"Kebun Uji {tanaman}", tanaman))
            return kebun_uji[-1]

        def kirim_ke(kebun: str, node: str, persen: float) -> dict:
            resp = client.post(
                f"/api/nodes/{node}/readings",
                json={"soil_moisture": persen, "soil_temp": 26.0, "air_temp": 30.0, "air_humidity": 70.0,
                      "farm_id": kebun},
                headers=auth,
            )
            assert resp.status_code == 201, resp.text
            return resp.json()["decision"]

        def sql(query: str, params: tuple = ()) -> list[dict]:
            with database.get_connection() as connection:
                return [dict(row) for row in connection.execute(query, params).fetchall()]

        def jam_lalu(jam: float) -> str:
            return (sekarang - timedelta(hours=jam)).strftime("%Y-%m-%d %H:%M:%S")

        def mundurkan(node: str, jam: float) -> None:
            sql("UPDATE readings SET created_at = ? WHERE node_id = ?", (jam_lalu(jam), node))
            sql("UPDATE decision_logs SET created_at = ? WHERE node_id = ?", (jam_lalu(jam), node))

        def catatan(node: str, tipe: str) -> list[dict]:
            return sql(
                "SELECT * FROM decision_logs WHERE node_id = ? AND decision_type = ? ORDER BY id", (node, tipe)
            )

        def url_terbatas(kebun: str) -> str:
            return f"/api/farms/{kebun}/limited-irrigation"

        try:
            # Dua Mulai bersamaan: cek status dan ubahnya harus satu operasi.
            kebun = kebun_baru("Mangga")
            node = f"node-{suffix}-balap"
            kirim_ke(kebun, node, 55.0)
            status_mulai: list[int] = []
            asli_tersedia = valves.require_limited_available

            def tersedia_lambat(farm: dict) -> None:
                asli_tersedia(farm)
                time.sleep(0.4)

            def mulai_dengan(alasan: str) -> None:
                resp = client.post(
                    url_terbatas(kebun), json={"reason": alasan, "until": batas(7)}, headers=auth
                )
                status_mulai.append(resp.status_code)

            valves.require_limited_available = tersedia_lambat
            try:
                threads = [threading.Thread(target=mulai_dengan, args=(a,)) for a in ("flowering", "harvest")]
                for thread in threads:
                    thread.start()
                for thread in threads:
                    thread.join()
            finally:
                valves.require_limited_available = asli_tersedia
            report.check(
                "dua Mulai bersamaan: satu berhasil, satu 409, satu catatan dimulai",
                sorted(status_mulai) == [200, 409] and len(catatan(node, "limited_started")) == 1,
                f"status {status_mulai}, catatan {len(catatan(node, 'limited_started'))}",
            )

            # PATCH tanggal bersamaan dengan DELETE: tidak boleh aktif lagi setelah dihentikan.
            kebun = kebun_baru("Jagung")
            kirim_ke(kebun, f"node-{suffix}-ubah", 60.0)
            client.post(url_terbatas(kebun), json={"reason": "harvest", "until": batas(14)}, headers=auth)
            asli_aktif = valves.require_limited_active
            sudah_tidur: list[int] = []

            def aktif_lambat(farm: dict) -> None:
                asli_aktif(farm)
                if not sudah_tidur:
                    sudah_tidur.append(1)
                    time.sleep(0.4)

            def ubah_tanggal() -> None:
                client.patch(url_terbatas(kebun), json={"until": batas(20)}, headers=auth)

            def hentikan() -> None:
                client.delete(url_terbatas(kebun), headers=auth)

            valves.require_limited_active = aktif_lambat
            try:
                thread_ubah = threading.Thread(target=ubah_tanggal)
                thread_ubah.start()
                time.sleep(0.15)
                thread_hentikan = threading.Thread(target=hentikan)
                thread_hentikan.start()
                thread_ubah.join()
                thread_hentikan.join()
            finally:
                valves.require_limited_active = asli_aktif
            akhir = client.get(f"/api/farms/{kebun}", headers=auth).json()["farm"]
            report.check(
                "PATCH dan DELETE bersamaan: kebun akhirnya tidak aktif, bukan aktif tanpa alasan",
                akhir["limited_until"] is None and akhir["limited_reason"] is None,
                f"limited_until {akhir['limited_until']}, limited_reason {akhir['limited_reason']}",
            )

            # Snapshot kebun yang basi: periode lama selesai lalu periode baru dimulai proses lain.
            kebun = kebun_baru("Kopi")
            node = f"node-{suffix}-basi"
            kirim_ke(kebun, node, 50.0)
            sql(
                "UPDATE farms SET limited_until = ?, limited_reason = 'flowering' WHERE id = ?",
                (jam_lalu(1), kebun),
            )
            asli_expire = reading_service.expire_limited_irrigation

            def expire_setelah_periode_baru(connection, farm: dict, waktu: datetime) -> dict:
                sql(
                    "UPDATE farms SET limited_until = ?, limited_reason = 'other' WHERE id = ?",
                    (jam_lalu(-168), kebun),
                )
                return asli_expire(connection, farm, waktu)

            reading_service.expire_limited_irrigation = expire_setelah_periode_baru
            try:
                keputusan = kirim_ke(kebun, node, 40.0)
            finally:
                reading_service.expire_limited_irrigation = asli_expire
            report.check(
                "periode baru tidak diabaikan saat data kebun basi: tanah 40% (batas kopi 45%) standby",
                keputusan["type"] == "standby",
                f"keputusan {keputusan['type']}",
            )

            # Satu kebun satu tanaman: tanaman tidak bisa diganti, nilai yang sama tetap diterima.
            kebun = kebun_baru("Pisang")
            node = f"node-{suffix}-padi"
            kirim_ke(kebun, node, 70.0)
            client.post(url_terbatas(kebun), json={"reason": "other", "until": batas(7)}, headers=auth)
            ganti = client.patch(f"/api/farms/{kebun}", json={"crop_type": "Padi"}, headers=auth)
            sama = client.patch(f"/api/farms/{kebun}", json={"crop_type": "pisang"}, headers=auth)
            report.check(
                "tanaman kebun tidak bisa diganti (422), nilai yang sama diterima tanpa perubahan",
                ganti.status_code == 422 and sama.status_code == 200
                and sama.json()["farm"]["crop_type"] == "Pisang",
                f"ganti {ganti.status_code}, sama {sama.status_code}",
            )
            # Data lama yang terlanjur padi saat periode Terbatas masih tersimpan tetap memakai batas normal.
            sql("UPDATE farms SET crop_type = 'Padi' WHERE id = ?", (kebun,))
            keputusan = kirim_ke(kebun, node, 55.0)
            report.check(
                "padi dengan periode Terbatas tersimpan: batas normal, tanah 55% (batas 60%) disiram",
                keputusan["type"] == "open",
                f"keputusan {keputusan['type']}",
            )

            # Riwayat menyimpan tanggal dan alasan saat selesai otomatis maupun dihentikan.
            kebun = kebun_baru("Teh")
            node = f"node-{suffix}-meta"
            kirim_ke(kebun, node, 65.0)
            mundurkan(node, 3)
            lewat = jam_lalu(1)
            sql("UPDATE farms SET limited_until = ?, limited_reason = 'flowering' WHERE id = ?", (lewat, kebun))
            client.get(f"/api/farms/{kebun}/summary", headers=auth)
            selesai = catatan(node, "limited_ended")
            report.check(
                "selesai otomatis menyimpan tanggal selesai dan alasan",
                len(selesai) == 1 and selesai[0]["limited_until"] == lewat
                and selesai[0]["limited_reason"] == "flowering",
                f"catatan {[(r['limited_until'], r['limited_reason']) for r in selesai]}",
            )
            aktif = client.post(
                url_terbatas(kebun), json={"reason": "harvest", "until": batas(14)}, headers=auth
            ).json()["farm"]["limited_until"]
            client.delete(url_terbatas(kebun), headers=auth)
            berhenti = catatan(node, "limited_stopped")
            report.check(
                "dihentikan menyimpan tanggal selesai dan alasan",
                len(berhenti) == 1 and berhenti[0]["limited_until"] == aktif
                and berhenti[0]["limited_reason"] == "harvest",
                f"catatan {[(r['limited_until'], r['limited_reason']) for r in berhenti]}, harusnya {aktif}",
            )

            # Catatan selesai memakai data sampai waktu kejadian, bukan data sesudahnya.
            kebun = kebun_baru("Kakao")
            node_lama, node_baru = f"node-{suffix}-lama", f"node-{suffix}-baru"
            kirim_ke(kebun, node_lama, 70.0)
            kirim_ke(kebun, node_baru, 65.0)
            mundurkan(node_lama, 3)
            mundurkan(node_baru, 1)
            sql(
                "INSERT INTO readings (farm_id, node_id, soil_moisture, soil_temp, air_temp, air_humidity, created_at) "
                "VALUES (?, ?, 35.0, 26, 30, 70, ?)",
                (kebun, node_lama, jam_lalu(1)),
            )
            sql(
                "INSERT INTO decision_logs (node_id, soil_moisture, weather, decision, decision_type, valve_state, "
                "reason, created_at) VALUES (?, 35.0, '', 'Manual: valve dibuka', 'manual_open', 'open', 'uji', ?)",
                (node_lama, jam_lalu(1)),
            )
            sql("UPDATE farms SET limited_until = ?, limited_reason = 'harvest' WHERE id = ?", (jam_lalu(2), kebun))
            ringkasan = client.get(f"/api/farms/{kebun}/summary", headers=auth).json()
            selesai_lama = catatan(node_lama, "limited_ended")
            report.check(
                "kelembapan dan valve sesudah tanggal selesai tidak tersalin (tertutup, 70%)",
                len(selesai_lama) == 1 and selesai_lama[0]["valve_state"] == "closed"
                and selesai_lama[0]["soil_moisture"] == 70.0 and selesai_lama[0]["created_at"] == jam_lalu(2),
                f"catatan {[(r['valve_state'], r['soil_moisture'], r['created_at']) for r in selesai_lama]}",
            )
            report.check(
                "node yang baru mengirim data setelah tanggal selesai tidak dapat catatan selesai, periode tetap berakhir",
                catatan(node_baru, "limited_ended") == [] and ringkasan["farm"]["limited_until"] is None,
                f"catatan {catatan(node_baru, 'limited_ended')}, limited_until {ringkasan['farm']['limited_until']}",
            )

            # Tanggal di ujung kalender dengan zona jauh dari UTC ditolak 422, bukan 500.
            kebun = kebun_baru("Melon")
            ekstrem = ("0001-01-01T00:00:00+14:00", "9999-12-31T23:59:59-14:00")
            status_post = [
                client.post(url_terbatas(kebun), json={"reason": "other", "until": teks}, headers=auth).status_code
                for teks in ekstrem
            ]
            client.post(url_terbatas(kebun), json={"reason": "other", "until": batas(5)}, headers=auth)
            status_patch = [
                client.patch(url_terbatas(kebun), json={"until": teks}, headers=auth).status_code
                for teks in ekstrem
            ]
            report.check(
                "tanggal ekstrem ditolak 422 di POST dan PATCH",
                status_post == [422, 422] and status_patch == [422, 422],
                f"POST {status_post}, PATCH {status_patch}",
            )

            # Konversi UTC: zona +07:00 dan tanpa zona disimpan sebagai UTC.
            kebun = kebun_baru("Semangka")
            target = sekarang + timedelta(days=5)
            plus7 = target.astimezone(timezone(timedelta(hours=7))).isoformat()
            ditulis = client.post(
                url_terbatas(kebun), json={"reason": "other", "until": plus7}, headers=auth
            ).json()["farm"]["limited_until"]
            client.delete(url_terbatas(kebun), headers=auth)
            tanpa_zona = client.post(
                url_terbatas(kebun), json={"reason": "other", "until": target.replace(tzinfo=None).isoformat()},
                headers=auth,
            ).json()["farm"]["limited_until"]
            harusnya = target.strftime("%Y-%m-%d %H:%M:%S")
            report.check(
                "zona +07:00 dan tanpa zona disimpan sebagai UTC",
                ditulis == harusnya and tanpa_zona == harusnya,
                f"+07:00 {ditulis}, tanpa zona {tanpa_zona}, harusnya {harusnya}",
            )

            # Kebun tanpa node: mulai, ubah, dan selesai sendiri tanpa error.
            kebun = kebun_baru("Wortel")
            status_kosong = [
                client.post(url_terbatas(kebun), json={"reason": "other", "until": batas(5)}, headers=auth).status_code,
                client.patch(url_terbatas(kebun), json={"until": batas(6)}, headers=auth).status_code,
            ]
            sql("UPDATE farms SET limited_until = ? WHERE id = ?", (jam_lalu(1), kebun))
            ringkasan = client.get(f"/api/farms/{kebun}/summary", headers=auth)
            report.check(
                "kebun tanpa node: mulai, ubah, dan selesai sendiri tanpa error",
                status_kosong == [200, 200] and ringkasan.status_code == 200
                and ringkasan.json()["farm"]["limited_until"] is None,
                f"status {status_kosong}, summary {ringkasan.status_code}",
            )

            # Node tanpa data tidak dicatat, node yang sudah melapor dicatat sekali.
            kebun = kebun_baru("Tembakau")
            node_data, node_kosong = f"node-{suffix}-data", f"node-{suffix}-kosong"
            kirim_ke(kebun, node_data, 55.0)
            client.post(
                f"/api/gateways/GW-TEMBAKAU-{suffix}/register",
                json={"farm_id": kebun, "nodes": [{"node_id": node_kosong, "name": "Tanpa Data"}]},
                headers=auth,
            )
            client.post(url_terbatas(kebun), json={"reason": "other", "until": batas(5)}, headers=auth)
            report.check(
                "node tanpa data tidak dicatat, node yang sudah melapor dicatat sekali",
                catatan(node_kosong, "limited_started") == [] and len(catatan(node_data, "limited_started")) == 1,
                f"kosong {len(catatan(node_kosong, 'limited_started'))}, data {len(catatan(node_data, 'limited_started'))}",
            )

            # Pengaman pulsa tetap menjeda node saat Irigasi Terbatas aktif.
            kebun = kebun_baru("Kentang")
            node = f"node-{suffix}-pulsa"
            kirim_ke(kebun, node, 75.0)
            client.post(url_terbatas(kebun), json={"reason": "other", "until": batas(5)}, headers=auth)
            sql(
                "UPDATE nodes SET auto_pulse_count = 2, auto_pulse_started_at = ?, auto_cycle_baseline = 50.0, "
                "auto_confirmed_pulse_count = 2, auto_paused_at = NULL, last_seen_at = CURRENT_TIMESTAMP "
                "WHERE id = ?",
                ((sekarang - timedelta(minutes=45)).strftime("%Y-%m-%d %H:%M:%S"), node),
            )
            keputusan = kirim_ke(kebun, node, 50.0)
            report.check(
                "pengaman pulsa tetap menjeda node saat Irigasi Terbatas aktif",
                keputusan["type"] == "check_irrigation",
                f"keputusan {keputusan['type']}",
            )
        finally:
            for kebun in kebun_uji:
                client.delete(f"/api/farms/{kebun}", headers=auth)

        section("Isolasi antar user")
        other_email = f"smoke-other-{suffix}@lorafield-smoke.com"
        daftar_akun(other_email, password, "Orang Lain")
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
        status = client.patch(f"/api/nodes/{node_a}/name", json={"name": "Punya Saya"}, headers=other_auth).status_code
        report.check("user lain tidak bisa ganti nama node orang", status == 404, f"status {status}")
        status = client.post(f"/api/nodes/{node_a}/irrigation/resume", headers=other_auth).status_code
        report.check("user lain tidak bisa mengaktifkan otomatis node orang", status == 404, f"status {status}")
        status = client.post(
            f"/api/farms/{farm_id}/limited-irrigation",
            json={"reason": "other", "until": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()},
            headers=other_auth,
        ).status_code
        report.check("user lain tidak bisa memulai Irigasi Terbatas kebun orang", status == 404, f"status {status}")
        status = client.patch(
            f"/api/farms/{farm_id}/limited-irrigation",
            json={"until": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()},
            headers=other_auth,
        ).status_code
        report.check("user lain tidak bisa mengubah Irigasi Terbatas kebun orang", status == 404, f"status {status}")
        status = client.delete(f"/api/farms/{farm_id}/limited-irrigation", headers=other_auth).status_code
        report.check("user lain tidak bisa menghentikan Irigasi Terbatas kebun orang", status == 404, f"status {status}")
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
