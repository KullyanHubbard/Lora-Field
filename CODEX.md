# CODEX.md

Panduan kerja untuk Codex saat membantu pengembangan LoraField.

## Tujuan Proyek

LoraField adalah dashboard web untuk monitoring kebun berbasis LoRa. User login dengan akun pribadi, melihat ringkasan semua kebun miliknya di Dashboard Utama, lalu memilih salah satu kebun dari Peta Kebun Interaktif atau card kebun untuk masuk ke Detail Kebun.

Revisi aktif: struktur web dashboard LoraField revisi 1.3 dengan fitur map pemilihan kebun.

## Konteks Repo

- `frontend/src/` — **React/Vite, UI aktif yang dikembangkan**
- `frontend/public/static/` — HTML/CSS/JS vanilla lama, masih ada, jangan dihapus sampai Fase 5
- `backend/` — backend FastAPI + SQLite
- Root repo hanya untuk dokumentasi dan metadata proyek

Jika membuat perubahan, baca file terkait terlebih dahulu dan ikuti pola lokal yang sudah ada.

## Stack Teknis

- **Frontend:** Vite 5.4 + React 18.3 + React Router 7.15
- **Peta:** Leaflet 1.9.4
- **Grafik:** Chart.js 4.4.1 + react-chartjs-2 5.2.0
- **Backend:** FastAPI + SQLite
- **Auth:** JWT Bearer token (`lf_access_token` di localStorage)
- **Dev:** `npm run dev` → port 5173 (proxy `/api` → port 8000)
- **CSS:** file lama dari `frontend/public/static/css/` di-serve otomatis via Vite `public/` folder

## Status Migrasi React

Per 2026-05-26, semua halaman utama sudah diport ke React (Fase 1–4b selesai). SPA bisa dijalankan via port 5173. HTML lama tetap ada di `frontend/public/static/` sampai Fase 5 selesai.

**Fase 5 (BELUM):**
- Cleanup `frontend/public/static/`
- Update backend serve ke `frontend/dist/`
- `npm run build` end-to-end test

## Routes React (`src/App.jsx`)

Semua di-lazy-load dengan `React.lazy`:

| Route | Page | Keterangan |
|-------|------|-----------|
| `/login` | `LoginPage.jsx` | Login + inline forgot password 2-step |
| `/register` | `RegisterPage.jsx` | Daftar akun baru |
| `/reset-password` | `ResetPasswordPage.jsx` | Flow lupa password (OTP 2 tahap) |
| `/dashboard` | `DashboardPage.jsx` | Peta Leaflet + card kebun + search + hapus |
| `/farms` | `FarmsPage.jsx` | Daftar kebun tanpa peta |
| `/farms/add` | `AddFarmPage.jsx` | Form tambah kebun baru |
| `/farms/:id` | `FarmDetailPage.jsx` | Info + status + node table |
| `/farms/:id/monitoring` | `MonitoringPage.jsx` | Grafik Chart.js + tabel reading |
| `/farms/:id/irrigation` | `IrrigationPage.jsx` | Status valve + logika + keputusan |
| `/farms/:id/weather` | `WeatherPage.jsx` | BMKG forecast + impact card |
| `/farms/:id/gateway` | `GatewayPage.jsx` | Status gateway |
| `/farms/:id/nodes` | `NodesPage.jsx` | Tabel node sensor |
| `/farms/:id/logs` | `LogsPage.jsx` | Riwayat irigasi + filter + export CSV |
| `/settings` | `SettingsPage.jsx` | Profil, edit HP, ganti sandi, logout |
| `/change-password` | `ChangePasswordPage.jsx` | Ganti password (sudah login) |

Route tidak dikenal: redirect ke `/dashboard`.

## Komponen dan Helpers

**Komponen (`src/components/`):**

- `Sidebar.jsx` — context-aware: selector mode vs farm-context mode (otomatis switch)
- `Topbar.jsx` — render `<FarmSwitcher />` saat farm context aktif
- `FarmSwitcher.jsx` — pill nama kebun, fetch via `/api/farms/{id}`, link ke `/dashboard`
- `FarmCard.jsx` — card kebun + tombol Lihat Detail + hapus (confirm dialog)
- `FarmMap.jsx` — Leaflet wrapper; `invalidateSize` via ResizeObserver + rAF (wajib dipertahankan)
- `ConfirmDialog.jsx` — modal konfirmasi hapus
- `CropDropdown.jsx` — searchable dropdown dari `/api/crops`, tampil threshold VWC
- `LocationDetector.jsx` — geolocation + auto-resolve ADM4 dari koordinat
- `RequireAuth.jsx` / `RedirectIfAuth.jsx` — route guard
- `PasswordToggle.jsx` — input password + ikon mata
- `Clock.jsx`, `ThemeSwitcher.jsx`, `UserPill.jsx`

**Helpers (`src/`):**

- `utils/farmHelpers.js` — timeAgo, badge mappers, getSoilStatusFromMoisture, getWeatherInfo, formatAreaHa, valveLabelFromDecision, getFarmLastUpdate
- `hooks/useFarmContext.js` — deteksi `/farms/:id/*` dari URL (exclude `add`/`new`)
- `hooks/useBodyClass.js`
- `context/AuthContext.jsx`
- `services/api.js` — semua API call: auth, farms, nodes, readings, weather, logs, crops
- `services/farms.js` — selected farm di localStorage

**Layout (`src/layout/`):**

- `AuthPageLayout.jsx` — wrapper halaman auth (login, register, reset)
- `DashboardLayout.jsx` — wrapper halaman dashboard (sidebar + topbar + main)

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
| `/api/auth/profile` | PATCH | JWT | Update phone, return `{user: {id, email, name, phone}}` |

### Farms

| Endpoint | Method | Keterangan |
|----------|--------|-----------|
| `/api/farms` | GET | List kebun milik user (dari JWT) |
| `/api/farms/{id}` | GET | Detail kebun |
| `/api/farms` | POST | Buat kebun; auto-resolve `bmkg_adm4_code` dari koordinat via Nominatim |
| `/api/farms/{id}` | DELETE | Hapus kebun (verifikasi kepemilikan) |
| `/api/farms/{id}/summary` | GET | Summary: gateway, nodes, soil avg, valve, threshold, decision |

### Data & Utils

| Endpoint | Keterangan |
|----------|-----------|
| `GET /api/nodes?farm_id=X` | List node per kebun |
| `GET /api/nodes/{id}/readings?limit=N` | Pembacaan sensor node |
| `GET /api/weather/{adm4_code}` | Prakiraan cuaca BMKG (cache 30 menit) |
| `GET /api/logs` | Decision logs (filter client-side per farm) |
| `GET /api/crops?q=` | 30 jenis tanaman + threshold VWC lower/upper |
| `GET /api/utils/resolve-adm4?lat=X&lon=Y` | Resolve kode BMKG adm4 dari GPS via Nominatim OSM |

**Jangan pakai `user_id` di query params** — sumber kebenaran user selalu dari JWT.

## Database Schema (SQLite) — `backend/data/lorafield.db`

```text
users           — id, email, name, password_hash, phone (DEFAULT ''), created_at, updated_at
farms           — id, user_id, name, owner, location, crop_type, area_ha, bmkg_adm4_code, latitude, longitude, status
nodes           — id, farm_id, name, location, region, latitude, longitude, status, battery, updated_at
readings        — id, node_id, soil_moisture, soil_temp, air_temp, air_humidity, created_at
decision_logs   — id, node_id, soil_moisture, weather, decision, valve_state, reason, created_at
weather_cache   — adm4 (PK), data (JSON), updated_at; TTL 30 menit
password_resets — id, user_id, token (6-digit OTP), expires_at, used, created_at
```

Kolom `phone` ditambahkan via `ensure_column` (migration otomatis startup). Kolom `suhu_tanah` tidak ada di `decision_logs`.

## Dua Flow Ganti Password (JANGAN DICAMPUR)

| Flow | Route | Endpoint | Auth | Kapan |
|------|-------|----------|------|-------|
| Lupa Password | `/reset-password` | `POST /api/auth/reset-password` | OTP 6 digit | User belum login |
| Ganti Password | `/change-password` | `POST /api/auth/change-password` | JWT Bearer | User sudah login, dari Settings |

- Tombol "Ganti Sandi" di `SettingsPage.jsx` → `/change-password` (tanpa OTP)
- `LoginPage.jsx` forgot password → `/reset-password` → OTP 2 tahap wajib

## Sidebar Context-Aware

`Sidebar.jsx` otomatis ganti isi berdasarkan `useFarmContext()`:

- **Selector mode** (di `/dashboard`, `/farms`, `/settings`): Dashboard, Kebun Saya, Settings
- **Farm context mode** (di `/farms/:id/*`): Monitoring, Irigasi, Gateway, Node Sensor, Cuaca, Riwayat

`FarmSwitcher` di `Topbar.jsx` menampilkan nama kebun aktif + link kembali ke `/dashboard`.

## Fitur AddFarmPage

- Nama Kebun opsional — auto-fill "Kebun N" (N = jumlah kebun + 1)
- Pemilik Kebun — pre-fill dari user login
- Jenis Tanaman — `CropDropdown` (searchable, tampil threshold VWC saat dipilih)
- Koordinat — input manual lat/lng + tombol "Deteksi Lokasi Sekarang" (GPS `enableHighAccuracy`, tolak jika akurasi > 100m)
- `bmkg_adm4_code` tidak di form — backend auto-resolve dari koordinat
- Submit pertama dengan field penting kosong → warning kuning, tombol jadi "Tetap Simpan"
- Submit kedua → lanjut meski belum lengkap
- Berhasil → navigate ke `/dashboard`

## Fitur SettingsPage

- Tampil: Nama, Email, Nomor HP
- Nomor HP — editable inline (ikon pensil → input → Simpan/Batal)
- Simpan → `PATCH /api/auth/profile` → update DB + localStorage
- Tombol Ganti Sandi → `/change-password`
- Tombol Keluar → clear localStorage → `/login`

## MonitoringPage

- Dropdown pilih node, refresh manual
- 4 chart Line (Chart.js): soil moisture, soil temp, air temp, air humidity
- Readings dari `listNodeReadings(nodeId, 20)`: ascending untuk chart, descending top-10 untuk tabel
- Data utama dari `getFarmSummary`

## LogsPage

- Filter bar 5 button: semua / buka valve / tutup valve / tunda / sensor offline
- Search input, export CSV
- Tabel 9 kolom (kolom Suhu Tanah tidak ada — backend tidak simpan di decision_logs)
- Backend `/api/logs` lintas-farm → filter client-side berdasarkan `node_id ∈ farm node set`

## WeatherPage

- Impact card di atas: 3 state (no-data / rain / ok)
- Info card 6 kolom
- Weather main card
- Forecast grid 3-col (max 8 item BMKG)
- Class `.weather-impact.deny/.allow` langsung tanpa wrapper `.card` (hindari double frame)

## Aturan UI

- Pakai CSS variables (`--color-bg`, `--color-primary`, dll) — jangan hardcode hex
- Dark mode + light mode via `data-theme` di `<html>`
- Badge status: hijau = normal/online, kuning = peringatan, merah = offline/error
- Hindari inline style; gunakan CSS class
- Fix layout React: `<style>#root { display: contents; }</style>` di `frontend/index.html` WAJIB dipertahankan
- Dashboard operasional: padat, rapi, mudah discan

## Aturan Wajib Saat Mengubah Kode

- Baca file terkait sebelum mengubah — jangan asumsi atau invent API/komponen yang tidak ada
- Jangan ubah CSS lama (`frontend/public/static/css/`) kecuali perlu sinkronisasi
- Jangan hapus HTML lama sampai Fase 5
- Pakai pola yang sudah ada: `DashboardLayout` wrapper, `useParams` untuk `:id`, `getFarmSummary`, helper dari `farmHelpers.js`
- Jangan campur dua flow ganti password
- Jangan pakai `user_id` di query params endpoint farm

## Quality Gate Sebelum Menutup Task

1. **Backend smoke:** import app sukses, semua route auth tersedia
2. **Frontend syntax:** tidak ada error TypeScript/JSX saat `npm run dev`
3. **Auth flow:** register → login → `/dashboard` valid; forgot → OTP → ganti → login ulang
4. **Layout check:** halaman tidak pecah di dark mode + light mode

## Known Issues

- Vite dev server bisa mati sendiri tanpa warning jelas. Gejala: semua `/api/*` gagal tapi backend sehat. Fix: restart `npm run dev`. Root cause belum diinvestigasi.
- RSSI tidak disimpan di backend — tampilkan `—` di semua tabel node.
- `GET /api/auth/me` belum ada — `SettingsPage.jsx` baca profil dari localStorage.
- `PATCH /api/farms/{id}` belum ada — hanya create + delete.

## Pending / Belum Selesai

1. Fase 5 migrasi React: cleanup HTML lama + build + update backend serve
2. `PATCH /api/farms/{farm_id}` — endpoint update data kebun
3. `GET /api/auth/me` — fetch profil lengkap dari backend
4. Rate limit / brute-force protection untuk endpoint auth sensitif
5. Nominatim resolve adm4 — belum diuji untuk semua wilayah Indonesia (tag `ref:BPS`)

## Referensi File

- React entry: `frontend/src/main.jsx`
- Routes: `frontend/src/App.jsx`
- API service: `frontend/src/services/api.js`
- Farm helpers: `frontend/src/utils/farmHelpers.js`
- Backend API: `backend/app/main.py`
- Backend schema: `backend/app/schemas.py`
- CSS tokens: `frontend/public/static/css/premium.css` (dark) + `style.css` (light)
- Logo: `frontend/public/static/img/logo.svg`
