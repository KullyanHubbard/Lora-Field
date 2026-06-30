# CODEX.md

Panduan kerja untuk Codex saat membantu pengembangan LoraField.

## Tujuan proyek

LoraField adalah web dashboard monitoring pertanian presisi berbasis LoRa. User login dengan akun pribadi, melihat ringkasan semua kebun miliknya di Dashboard Utama, lalu memilih salah satu kebun dari Peta Kebun Interaktif atau card kebun untuk masuk ke Detail Kebun.

## Sumber kebenaran

- `CLAUDE.md` → sumber utama arsitektur, endpoint, aturan UI, dan status backend/frontend
- `frontend/docs/Panduan-Rebuild-Frontend-LoraField.md` → sumber utama langkah rebuild frontend
- `frontend/src/types/index.ts` → shape type frontend

## Konteks repo

- `frontend/` → satu-satunya frontend aktif: React 19 + Vite + TypeScript strict + Tailwind v4 + shadcn/ui
- `backend/` → FastAPI + SQLite, serve `frontend/dist/` di `/` dengan SPA fallback
- Root repo → dokumentasi dan metadata proyek

## Stack frontend

- Vite + React 19 + TypeScript strict
- Tailwind v4 (`@tailwindcss/vite`) + shadcn/ui
- TanStack Query untuk server state
- react-router-dom v7
- Recharts via shadcn Chart
- react-leaflet untuk peta
- ESLint + Prettier

## Konvensi wajib

- Functional components + hooks
- Akses token localStorage hanya lewat `frontend/src/lib/token.ts`
- Data fetching hanya lewat TanStack Query hooks di `frontend/src/features/*/queries.ts`
- Import pakai alias `@/`
- Styling pakai Tailwind utility + CSS variable shadcn; hindari hardcode warna di JS
- Jangan invent endpoint/field/shape response
- Data dummy/mock harus jelas ditandai mock

## Status arsitektur

- Rebuild frontend selesai; frontend lama sudah digantikan
- Folder rebuild sudah di-rename ke `frontend/`
- Backend men-serve `frontend/dist/` di `/` dan asset di `/assets`
- Dev server: `cd frontend && npm run dev` → port 5173, proxy `/api` ke 8000

## Routes utama

| Route | Page | Keterangan |
|-------|------|-----------|
| `/` | `LandingPage.tsx` | Landing marketing publik, tanpa auth guard |
| `/login` | `LoginPage.jsx` | Login + inline forgot password 2-step |
| `/register` | `RegisterPage.jsx` | Daftar akun baru |
| `/reset-password` | `ResetPasswordPage.jsx` | Flow lupa password OTP |
| `/dashboard` | `DashboardPage.jsx` | Peta kebun + card kebun |
| `/farms` | `FarmsPage.jsx` | Daftar kebun tanpa peta |
| `/farms/add` | `AddFarmPage.jsx` | Form tambah kebun baru |
| `/farms/:id` | `FarmDetailPage.jsx` | Detail kebun |
| `/farms/:id/monitoring` | `MonitoringPage.jsx` | Grafik sensor + tabel reading |
| `/farms/:id/irrigation` | `IrrigationPage.jsx` | Status valve + panel keputusan |
| `/farms/:id/weather` | `WeatherPage.jsx` | Prakiraan cuaca BMKG |
| `/farms/:id/gateway` | `GatewayPage.jsx` | Status gateway |
| `/farms/:id/nodes` | `NodesPage.jsx` | Tabel node sensor |
| `/farms/:id/logs` | `LogsPage.jsx` | Riwayat irigasi + export CSV |
| `/settings` | `SettingsPage.jsx` | Profil, edit HP, ganti sandi, logout |
| `/change-password` | `ChangePasswordPage.jsx` | Ganti password saat login |

## Komponen penting

- `Sidebar` → context-aware: selector mode vs farm-context mode
- `Topbar` → render `FarmSwitcher` saat farm context aktif
- `FarmSwitcher` → pill nama kebun aktif
- `FarmMap` → Leaflet wrapper, wajib maintain `invalidateSize` via ResizeObserver + rAF
- `StatusPill` → badge status standar
- `ConfirmDialog`, `CropDropdown`, `LocationDetector`, `PasswordToggle`

## Helpers penting

- `frontend/src/features/farms/farmHelpers.ts` → timeAgo, badge mappers, soil/water helpers
- `frontend/src/lib/status.ts` → tone / badge mapping
- `frontend/src/lib/api.ts` → API service
- `frontend/src/lib/token.ts` → token access only
- `frontend/src/context/AuthContext.tsx` → auth state
- `frontend/src/hooks/useFarmContext.ts` → deteksi farm route

## Backend endpoints

### Auth

| Endpoint | Method | Auth | Keterangan |
|----------|--------|------|-----------|
| `/api/auth/register` | POST | — | Daftar akun baru |
| `/api/auth/login` | POST | — | Login, return JWT |
| `/api/auth/forgot-password` | POST | — | Kirim OTP ke email |
| `/api/auth/reset-password/verify` | POST | — | Verifikasi OTP 6 digit |
| `/api/auth/reset-password` | POST | OTP | Ganti password lupa password |
| `/api/auth/change-password` | POST | JWT | Ganti password saat login |
| `/api/auth/profile` | PATCH | JWT | Update phone |
| `/api/auth/me` | GET | JWT | Fetch profil user |

### Farms

| Endpoint | Method | Keterangan |
|----------|--------|-----------|
| `/api/farms` | GET | List kebun milik user |
| `/api/farms/{farm_id}` | GET | Detail kebun |
| `/api/farms` | POST | Buat kebun baru |
| `/api/farms/{farm_id}` | PATCH | Update kebun partial |
| `/api/farms/{farm_id}` | DELETE | Hapus kebun |
| `/api/farms/{farm_id}/summary` | GET | Summary kebun |
| `/api/farms/{farm_id}/weather` | GET | Prakiraan cuaca BMKG untuk kebun |
| `/api/farms/{farm_id}/gateway-logs` | GET/POST | Log koneksi gateway |

### Data & utils

| Endpoint | Keterangan |
|----------|-----------|
| `/api/nodes?farm_id=X` | List node |
| `/api/nodes/{id}/location` | Update lokasi node |
| `/api/nodes/{id}/readings` | Pembacaan sensor node |
| `/api/weather?adm4=X` | Cuaca BMKG mentah |
| `/api/decision?soil_moisture=X&rain_next_3h=bool` | Simulator keputusan irigasi |
| `/api/logs` | Decision logs user |
| `/api/crops?q=` | Daftar tanaman + threshold VWC |
| `/api/utils/resolve-adm4?lat=X&lon=Y` | Resolve kode BMKG adm4 |

Jangan pakai `user_id` di query params; sumber kebenaran user dari JWT.

## Database schema

```text
users           — id, email, name, password_hash, phone, created_at, updated_at
farms           — id, user_id, name, owner, location, crop_type, area_ha, bmkg_adm4_code, latitude, longitude, status
nodes           — id, farm_id, name, location, region, latitude, longitude, status, battery, updated_at
readings        — id, node_id, soil_moisture, soil_temp, air_temp, air_humidity, created_at
decision_logs   — id, node_id, soil_moisture, weather, decision, valve_state, reason, created_at
gateway_logs    — id, farm_id, event, detail, created_at
weather_cache   — adm4 (PK), data (JSON), updated_at
password_resets — id, user_id, token, expires_at, used, created_at
```

## Product/UI rules

- Label UI bahasa Indonesia
- Istilah teknis dipertahankan: LoRa, VWC, MQTT, Gateway, Node, BMKG, RSSI
- Dashboard utama = ringkasan cepat semua kebun + peta
- Detail kebun hanya untuk kebun terpilih
- Dark mode + light mode wajib jalan
- Badge status konsisten: green/yellow/red
- Progress bar wajib punya label `0%` dan `100%`
- Landing page publik wajib ada di `/`
- Logo/brand: ikon `Sprout` + teks `LoraField`

## Flow penting

### Ganti password

- `/reset-password` → flow lupa password OTP 2 tahap
- `/change-password` → ganti password saat sudah login
- Jangan campur keduanya

### Monitoring

- Dropdown pilih node
- 4 chart: soil moisture, soil temp, air temp, air humidity
- Data dari readings node, bukan mock kecuali mode development

## Monitoring mock data

- File: `frontend/src/features/monitoring/mockReadings.ts`
- Mock harus realistis, variatif, dan ditandai jelas sebagai mock
- Jangan tampilkan mock seolah data backend

## Aturan kerja saat edit

- Baca file terkait dulu
- Ikuti pola lokal yang sudah ada
- Jangan refactor besar tanpa kebutuhan langsung
- Jangan invent API/shape data
- Jangan ubah area lain kalau user minta fokus satu section

## Quality gate

- Jalankan pengecekan type/syntax yang tersedia di repo
- Pastikan UI tidak pecah di dark/light mode
- Pastikan flow auth dan dashboard tetap valid

