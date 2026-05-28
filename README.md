# LoraField: Sistem Pertanian Presisi Berbasis LoRa

Dashboard web frontend untuk monitoring sensor dan otomasi irigasi lahan pertanian berbasis LoRa P2P.

## Deskripsi

LoraField memakai node sensor berbasis LILYGO LoRa32 untuk membaca kelembapan tanah, suhu tanah, suhu udara, dan kelembapan udara. Data dikirim lewat LoRa P2P ke gateway, lalu ditampilkan di dashboard web. Sistem mendukung banyak kebun per user dan menggunakan prakiraan cuaca BMKG per kebun untuk menunda irigasi jika hujan diprediksi turun dalam 3 jam ke depan.

## Struktur Folder

```text
.
|-- backend/
|   |-- app/
|   |   |-- __init__.py
|   |   |-- database.py
|   |   |-- main.py
|   |   `-- schemas.py
|   |-- data/                   # lorafield.db dibuat otomatis
|   |-- requirements.txt
|   `-- README.md
|-- frontend/
|   |-- public/
|   |   `-- static/
|   |       |-- index.html          # Dashboard statis lama
|   |       |-- monitoring.html
|   |       |-- irrigation.html
|   |       |-- weather.html
|   |       |-- logs.html
|   |       |-- css/
|   |       `-- js/
|   |-- src/                        # React/Vite (dalam pengembangan)
|   |   |-- components/
|   |   |-- pages/
|   |   |-- services/
|   |   `-- ...
|   |-- index.html
|   |-- package.json
|   `-- vite.config.js
`-- README.md
```

## Cara Menjalankan

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # Linux/Mac
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Backend tersedia di `http://127.0.0.1:8000`. Dokumentasi interaktif: `http://127.0.0.1:8000/docs`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Versi halaman statis lama: `frontend/public/static/index.html`.

## API Endpoints

### Auth

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/api/auth/register` | Buat akun baru |
| POST | `/api/auth/login` | Login (mengembalikan JWT bearer token) |
| GET | `/api/auth/me` | Profil user dari token, termasuk nomor HP |
| PATCH | `/api/auth/profile` | Update profil user (nomor HP) |
| POST | `/api/auth/forgot-password` | Kirim kode reset 6 digit ke email |
| POST | `/api/auth/reset-password/verify` | Verifikasi kode reset (tahap 1) |
| POST | `/api/auth/reset-password` | Set password baru (tahap 2) |
| POST | `/api/auth/resend-verification` | Kirim ulang verifikasi akun |

### Kebun (Farm)

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/farms` | Daftar kebun milik user (butuh bearer token) |
| GET | `/api/farms/{farm_id}` | Detail satu kebun (dibatasi pemilik) |
| POST | `/api/farms` | Tambah kebun baru, auto-resolve kode BMKG dari koordinat jika kosong |
| PATCH | `/api/farms/{farm_id}` | Update data kebun (dibatasi pemilik) |
| DELETE | `/api/farms/{farm_id}` | Hapus kebun (dibatasi pemilik) |
| GET | `/api/farms/{farm_id}/weather` | Cuaca BMKG untuk kebun (dari cache) |
| GET | `/api/farms/{farm_id}/summary` | Ringkasan lengkap kebun: cuaca, node, keputusan irigasi |

### Node Sensor

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/nodes` | Daftar semua node (opsional: `?farm_id=...`) |
| PATCH | `/api/nodes/{node_id}/location` | Update lokasi node |
| GET | `/api/nodes/{node_id}/readings` | Riwayat reading node |
| POST | `/api/nodes/{node_id}/readings?adm4=...` | Kirim data sensor baru |

### Cuaca & Keputusan

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/weather?adm4=...` | Test endpoint cuaca BMKG langsung (tanpa cache) |
| GET | `/api/crops` | Daftar jenis tanaman dan threshold VWC |
| GET | `/api/utils/resolve-adm4?lat=...&lon=...` | Resolve kode BMKG adm4 dari koordinat |
| GET | `/api/decision?soil_moisture=...&rain_next_3h=...` | Simulasi keputusan irigasi |
| GET | `/api/logs` | Riwayat keputusan irigasi |

### Legacy

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/summary?adm4=...` | Ringkasan node pertama (backward compatible) |

## Model Data

### Farm

```json
{
  "id": "farm-01",
  "user_id": "user-01",
  "name": "Kebun Salak Bantul",
  "owner": "Pak Budi",
  "location": "Bantul, D.I. Yogyakarta",
  "crop_type": "Salak",
  "area_ha": 0.5,
  "bmkg_adm4_code": "34.02.01.2001",
  "latitude": -7.8881,
  "longitude": 110.3289,
  "status": "active"
}
```

### Akses per User

Setiap user hanya mengakses kebun miliknya sendiri. Endpoint kebun memakai
bearer token JWT — backend mengambil user dari token, bukan dari query string.

```text
GET /api/farms
Authorization: Bearer <token-dari-login>
```

```text
user-01 (Pak Budi):
  -> farm-01: Kebun Salak Bantul
  -> farm-02: Kebun Cabai Sleman

user-02 (Bu Sari):
  -> farm-03: Kebun Melon Bantul
```

## Cache Cuaca BMKG

Backend menyimpan hasil prakiraan BMKG ke tabel `weather_cache` per kode wilayah (`adm4`). TTL cache: **30 menit**. Endpoint `/api/farms/{farm_id}/weather` dan `/api/farms/{farm_id}/summary` menggunakan cache ini secara otomatis.

Endpoint `/api/weather?adm4=...` selalu mengambil langsung dari BMKG (tanpa cache), dipakai untuk keperluan test dan debug.

## Logika Irigasi

| Kondisi | Cuaca | Keputusan |
|---------|-------|-----------|
| Kelembapan < threshold bawah (40%) | Tidak ada prediksi hujan | Valve terbuka |
| Kelembapan < threshold bawah (40%) | Prediksi hujan ≤ 3 jam | Irigasi ditunda |
| Kelembapan > threshold atas (70%) | Apapun | Valve tertutup |
| Kelembapan dalam rentang threshold | Apapun | Standby |

`rain_next_3h` mengecek slot prakiraan sekarang dan slot 3 jam berikutnya dari BMKG.

## Catatan Kode Wilayah BMKG

`bmkg_adm4_code` di tiap farm adalah kode wilayah level desa dari sistem BMKG. Contoh kode yang sudah diverifikasi: `31.71.01.1001`. Kode untuk lokasi lain dapat dicari di [data.bmkg.go.id](https://data.bmkg.go.id/prakiraan-cuaca/) dan diperbarui lewat database atau API.

## Status Integrasi

| Komponen | Teknologi | Status |
|----------|-----------|--------|
| Backend API | FastAPI | Tersedia v1.3 |
| Database | SQLite | Tersedia, multi-farm |
| Cache Cuaca | SQLite (in-process) | Tersedia, TTL 30 menit |
| Data Cuaca | API BMKG | Terintegrasi |
| Message Broker | Mosquitto MQTT | Belum diintegrasikan |
| Real-time Update | WebSocket | Belum diintegrasikan |
| Node Sensor | LILYGO LoRa32 | Hardware terpisah |
| Frontend React | React/Vite | Scaffold tersedia |

## Teknologi

- FastAPI + Uvicorn
- SQLite (via sqlite3 standar Python)
- httpx (HTTP client untuk BMKG)
- Pydantic v2
- React/Vite (scaffold)
- HTML/CSS/JS vanilla (frontend statis lama)
- Chart.js v4

## Capstone Design Project

Proyek ini merupakan bagian dari Capstone Design Project untuk pengembangan sistem pertanian presisi di D.I. Yogyakarta.
