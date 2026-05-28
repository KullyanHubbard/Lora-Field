# CLAUDE.md

Panduan kerja untuk Claude saat membantu pengembangan LoraField.

## Ringkasan Proyek

LoraField adalah web dashboard monitoring pertanian presisi berbasis LoRa. Sistem digunakan user untuk memantau satu atau beberapa kebun miliknya, melihat data node sensor, status gateway, status valve, keputusan irigasi, prakiraan cuaca BMKG, grafik historis, dan riwayat sistem.

Alur utama revisi 1.3:

```text
User membuka Web LoraField
-> Login menggunakan akun dan password (atau Daftar Akun jika belum punya)
-> Sistem memverifikasi akun
-> User masuk ke Dashboard Utama
-> Dashboard menampilkan ringkasan semua kebun user
-> Dashboard menampilkan Peta Kebun Interaktif
-> User memilih kebun dari marker map atau card kebun
-> User masuk ke Detail Kebun
-> Sistem menampilkan monitoring lengkap kebun terpilih
```

## Stack dan Struktur Repo

- **UI aktif (development):** React/Vite di `frontend/src/` — ini yang dikerjakan sekarang
- **UI lama (backup):** HTML/CSS/JS vanilla di `frontend/public/static/` — MASIH ADA, jangan hapus sampai Fase 5 selesai
- **Backend:** FastAPI + SQLite di `backend/`
- **Dev server React:** `cd frontend && npm run dev` → port 5173 (proxy `/api` → port 8000)
- **Backend server:** `backend/start-server.bat` atau `uvicorn backend.app.main:app --host 0.0.0.0 --port 8000`
- Label UI memakai Bahasa Indonesia
- Istilah teknis tetap dipertahankan: LoRa, VWC, MQTT, Gateway, Node, BMKG, RSSI

### Dependencies frontend (npm)

- Vite 5.4 + React 18.3 + React Router 7.15
- Leaflet 1.9.4 (peta kebun)
- Chart.js 4.4.1 + react-chartjs-2 5.2.0 (grafik monitoring)
- CSS lama dari `frontend/public/static/css/` di-serve via `public/` folder Vite

## Status Migrasi React

Migrasi dari HTML vanilla ke React sudah berjalan. Status per 2026-05-26:

- **Fase 1–4b: SELESAI** — semua halaman utama sudah diport ke React, SPA bisa dijalankan via port 5173
- **Fase 5: BELUM** — cleanup folder HTML lama + update backend serve ke React build + `npm run build`

Selama Fase 5 belum selesai: HTML lama di `frontend/public/static/` tetap dipertahankan dan bisa diakses via port 8000.

## Struktur Web Revisi 1.3

Halaman React yang sudah ada (semua di `frontend/src/pages/`):

| Route | Page | Keterangan |
|-------|------|-----------|
| `/login` | `LoginPage.jsx` | Login + inline forgot password 2-step |
| `/register` | `RegisterPage.jsx` | Daftar akun baru |
| `/reset-password` | `ResetPasswordPage.jsx` | Flow lupa password (OTP 2 tahap) |
| `/dashboard` | `DashboardPage.jsx` | Peta kebun (Leaflet) + card kebun + search + hapus |
| `/farms` | `FarmsPage.jsx` | Daftar kebun tanpa peta |
| `/farms/add` | `AddFarmPage.jsx` | Form tambah kebun baru |
| `/farms/:id` | `FarmDetailPage.jsx` | Info kebun + status + node table |
| `/farms/:id/monitoring` | `MonitoringPage.jsx` | Grafik sensor (Chart.js) + tabel reading |
| `/farms/:id/irrigation` | `IrrigationPage.jsx` | Status valve + tabel logika + panel keputusan |
| `/farms/:id/weather` | `WeatherPage.jsx` | Prakiraan cuaca BMKG + impact card |
| `/farms/:id/gateway` | `GatewayPage.jsx` | Status gateway |
| `/farms/:id/nodes` | `NodesPage.jsx` | Tabel node sensor |
| `/farms/:id/logs` | `LogsPage.jsx` | Riwayat irigasi, filter + export CSV |
| `/settings` | `SettingsPage.jsx` | Profil akun, edit nomor HP, ganti sandi, logout |
| `/change-password` | `ChangePasswordPage.jsx` | Ganti password (sudah login) |

Sidebar utama (context-aware — otomatis ganti isi saat di farm context):

```text
[Selector mode]       [Farm context mode]
Dashboard             ← (FarmSwitcher pill di Topbar)
Kebun Saya            Monitoring
Settings              Irigasi
                      Gateway
                      Node Sensor
                      Cuaca
                      Riwayat
```

Jangan mengubah struktur sidebar kecuali user meminta eksplisit.

## Komponen React

Semua di `frontend/src/components/`:

- `Sidebar.jsx` — context-aware: selector vs farm-context nav
- `Topbar.jsx` — render `<FarmSwitcher />` di kiri saat farm context
- `FarmSwitcher.jsx` — pill nama kebun aktif + link kembali ke `/dashboard`
- `FarmCard.jsx` — card kebun dengan tombol Lihat Detail + hapus
- `FarmMap.jsx` — Leaflet wrapper (fix `invalidateSize` via ResizeObserver)
- `ConfirmDialog.jsx` — modal konfirmasi hapus kebun
- `CropDropdown.jsx` — searchable dropdown dari `/api/crops`, tampil threshold VWC
- `LocationDetector.jsx` — geolocation + auto-resolve ADM4 dari koordinat
- `RequireAuth.jsx` / `RedirectIfAuth.jsx` — route guard
- `PasswordToggle.jsx` — input password + ikon mata
- `Clock.jsx`, `ThemeSwitcher.jsx`, `UserPill.jsx`

Helper dan hooks:

- `src/utils/farmHelpers.js` — timeAgo, badge mappers, getSoilStatusFromMoisture, dll
- `src/hooks/useFarmContext.js` — detect `/farms/:id/*` dari URL
- `src/hooks/useBodyClass.js`
- `src/context/AuthContext.jsx`
- `src/services/api.js` — semua API call (auth, farms, nodes, readings, weather, logs, crops)
- `src/services/farms.js` — selected farm di localStorage

## Dashboard Utama

Dashboard Utama adalah halaman pertama setelah login. Tujuannya adalah memberi ringkasan cepat seluruh kebun milik user, **bukan** menampilkan data detail. Implementasi ada di `DashboardPage.jsx` + `FarmCard.jsx` + `FarmMap.jsx`.

Peta Kebun Interaktif (`FarmMap.jsx`) wajib dipertahankan di Dashboard Utama. Fix `invalidateSize` via ResizeObserver + requestAnimationFrame **jangan dihapus** — Leaflet tidak otomatis resize di dalam container flex.

## Detail Kebun

Detail Kebun harus dibatasi data hanya untuk kebun yang sedang dipilih (`useParams().id`). Implementasi ada di `FarmDetailPage.jsx` dan semua sub-page `/farms/:id/*`.

## Logika Irigasi

- Valve dibuka jika kelembapan tanah di bawah threshold dan tidak ada prediksi hujan
- Valve ditutup jika kelembapan tanah sudah cukup
- Irigasi ditunda jika BMKG memprediksi hujan
- Sistem menunggu data sensor terbaru jika gateway offline

RSSI tidak disimpan di backend — selalu tampilkan `—` di tabel node.

## Akses User

Setiap user hanya boleh melihat kebun yang terhubung dengan akun miliknya. Jangan membuat fitur yang menampilkan semua kebun lintas user kecuali sedang membuat mode admin pusat.

Model akses:

```text
User -> Farm -> Gateway -> Node -> Sensor Data -> Irrigation Log -> Dashboard
```

Jangan pernah pakai `user_id` di query params endpoint farm — sumber kebenaran user harus dari JWT backend.

## Alur Data Sistem

```text
Node sensor membaca data
-> Node mengirim data ke gateway melalui LoRa
-> Gateway mengirim data ke server melalui internet
-> Backend menerima dan menyimpan data
-> Backend mengecek threshold kelembapan tanah
-> Backend mengecek prakiraan cuaca BMKG
-> Backend menentukan keputusan irigasi
-> Dashboard menampilkan status terbaru ke user
```

## Backend Endpoints

### Auth

| Endpoint | Method | Auth | Keterangan |
|----------|--------|------|-----------|
| `/api/auth/register` | POST | — | Daftar akun baru |
| `/api/auth/login` | POST | — | Login, return JWT |
| `/api/auth/forgot-password` | POST | — | Kirim OTP ke email |
| `/api/auth/verify-reset-code` | POST | — | Verifikasi OTP 6 digit |
| `/api/auth/reset-password` | POST | OTP | Ganti password (flow lupa password) |
| `/api/auth/change-password` | POST | JWT | Ganti password (sudah login) |
| `/api/auth/profile` | PATCH | JWT | Update phone number |

### Farms

| Endpoint | Method | Keterangan |
|----------|--------|-----------|
| `/api/farms` | GET | List kebun milik user (dari JWT) |
| `/api/farms/{farm_id}` | GET | Detail kebun |
| `/api/farms` | POST | Buat kebun baru; auto-resolve `bmkg_adm4_code` dari koordinat |
| `/api/farms/{farm_id}` | DELETE | Hapus kebun (verifikasi kepemilikan) |

### Utils

| Endpoint | Keterangan |
|----------|-----------|
| `GET /api/crops` | List 30 jenis tanaman + threshold VWC, bisa filter `?q=` |
| `GET /api/utils/resolve-adm4?lat=X&lon=Y` | Resolve kode BMKG adm4 dari koordinat GPS via Nominatim OSM |

### Data

| Endpoint | Keterangan |
|----------|-----------|
| `GET /api/farms/{id}/summary` | Summary kebun (gateway, nodes, soil avg, valve, threshold, decision) |
| `GET /api/nodes` | List node (filter `?farm_id=`) |
| `GET /api/nodes/{id}/readings` | Pembacaan sensor node (limit param) |
| `GET /api/weather/{adm4_code}` | Prakiraan cuaca BMKG (cache 30 menit) |
| `GET /api/logs` | Decision logs (filter client-side per farm) |

## Database Schema (SQLite)

```text
users           — id, email, name, password_hash, phone, created_at, updated_at
farms           — id, user_id, name, owner, location, crop_type, area_ha, bmkg_adm4_code, latitude, longitude, status
nodes           — id, farm_id, name, location, region, latitude, longitude, status, battery, updated_at
readings        — id, node_id, soil_moisture, soil_temp, air_temp, air_humidity, created_at
decision_logs   — id, node_id, soil_moisture, weather, decision, valve_state, reason, created_at
weather_cache   — adm4 (PK), data (JSON), updated_at; TTL 30 menit
password_resets — id, user_id, token (6-digit OTP), expires_at, used, created_at
```

Kolom `phone` di `users` ditambahkan via `ensure_column` (migration otomatis saat startup).

## Aturan UI

- Token warna ada di `frontend/public/static/css/premium.css` (dark mode) dan `style.css` (light mode); pakai CSS variables (`--color-bg`, `--color-primary`, `--text-main`, dsb) — jangan hardcode hex
- Mendukung dark mode dan light mode lewat `data-theme` di `<html>`; pastikan style baru jalan di kedua mode
- Gunakan badge status dengan warna konsisten: green/yellow/red
- Progress bar selalu sertakan label range `0%` dan `100%`
- Hindari inline style; gunakan CSS class
- Fix layout React: `<style>#root { display: contents; }</style>` di `frontend/index.html` WAJIB dipertahankan (tanpa ini flex layout pecah karena React mount wrapper)
- Jangan membuat landing page marketing; dashboard adalah pengalaman utama
- Card kebun harus menjadi jalur alternatif selain map untuk masuk ke Detail Kebun
- Logo proyek di `frontend/public/static/img/logo.svg` — dipakai sebagai favicon, sidebar brand, dan marker peta

## Catatan Implementasi

- **Edit React app:** gunakan `frontend/src/` — ini UI aktif
- **Jangan hapus** `frontend/public/static/` sampai Fase 5 (cleanup + build) dilakukan
- Jika mengubah atau menambah API, cek `backend/app/main.py`, `backend/app/schemas.py`, dan `backend/app/database.py`
- Jangan pakai `user_id` di query params endpoint farm — sumber kebenaran dari JWT
- Pertahankan naming convention yang sudah ada
- Jangan melakukan refactor besar tanpa alasan langsung dari kebutuhan user
- Known issue: Vite dev server (`npm run dev`) bisa mati sendiri tanpa warning jelas. Jika semua API call gagal tapi backend sehat, restart Vite.

## Dua Flow Ganti Password (PENTING — Jangan Campur)

Ada dua flow ganti password yang berbeda dan tidak boleh dicampur:

| Flow | Halaman | Endpoint | Auth | Kapan dipakai |
|------|---------|----------|------|---------------|
| Lupa Password | `/reset-password` | `POST /api/auth/reset-password` | OTP 6 digit | User belum login, lupa password |
| Ganti Password | `/change-password` | `POST /api/auth/change-password` | JWT Bearer token | User sudah login, ingin ganti password dari Settings |

- Tombol "Ganti Sandi" di `SettingsPage.jsx` **harus** menuju `/change-password` — tanpa OTP
- `/reset-password` tetap untuk flow lupa password (dari `LoginPage.jsx`) — wajib OTP 2 tahap
- Jangan mengarahkan user yang sudah login ke `/reset-password` untuk ganti password

## Pending / Belum Selesai

1. **Fase 5 migrasi React** — cleanup `frontend/public/static/` + update backend serve ke `frontend/dist/` + `npm run build` end-to-end test
2. **`PATCH /api/farms/{farm_id}`** — endpoint update data kebun belum ada (hanya create + delete)
3. **`GET /api/auth/me`** — fetch profil lengkap user dari backend belum ada; `SettingsPage.jsx` masih baca dari localStorage
4. **Rate limit** — brute-force protection belum ada untuk endpoint auth sensitif
5. **Nominatim resolve adm4** — belum diuji apakah tag `ref:BPS` tersedia di semua wilayah Indonesia di OSM
