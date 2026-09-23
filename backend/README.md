# LoraField Backend

Backend basic untuk dashboard LoraField. API ini memakai FastAPI dan SQLite
sebagai fondasi awal sebelum integrasi MQTT dan hardware LoRa.

Data cuaca diambil dari API publik BMKG:
`https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4={kode_wilayah}`.

## Menjalankan

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # Linux/Mac
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API tersedia di `http://127.0.0.1:8000`.

Dokumentasi otomatis FastAPI tersedia di `http://127.0.0.1:8000/docs`.

Backend juga men-serve frontend React (`frontend/dist/`) di `/`: SPA fallback untuk
route non-API dan aset build di `/assets/` (hasil `npm run build` di `frontend/`).

## Konfigurasi (.env)

Salin `.env.example` menjadi `.env`, lalu isi nilainya:

```
JWT_SECRET_KEY=...                  # generate dengan secrets.token_urlsafe(64)
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=1440

RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=onboarding@resend.dev

FRONTEND_URL=http://localhost:8000/static
```

Jika `RESEND_API_KEY` belum diisi, endpoint forgot-password tetap berjalan dan
mengembalikan kode reset di response (mode dev) sehingga reset bisa diuji tanpa
provider email.

## Endpoint

### Auth

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| POST | `/api/auth/register` | Buat akun baru (nama, email, password, bahasa hasil deteksi browser) |
| POST | `/api/auth/login` | Login, mengembalikan JWT bearer token dan preferensi bahasa akun |
| GET | `/api/auth/me` | Profil user dari token bearer; bahasa browser menginisialisasi akun lama |
| PATCH | `/api/auth/profile` | Update profil user (nomor HP) |
| PATCH | `/api/auth/preferences/language` | Update preferensi bahasa akun |
| POST | `/api/auth/forgot-password` | Minta kode reset 6 digit; email dikirim via Resend |
| POST | `/api/auth/reset-password/verify` | Verifikasi kode reset (tahap 1) |
| POST | `/api/auth/reset-password` | Set password baru dengan kode reset (tahap 2) |
| POST | `/api/auth/resend-verification` | Kirim ulang link verifikasi akun |

### Farm (per user, butuh bearer token)

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| GET | `/api/farms` | Daftar kebun milik user aktif |
| GET | `/api/farms/{farm_id}` | Detail satu kebun (dibatasi pemilik) |
| POST | `/api/farms` | Tambah kebun baru, auto-resolve kode BMKG dari koordinat jika kosong |
| PATCH | `/api/farms/{farm_id}` | Update data kebun (dibatasi pemilik) |
| DELETE | `/api/farms/{farm_id}` | Hapus kebun (dibatasi pemilik) |
| GET | `/api/farms/{farm_id}/weather` | Cuaca BMKG kebun (pakai cache) |
| GET | `/api/farms/{farm_id}/summary` | Ringkasan kebun: cuaca, node, keputusan |

### Node Sensor

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| GET | `/api/nodes` | Daftar node (opsional `?farm_id=...`) |
| PATCH | `/api/nodes/{node_id}/location` | Simpan lokasi dan koordinat node |
| GET | `/api/nodes/{node_id}/readings` | Riwayat pembacaan sensor (limit 1-100) |
| POST | `/api/nodes/{node_id}/readings?adm4=...` | Simpan pembacaan sensor baru dari node |

### Cuaca & Keputusan

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| GET | `/api/weather?adm4={kode_wilayah}` | Data cuaca aktif dari BMKG (tanpa cache) |
| GET | `/api/crops` | Daftar jenis tanaman dan threshold VWC |
| GET | `/api/utils/resolve-adm4?lat=...&lon=...` | Resolve kode BMKG adm4 dari koordinat |
| GET | `/api/decision` | Simulasi keputusan irigasi |
| GET | `/api/logs` | Log keputusan terbaru |

### Legacy

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| GET | `/api/summary?adm4={kode_wilayah}` | Ringkasan node pertama (backward compatible) |

## Alur Reset Password (2 Tahap)

1. User submit email di halaman login (panel "Lupa Password") atau halaman reset
   khusus → backend memanggil `POST /api/auth/forgot-password`.
2. Backend menyimpan OTP 6 digit di tabel `password_resets` (kadaluwarsa 30
   menit) dan mengirim email berisi tautan ke
   `${FRONTEND_URL}/reset-password.html` + kode reset (manual input, bukan
   auto-fill).
3. User membuka halaman reset, input kode reset, lalu sistem memverifikasi
   dengan `POST /api/auth/reset-password/verify`.
4. Jika kode valid, form password baru tampil. User submit dan backend
   menggantikan password lewat `POST /api/auth/reset-password`.
5. Setelah sukses, user diarahkan ke `login.html` dan login dengan password
   baru.

## Contoh Ambil Cuaca BMKG

```bash
curl "http://127.0.0.1:8000/api/weather?adm4=31.71.01.1001"
```

## Contoh Payload Sensor

```json
{
  "soil_moisture": 38,
  "soil_temp": 27.5,
  "air_temp": 30.2,
  "air_humidity": 78
}
```

Database SQLite akan dibuat otomatis di `backend/data/lorafield.db` saat API
pertama kali berjalan. Tabel utama: `users`, `password_resets`, `farms`,
`nodes`, `readings`, `decision_logs`, `weather_cache`.
