# CODEX.md

Panduan kerja untuk Codex saat membantu pengembangan LoraField.

## Tujuan Proyek

LoraField adalah dashboard web untuk monitoring kebun berbasis LoRa. User login dengan akun pribadi, melihat ringkasan semua kebun miliknya di Dashboard Utama, lalu memilih salah satu kebun dari Peta Kebun Interaktif atau card kebun untuk masuk ke Detail Kebun.

Revisi aktif: struktur web dashboard LoraField revisi 1.3 dengan fitur map pemilihan kebun.

## Konteks Repo

- `frontend/`: scaffold React/Vite
- `frontend/public/static/`: halaman statis lama berbasis HTML/CSS/JS
- `backend/`: backend basic FastAPI + SQLite
- `AGENTS.md`: aturan proyek singkat
- Root repo hanya untuk dokumentasi dan metadata proyek

Jika membuat perubahan, baca file terkait terlebih dahulu dan ikuti pola lokal yang sudah ada.

## Progres Auth Terkini (Apa Adanya)

Status ini khusus progres login/register/forgot/reset yang sudah dikerjakan di sesi ini.

Sudah jadi:

- Register akun dari UI `register.html` sudah pakai API real `POST /api/auth/register`.
- Login dari UI `login.html` sudah pakai API real `POST /api/auth/login`.
- Error login `401` di UI sudah pakai copy: `Username atau password salah.`
- Tombol show/hide password (ikon mata) sudah ada di login/register/reset.
- Endpoint backend auth tambahan sudah ada:
  - `POST /api/auth/forgot-password`
  - `POST /api/auth/reset-password`
  - `POST /api/auth/reset-password/verify`
  - `POST /api/auth/resend-verification`
- Reset code sudah diubah dari token panjang menjadi OTP 6 digit angka.
- Halaman reset password khusus sudah ada: `frontend/public/static/reset-password.html`.
- Flow reset di halaman reset sekarang 2 tahap:
  1. verifikasi kode reset dulu
  2. baru tampil form password baru + konfirmasi
- Link email reset sekarang membuka halaman reset tanpa auto-fill token.
- Input kode reset sekarang manual (tidak otomatis terisi dari URL), baik di `reset-password.html` maupun flow reset di `login.html`.
- Backend sudah mount static frontend ke `/static` (di port backend), sehingga link email diarahkan ke base `http://localhost:8000/static`.
- Cacat yang sudah ditutup: flow forgot password di `login.html` sebelumnya bisa loop kirim email terus saat provider email aktif; sekarang step reset lanjut normal tanpa ketergantungan auto-fill token.

Yang perlu dicek ulang setelah perubahan terakhir:

- Restart backend agar config/link email terbaru aktif.
- Kirim ulang forgot password dan pastikan email baru mengarah ke:
  - `http://localhost:8000/static/reset-password.html`
- Uji end-to-end reset 2 tahap:
  - verifikasi kode 6 digit
  - ganti password
  - login ulang dengan password baru
- Uji flow forgot dari `login.html`: klik `Kirim Link Reset` sekali, lalu lanjut input kode manual + password baru tanpa kirim ulang terus.

File utama yang tersentuh untuk fitur auth ini:

- `backend/app/main.py`
- `backend/app/schemas.py`
- `backend/app/config.py`
- `backend/.env`
- `backend/.env.example`
- `frontend/public/static/login.html`
- `frontend/public/static/register.html`
- `frontend/public/static/reset-password.html`
- `frontend/public/static/css/dashboard.css`

## Audit Proyek 2026-05-24 (Ringkas, Faktual)

Temuan kritis dan status:

- `FIXED` Frontend static `js/api.js` tidak selaras dengan backend auth:
  - sebelumnya pakai `GET /api/farms?user_id=...` tanpa header `Authorization`
  - sekarang pakai `GET /api/farms` + `Bearer token` dari `localStorage`
  - ketika `401/403`, halaman non-auth diarahkan ke `login.html`
- `FIXED` Flow forgot password sempat berpotensi loop kirim email di `login.html`:
  - sekarang step state dipisah (`kirim link` -> `reset password`) tanpa ketergantungan auto-fill token
- `FIXED` Link reset email dan UI token:
  - link reset menuju halaman reset khusus
  - token/kode reset wajib input manual
  - reset page 2 tahap: verifikasi kode lalu ganti password
- `OPEN` Endpoint `resend-verification` masih basic:
  - token verifikasi dibuat dan dikirim, tapi belum ada penyimpanan token + endpoint verifikasi akun final
- `OPEN` Rate limit/brute-force protection belum ada untuk endpoint auth sensitif (`login`, `forgot-password`, `reset-password/verify`, `reset-password`)
- `OPEN` Drift dokumentasi backend:
  - `backend/README.md` belum mencerminkan endpoint auth terbaru dan alur reset 2 tahap

Risiko yang perlu dihindari ke depan:

- Jangan ubah kontrak endpoint auth tanpa sinkronisasi langsung ke `login.html`, `register.html`, `reset-password.html`, dan `js/api.js`.
- Jangan mengirim link reset yang mengandalkan auto-fill token URL; tetap manual input kode reset.
- Jangan pakai parameter `user_id` di endpoint farm; sumber kebenaran user harus dari JWT backend.
- Jangan simpan API key/secrets ke file yang ikut version control; `backend/.env` tetap lokal, `backend/.env.example` hanya placeholder.

Quality Gate Wajib Sebelum Menutup Task:

1. Backend smoke:
   - import app sukses (`from app.main import app`)
   - route auth utama tersedia (`/api/auth/login`, `/api/auth/me`, `/api/auth/forgot-password`, `/api/auth/reset-password/verify`, `/api/auth/reset-password`)
2. Frontend static syntax:
   - `node --check` untuk `frontend/public/static/js/*.js`
3. Auth flow manual check:
   - register -> login -> `/api/auth/me` valid
   - forgot password -> email diterima -> verifikasi kode -> ganti password -> login dengan password baru
4. URL consistency:
   - reset link email harus konsisten dengan `FRONTEND_URL` aktif
   - jika pakai backend static, target harus `http://localhost:8000/static/...`

## Alur Produk

```text
Login
-> Dashboard Utama
-> Ringkasan seluruh kebun user
-> Peta Kebun Interaktif
-> Pilih kebun dari marker map atau card
-> Detail Kebun
-> Monitoring lengkap kebun terpilih
```

Dashboard Utama tidak boleh langsung menjadi halaman monitoring detail. Dashboard hanya berisi ringkasan seluruh kebun dan pintu masuk ke detail per kebun.

## Modul Web

Modul utama:

- Login Page
- Dashboard Utama
- Peta Kebun Interaktif
- Daftar Kebun / Kebun Saya
- Detail Kebun
- Monitoring Sensor
- Grafik Monitoring
- Irigasi
- Gateway
- Node Sensor
- Cuaca BMKG
- Riwayat / Laporan
- Settings

Menu sidebar:

```text
Dashboard
Kebun Saya
Monitoring
Irigasi
Gateway
Node Sensor
Cuaca
Riwayat
Settings
```

Jangan mengubah urutan atau konsep sidebar kecuali user meminta.

## Dashboard Utama

Dashboard Utama harus menampilkan:

- Sapaan user
- Total kebun
- Gateway online
- Gateway offline
- Node aktif
- Node bermasalah
- Rata-rata kelembapan tanah seluruh kebun
- Status irigasi keseluruhan
- Peringatan penting
- Peta Kebun Interaktif
- Card/daftar kebun

Card kebun harus berisi:

- Nama kebun
- Lokasi
- Jenis tanaman
- Status gateway
- Rata-rata kelembapan tanah
- Status valve
- Status irigasi
- Prediksi hujan singkat
- Last update
- Tombol `Lihat Detail`

## Peta Kebun Interaktif

Map adalah fitur revisi 1.3 dan wajib dipertahankan pada Dashboard Utama.

Perilaku map:

- Tampilkan marker hanya untuk kebun milik user yang login
- Klik marker membuka popup ringkasan kebun
- Popup memiliki tombol `Lihat Detail`
- Klik `Lihat Detail` membuka Detail Kebun untuk farm yang dipilih
- Card dan marker harus menuju data detail yang sama
- Kebun yang dipilih boleh diberi highlight

Data minimal untuk kebun:

```text
id
name
location
crop_type
area
latitude
longitude
bmkg_region_code
gateway_status
node_count
average_soil_moisture
valve_status
irrigation_status
weather_summary
last_update
```

## Detail Kebun

Detail Kebun hanya menampilkan data untuk satu kebun terpilih.

Isi utama:

- Informasi kebun
- Status utama kebun
- Gateway
- Node sensor
- Monitoring sensor
- Grafik historis
- Irigasi
- Cuaca BMKG
- Riwayat sistem

Status utama kebun:

- Gateway online/offline
- Jumlah node aktif
- Jumlah node bermasalah
- Rata-rata kelembapan tanah
- Status valve
- Status irigasi
- Prediksi hujan BMKG
- Peringatan penting

## Data dan Akses

Model akses:

```text
User -> Farm -> Gateway -> Node -> Sensor Data -> Irrigation Log -> Dashboard
```

Aturan penting:

- User biasa hanya melihat farm/kebun miliknya
- Jangan mencampur data kebun lintas user
- Admin pusat boleh memiliki akses semua kebun hanya jika fitur admin sedang dibuat
- Setiap kebun diasumsikan memiliki satu gateway
- Satu gateway menerima data dari beberapa node sensor

## Logika Irigasi

Keputusan sistem:

- Buka valve jika kelembapan tanah di bawah threshold dan tidak ada prediksi hujan
- Tutup valve jika kelembapan tanah sudah cukup
- Tunda irigasi jika BMKG memprediksi hujan
- Tunggu data terbaru jika gateway offline

Data irigasi:

- Status valve
- Mode otomatis/manual
- Threshold bawah kelembapan tanah
- Threshold atas kelembapan tanah
- Keputusan sistem
- Alasan keputusan
- Durasi irigasi
- Riwayat buka/tutup/tunda valve

## UI dan Copywriting

- UI label memakai Bahasa Indonesia
- Pertahankan istilah teknis: LoRa, VWC, MQTT, Gateway, Node, BMKG, RSSI
- Tema gelap proyek: `#0d1117`
- Aksen utama: `#00e676`
- Badge status konsisten: hijau untuk normal/online, kuning untuk peringatan, merah untuk masalah/offline
- Hindari inline style, gunakan CSS class
- Dashboard operasional harus ringkas, rapi, dan mudah discan
- Jangan membuat hero/landing page kecuali user meminta eksplisit

## Cara Kerja Codex

- Baca struktur dan file terkait sebelum mengubah kode
- Gunakan perubahan kecil yang langsung menjawab kebutuhan user
- Jangan refactor luas tanpa alasan
- Jangan menghapus perubahan user
- Jika menyentuh frontend, pastikan tampilan responsive dan tidak ada teks saling tumpang tindih
- Jika menyentuh backend, pertahankan struktur FastAPI yang sudah ada
- Jika menjalankan test/build gagal karena dependency belum terpasang, laporkan dengan jelas

## Referensi File

- Static dashboard lama: `frontend/public/static/index.html`
- CSS utama static: `frontend/public/static/css/style.css`
- Logic static utama: `frontend/public/static/js/main.js`
- Dummy data static: `frontend/public/static/js/dummy-data.js`
- React entry: `frontend/src/App.jsx`
- Backend API: `backend/app/main.py`
- Backend schema: `backend/app/schemas.py`
