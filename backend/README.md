# LoraField Backend

Backend dashboard LoraField: FastAPI + SQLite, fondasi sebelum integrasi MQTT dan
hardware LoRa. Backend juga men-serve hasil build frontend (`frontend/dist/`) di `/`.

Data cuaca diambil dari API publik BMKG:
`https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4={kode_wilayah}`.

## Menjalankan

Windows: klik dua kali `lorafield.bat` di root repo (menu start/stop/restart/status).

Manual:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # Linux/Mac (atau jalankan start-server.sh)
pip install -r requirements.txt
uvicorn app.main:app --reload
```

- API: `http://127.0.0.1:8000`
- Dokumentasi otomatis: `http://127.0.0.1:8000/docs`
- Frontend: jalankan `npm run build` di `frontend/`, lalu buka `http://127.0.0.1:8000`

## Konfigurasi (.env)

Buat file `backend/.env`:

```
JWT_SECRET_KEY=...                  # wajib; python -c "import secrets; print(secrets.token_urlsafe(64))"
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=120

RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=onboarding@resend.dev

FRONTEND_URL=http://localhost:8000  # dipakai untuk link di email reset password
ALLOWED_ORIGINS=                    # opsional, origin CORS tambahan, pisah koma
EXPOSE_DEV_TOKENS=false             # true hanya untuk tes lokal
```

Kalau `RESEND_API_KEY` kosong dan `EXPOSE_DEV_TOKENS=true`, forgot-password ikut
mengembalikan kode reset di response supaya bisa dites tanpa email. Jangan aktifkan
di production.

## Endpoint

Daftar lengkap dan selalu sesuai kode ada di `http://127.0.0.1:8000/docs`.
Ringkasan kontrak API untuk frontend ada di section "Backend Endpoints" di `CLAUDE.md`.

## Alur Reset Password (2 Tahap)

1. User mengisi email di panel "Lupa Password" (halaman login) atau `/reset-password`,
   lalu frontend memanggil `POST /api/auth/forgot-password`.
2. Backend menyimpan OTP 6 digit di tabel `password_resets` (kedaluwarsa 30 menit)
   dan mengirim email berisi tautan ke `${FRONTEND_URL}/reset-password` + kode reset.
3. User memasukkan kode, diverifikasi lewat `POST /api/auth/reset-password/verify`.
4. Kalau valid, user mengisi password baru, disimpan lewat `POST /api/auth/reset-password`.
5. Setelah berhasil, user login ulang di `/login`.

## Contoh

Ambil cuaca BMKG (butuh bearer token):

```bash
curl -H "Authorization: Bearer <token>" "http://127.0.0.1:8000/api/weather?adm4=31.71.01.1001"
```

Payload `POST /api/nodes/{node_id}/readings?adm4=...` (untuk node baru, sertakan `farm_id`):

```json
{
  "soil_moisture": 38,
  "soil_temp": 27.5,
  "air_temp": 30.2,
  "air_humidity": 78
}
```

## Database

SQLite dibuat otomatis di `backend/data/lorafield.db` saat API pertama kali jalan.
Tabel: `users`, `password_resets`, `farms`, `gateways`, `gateway_logs`, `nodes`,
`readings`, `decision_logs`, `weather_cache`, `wilayah`.

## Skrip operasional

Backup database, auto-restart server, smoke test, dan snapshot kontrak API ada di
`scripts/` (panduan di `scripts/README.md`).
