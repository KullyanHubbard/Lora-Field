# CODEX.md

Panduan kerja untuk Codex saat membantu pengembangan LoraField.

## Tujuan proyek

LoraField adalah web dashboard monitoring pertanian presisi berbasis LoRa. User login dengan akun pribadi, melihat ringkasan semua kebun miliknya di Dashboard Utama, lalu memilih salah satu kebun dari Peta Kebun Interaktif atau card kebun untuk masuk ke Detail Kebun.

## Sumber kebenaran

- `CLAUDE.md` â†’ sumber utama arsitektur, endpoint, aturan UI, dan status backend/frontend
- `frontend/docs/Panduan-Rebuild-Frontend-LoraField.md` â†’ sumber utama langkah rebuild frontend
- `frontend/src/types/index.ts` â†’ shape type frontend

## Konteks repo

- `frontend/` â†’ satu-satunya frontend aktif: React 19 + Vite + TypeScript strict + Tailwind v4 + shadcn/ui
- `backend/` â†’ FastAPI + SQLite, serve `frontend/dist/` di `/` dengan SPA fallback
- Root repo â†’ dokumentasi dan metadata proyek

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
- Dev server: `cd frontend && npm run dev` â†’ port 5173, proxy `/api` ke 8000

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

- `Sidebar` â†’ context-aware: selector mode vs farm-context mode
- `Topbar` â†’ render `FarmSwitcher` saat farm context aktif
- `FarmSwitcher` â†’ pill nama kebun aktif
- `FarmMap` â†’ Leaflet wrapper, wajib maintain `invalidateSize` via ResizeObserver + rAF
- `StatusPill` â†’ badge status standar
- `ConfirmDialog`, `CropDropdown`, `LocationDetector`, `PasswordToggle`

## Helpers penting

- `frontend/src/features/farms/farmHelpers.ts` â†’ timeAgo, badge mappers, soil/water helpers
- `frontend/src/lib/status.ts` â†’ tone / badge mapping
- `frontend/src/lib/api.ts` â†’ API service
- `frontend/src/lib/token.ts` â†’ token access only
- `frontend/src/context/AuthContext.tsx` â†’ auth state
- `frontend/src/hooks/useFarmContext.ts` â†’ deteksi farm route

## Backend endpoints

### Auth

| Endpoint | Method | Auth | Keterangan |
|----------|--------|------|-----------|
| `/api/auth/register` | POST | â€” | Daftar akun baru |
| `/api/auth/login` | POST | â€” | Login, return JWT |
| `/api/auth/forgot-password` | POST | â€” | Kirim OTP ke email |
| `/api/auth/reset-password/verify` | POST | â€” | Verifikasi OTP 6 digit |
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
users           â€” id, email, name, password_hash, phone, created_at, updated_at
farms           â€” id, user_id, name, owner, location, crop_type, area_ha, bmkg_adm4_code, latitude, longitude, status
nodes           â€” id, farm_id, name, location, region, latitude, longitude, status, battery, updated_at
readings        â€” id, node_id, soil_moisture, soil_temp, air_temp, air_humidity, created_at
decision_logs   â€” id, node_id, soil_moisture, weather, decision, valve_state, reason, created_at
gateway_logs    â€” id, farm_id, event, detail, created_at
weather_cache   â€” adm4 (PK), data (JSON), updated_at
password_resets â€” id, user_id, token, expires_at, used, created_at
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

### Pondasi Layout Ringkasan Kebun

- Section `Ringkasan Kebun` adalah layout final, utama, dan baseline resmi untuk Detail Kebun.
- Perubahan struktur, ukuran, posisi, spacing, tinggi card, susunan kolom, atau komposisi visual wajib mendapat persetujuan eksplisit dari pemilik proyek.
- Tanpa persetujuan, layout ini harus dipertahankan apa adanya.

Prinsip dasar:

- Layout memakai 3 kolom utama untuk ringkasan cepat kondisi kebun.
- Section ini bukan monitoring lengkap.
- Layout harus terasa penuh, sejajar, seimbang, bersih, tidak kosong di bawah, tidak terlalu padat, tidak terlalu renggang, dan aman di light mode serta dark mode.

Struktur 3 kolom:

```text
Kolom 1        Kolom 2        Kolom 3
Status utama   Node & cuaca   Metrik sensor
```

- Jangan ubah menjadi 2 kolom, 4 kolom, carousel, tab, accordion, atau layout lain tanpa persetujuan eksplisit.

Kolom 1:

- Isi utama: Status Valve, Gateway, Log Aktivitas, Prediksi Cuaca.
- Kolom 1 adalah area status sistem.
- Ukuran card, urutan elemen, dan posisi card tidak boleh diubah tanpa persetujuan.
- Jangan pindahkan Status Valve, Gateway, atau Log Aktivitas ke kolom lain tanpa persetujuan.

Kolom 2:

- Isi utama: Node Sensor, Baterai Node, Prediksi Cuaca.
- Kolom 2 mendukung informasi teknis kebun.
- Prediksi Cuaca boleh menyambung visual dari kolom 1 ke kolom 2.
- Ukuran card dan posisi Node Sensor/Baterai Node tidak boleh diubah tanpa persetujuan.

Prediksi Cuaca:

- Boleh memakai area horizontal yang lebih lebar.
- Tetap harus menyatu dengan layout Ringkasan Kebun.
- Jangan pindahkan sepenuhnya ke kolom 3.
- Jangan merusak tinggi atau alignment kolom lain.
- Jangan ganti area cuaca menjadi layout baru tanpa persetujuan.

Kolom 3:

- Isi wajib 4 card: Kelembapan Tanah, Suhu Tanah, Suhu Udara, Kelembapan Udara.
- Kolom 3 adalah area metrik cepat dan harus terlihat penuh secara vertikal sejajar dengan kolom 1 dan 2.
- Jika perlu penyesuaian layout, prioritaskan hanya kolom 3.
- Jangan kurangi jumlah card.
- Jangan ganti 4 card menjadi tabel, chart, carousel, atau bentuk lain tanpa persetujuan.

Alignment dan spacing:

- Semua card harus sejajar secara visual.
- Batas bawah kolom 3 harus sejajar secara visual dengan bawah kolom 1 dan 2.
- Gap antar-card harus konsisten.
- Gunakan `grid`, `flex`, `min-height`, `height`, `align-items`, `grid-template-rows`, dan `gap` seperlunya.
- Jangan membuat spacing terlalu besar atau terlalu sempit.
- Jangan menambahkan margin manual yang tidak perlu.

Responsiveness:

- Pada layar besar, tetap 3 kolom.
- Pada layar sedang, layout boleh menyesuaikan selama tetap rapi dan tidak bertumpuk.
- Pada layar kecil/mobile, card boleh stack vertikal.
- Tidak boleh ada overflow horizontal atau card terpotong.

Dark mode dan light mode:

- Gunakan CSS variable atau token tema yang sudah ada.
- Jangan hardcode warna hex baru.
- Pastikan border, background, teks, badge, dan icon tetap terbaca di dua mode.

Larangan keras:

- Jangan ubah struktur 3 kolom.
- Jangan ubah ukuran kolom 1 atau kolom 2.
- Jangan memindahkan card antar kolom.
- Jangan menghapus 4 card metrik kolom 3.
- Jangan mengubah section lain, sidebar, topbar, routing, API, backend, package.json, package-lock.json, atau `frontend/public/static/`.
- Jangan refactor besar, menambah dependency baru, menambahkan inline style, atau meninggalkan komentar eksperimen.

Validasi sebelum selesai:

- Kolom 1 tetap seperti baseline.
- Kolom 2 tetap seperti baseline.
- Kolom 3 tetap berisi 4 card metrik.
- Tidak ada ruang kosong aneh di bawah kolom 3.
- Prediksi Cuaca tetap menyambung rapi.
- Light mode aman.
- Dark mode aman.
- Responsive aman.
- Tidak ada section lain berubah.
- Tidak ada file tidak relevan ikut berubah.

## Flow penting

### Ganti password

- `/reset-password` â†’ flow lupa password OTP 2 tahap
- `/change-password` â†’ ganti password saat sudah login
- Jangan campur keduanya

### Monitoring

- Dropdown pilih node
- 4 chart: soil moisture, soil temp, air temp, air humidity
- Data dari readings node, bukan mock kecuali mode development

## Monitoring mock data

- File: `frontend/src/lib/mockReadings.ts`
- Mock harus realistis, variatif, dan ditandai jelas sebagai mock
- Semua file mock frontend harus berada di satu folder terpusat `frontend/src/lib/`
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

