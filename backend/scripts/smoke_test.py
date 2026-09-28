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
from app import mqtt_bridge  # noqa: E402
from app.main import app  # noqa: E402
from app.routers import auth as auth_router  # noqa: E402
from app.schemas import ThresholdConfig  # noqa: E402


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
                "L1 5 kali gagal login mengunci akun, password benar pun 429",
                statuses == [401] * 5 + [429],
                f"status {statuses}",
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
            statuses = [
                client.post("/api/auth/forgot-password", json={"email": sec_email}).status_code
                for _ in range(6)
            ]
            report.check(
                "F1 forgot-password dibatasi 5 per hari",
                statuses == [200] * 5 + [429],
                f"status {statuses}",
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
            for i in range(300):
                acak = f"acak{i}-{suffix}@lorafield-smoke.com"
                client.post("/api/auth/login", json={"email": acak, "password": password})
                client.post("/api/auth/forgot-password", json={"email": acak})
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

            def verify_lambat(plain, hashed):
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
            report.check(
                "P2 20 login paralel: tepat 5 dicek, sisanya 429",
                sorted(login_statuses) == [401] * 5 + [429] * 15,
                f"status {sorted(login_statuses)}",
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

            def publish(self, topic, body, qos, retain):
                self.terkirim.append((topic, json.loads(body)))
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
            report.check(
                "MQTT: status (tanpa retain) dan heartbeat tercatat di log gateway",
                sorted(events) == ["connected", "heartbeat"],
                f"events {events}",
            )
            summary_mqtt = client.get(f"/api/farms/{farm_mqtt}/summary", headers=auth).json()
            report.check(
                "MQTT: gateway dan node online di summary",
                summary_mqtt.get("gateway_status") == "online" and summary_mqtt.get("nodes_online") == 1,
                f"gateway {summary_mqtt.get('gateway_status')}, online {summary_mqtt.get('nodes_online')}",
            )

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
        finally:
            mqtt_bridge._client = None
            mqtt_bridge._last_published.clear()
            client.delete(f"/api/farms/{farm_mqtt}", headers=auth)

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
