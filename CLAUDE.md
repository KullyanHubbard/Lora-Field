# CLAUDE.md — LoraField

Panduan kerja Claude untuk rebuild frontend LoraField.

## Ringkasan Proyek

LoraField adalah web dashboard monitoring pertanian presisi berbasis LoRa. User memantau satu atau beberapa kebun miliknya: data node sensor, status gateway, status valve, keputusan irigasi, prakiraan cuaca BMKG, grafik historis, dan riwayat sistem.

Alur utama:

```text
User buka Web LoraField
-> Login (atau Daftar Akun jika belum punya)
-> Sistem verifikasi akun
-> Dashboard Utama: ringkasan semua kebun + Peta Kebun Interaktif
-> User pilih kebun (marker map atau card kebun)
-> Detail Kebun: monitoring lengkap kebun terpilih
```

## Konteks Rebuild & Struktur Repo

Ini proyek rebuild frontend dengan pendekatan strangler migration. Frontend React lama yang berantakan (CSS monolit, fetch manual duplikatif, tanpa TypeScript) sudah digantikan sepenuhnya. Promote selesai (2026-06-21): folder rebuild di-rename menjadi `frontend/` (menggantikan frontend React lama yang dihapus) — `frontend/` kini satu-satunya frontend.

- **Frontend tunggal: `frontend/`** — semua perintah npm/npx dijalankan di sini. `npm run build` menghasilkan `frontend/dist/`.
- **Backend (tidak diubah dalam rebuild ini): `backend/`** — FastAPI + SQLite. Backend men-serve `frontend/dist/` di `/` (SPA fallback + asset di `/assets`). Contract-nya ada di section "Backend Endpoints" + "Database Schema" di bawah; itu sumber kebenaran.
- **Sumber kebenaran tunggal untuk langkah rebuild:** `frontend/docs/Panduan-Rebuild-Frontend-LoraField.md`. Tiap fase ikuti bagian relevan; jangan menambah teknologi, library, atau langkah di luar panduan.

Label UI: Bahasa Indonesia. Istilah teknis dipertahankan: LoRa, VWC, MQTT, Gateway, Node, BMKG, RSSI.

Dev server: `cd frontend && npm run dev` (port 5173, proxy `/api` ke port 8000). Backend: `uvicorn backend.app.main:app --host 0.0.0.0 --port 8000`.

## Stack

Frontend (`frontend/`) — kunci ke ini, jangan ganti:

- Vite + React 19 + TypeScript strict
- Tailwind v4 (@tailwindcss/vite) + shadcn/ui
- TanStack Query (server state)
- react-router-dom v7 (port struktur routing dari lama)
- Charts: Recharts via shadcn Chart. Map: react-leaflet.
- Prettier + ESLint

Catatan stack lama (sudah dihapus, hanya konteks historis): React 18.3 + Vite 5.4, React Router 7.15, Leaflet 1.9.4, Chart.js 4.4 + react-chartjs-2 5.2. Warna tema teal LoraField kini hidup sebagai CSS variable shadcn di `frontend/src/index.css`, bukan file CSS lama.

## Aturan Anti-Halusinasi (WAJIB)

- API contract = section "Backend Endpoints" + "Database Schema" di CLAUDE.md ini, plus `src/types/index.ts`. JANGAN mengarang endpoint, field, atau shape response.
- Endpoint yang BELUM ADA jangan dipanggil dan jangan diasumsikan ada (lihat section "Endpoint Belum Ada").
- Field yang masih perlu verifikasi shape-nya terhadap response asli: kolom `weather` di decision_logs (kolom ada di schema, tipe perlu cek), struktur summary cuaca termasuk prediksi hujan, serta isi persis response `/summary` dan `/login`. Kalau tidak cocok dengan type, LAPORKAN — jangan diam-diam ubah.
- Data dummy/mock harus ditandai jelas sebagai mock, jangan seolah dari backend.
- Kalau ragu atau butuh keputusan desain: BERHENTI dan tanya.

## Konvensi Kode

- Functional components + hooks. TypeScript di semua file.
- Akses token localStorage HANYA lewat `src/lib/token.ts`. Tidak ada komponen yang baca localStorage token langsung.
- Data fetching HANYA lewat TanStack Query hooks (`src/features/*/queries.ts`). Tidak ada useEffect + fetch manual di komponen.
- Styling: Tailwind utility + CSS variable tema shadcn. DILARANG warna hardcoded di JS (pakai token tema seperti `text-primary`). DILARANG inline style kecuali nilai dinamis yang wajib (mis. tinggi bar dari data).
- Import pakai alias `@/` (bukan `../../`).

## Backend Endpoints

### Auth

| Endpoint | Method | Auth | Keterangan |
|----------|--------|------|-----------|
| `/api/auth/register` | POST | — | Daftar akun baru |
| `/api/auth/login` | POST | — | Login, return JWT |
| `/api/auth/forgot-password` | POST | — | Kirim OTP ke email |
| `/api/auth/reset-password/verify` | POST | — | Verifikasi OTP 6 digit |
| `/api/auth/reset-password` | POST | OTP | Ganti password (flow lupa password) |
| `/api/auth/change-password` | POST | JWT | Ganti password (sudah login) |
| `/api/auth/profile` | PATCH | JWT | Update phone number |
| `/api/auth/me` | GET | JWT | Fetch profil user (return UserPublic). Sumber: main.py:701. |

> Catatan: profil user saat ini diambil dari AuthContext (login response); penggunaan `/api/auth/me` untuk refresh profil ditunda ke fase polish.

### Farms

| Endpoint | Method | Keterangan |
|----------|--------|-----------|
| `/api/farms` | GET | List kebun milik user (dari JWT). Return `{ items, total }` |
| `/api/farms/{farm_id}` | GET | Detail kebun. Return `{ farm }` |
| `/api/farms` | POST | Buat kebun baru; auto-resolve `bmkg_adm4_code` dari koordinat. Return `{ farm }` |
| `/api/farms/{farm_id}` | PATCH | Update kebun (partial, `exclude_unset`); re-resolve `bmkg_adm4_code` kalau koordinat berubah. Return `{ farm }`. Schema body: `FarmUpdate` (main.py:897) |
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
| `GET /api/farms/{id}/weather` | Prakiraan cuaca BMKG untuk kebun (auto-resolve adm4, cache 30 menit). **Ini endpoint cuaca yang dipakai frontend.** main.py:1018 |
| `GET /api/nodes` | List node (filter `?farm_id=`). Return `{ items, total }` |
| `PATCH /api/nodes/{id}/location` | Update lokasi/region/koordinat node. Return `{ node }`. main.py:1124 |
| `GET /api/nodes/{id}/readings` | Pembacaan sensor node (`limit` 1–100, default 20) |
| `POST /api/nodes/{id}/readings` | Insert reading + hitung decision + tulis decision_log. Query wajib `?adm4=`. Return `{ reading, decision }`. main.py:1176 |
| `GET /api/weather?adm4=X` | Cuaca BMKG mentah by adm4 (debug, butuh auth). main.py:1238 |
| `GET /api/decision?soil_moisture=X&rain_next_3h=bool` | Simulator keputusan irigasi (stateless, butuh auth). main.py:1250 |
| `GET /api/logs` | Decision logs milik user (`limit` 1–100, default 20; filter client-side per farm) |
| `GET /api/farms/{id}/gateway-logs` | Log koneksi gateway kebun (`limit` 1–100, default 20). Verifikasi kepemilikan. Return `{ items, total }`. Kosong sampai hardware gateway lapor |
| `POST /api/farms/{id}/gateway-logs` | Insert log koneksi gateway (scaffolding hardware). Body `GatewayLogIn` (`event`, `detail`). Return `{ log }`, status 201 |

## Database Schema (SQLite)

```text
users           — id, email, name, password_hash, phone, created_at, updated_at
farms           — id, user_id, name, owner, location, crop_type, area_ha, bmkg_adm4_code, latitude, longitude, status
nodes           — id, farm_id, name, location, region, latitude, longitude, status, battery, updated_at
readings        — id, node_id, soil_moisture, soil_temp, air_temp, air_humidity, created_at
decision_logs   — id, node_id, soil_moisture, weather, decision, valve_state, reason, created_at
gateway_logs    — id, farm_id, event, detail, created_at; log koneksi gateway (kosong sampai hardware lapor)
weather_cache   — adm4 (PK), data (JSON), updated_at; TTL 30 menit
password_resets — id, user_id, token (6-digit OTP), expires_at, used, created_at
```

Catatan: `password_hash` tidak pernah dikirim ke frontend. Type `User` di frontend = id, email, name, phone, created_at, updated_at. Kolom `phone` ditambahkan via `ensure_column` (migration otomatis saat startup).

## Endpoint Belum Ada (jangan panggil/karang)

- Rate limit brute-force untuk endpoint auth sensitif belum ada.

> Catatan (2026-06-24): `PATCH /api/farms/{farm_id}` SUDAH ADA di backend (main.py:897) — sebelumnya tertulis belum ada. Frontend `src/lib/api.ts` belum memanggilnya; kalau mau pakai fitur edit kebun, tambahkan method-nya dulu sesuai schema `FarmUpdate`.

## Logika Irigasi

- Valve dibuka jika kelembapan tanah di bawah threshold dan tidak ada prediksi hujan.
- Valve ditutup jika kelembapan tanah sudah cukup.
- Irigasi ditunda jika BMKG memprediksi hujan.
- Sistem menunggu data sensor terbaru jika gateway offline.
- RSSI tidak disimpan di backend — selalu tampilkan `—` di tabel node.

## Akses User

- Tiap user hanya melihat kebun miliknya. Jangan buat fitur yang menampilkan kebun lintas-user kecuali mode admin pusat diminta eksplisit.
- Sumber kebenaran user = JWT backend. JANGAN pakai `user_id` di query params endpoint farm.
- Model akses: `User -> Farm -> Gateway -> Node -> Sensor Data -> Irrigation Log -> Dashboard`

## Aturan Produk & UI (untuk build baru)

- Dashboard Utama = ringkasan cepat semua kebun, BUKAN data detail. Peta Kebun Interaktif wajib ada di Dashboard. Card kebun adalah jalur alternatif selain map untuk masuk ke Detail Kebun.
- Detail Kebun dibatasi hanya kebun yang dipilih (`useParams().id`).
- Dukung dark mode dan light mode (di build baru lewat tema shadcn, toggle via class/`data-theme` di `<html>`). Pastikan style jalan di kedua mode.
- Badge status warna konsisten: green/yellow/red.
- Progress bar selalu sertakan label range `0%` dan `100%`.
- Landing page marketing publik ADA di route `/` (lihat tabel Routes). Aturan lama "jangan buat landing page" sudah dicabut user (2026-06-21). Dashboard tetap pengalaman utama bagi user yang sudah login; landing hanya etalase di `/` (publik, tanpa auth guard, untuk semua pengunjung).
- Logo/brand: ikon `Sprout` (lucide-react) + teks "LoraField" — lihat `BrandMark` di `frontend/src/components/layout/AppLayout.tsx` dan landing. Favicon: `frontend/public/favicon.svg`.

### Routes & Pages (target rebuild)

Route dan path dipertahankan sama. File `.jsx` lama = referensi porting.

| Route | Page (referensi lama) | Keterangan |
|-------|------|-----------|
| `/` | `LandingPage.tsx` | Landing marketing PUBLIK, tanpa auth guard. Tombol Login/CTA → `/login`. Dark-only. |
| `/login` | `LoginPage.jsx` | Login + inline forgot password 2-step |
| `/register` | `RegisterPage.jsx` | Daftar akun baru |
| `/reset-password` | `ResetPasswordPage.jsx` | Flow lupa password (OTP 2 tahap) |
| `/dashboard` | `DashboardPage.jsx` | Peta kebun (Leaflet) + card kebun + search + hapus |
| `/farms` | `FarmsPage.jsx` | Daftar kebun tanpa peta |
| `/farms/add` | `AddFarmPage.jsx` | Form tambah kebun baru |
| `/farms/:id` | `FarmDetailPage.jsx` | Info kebun + status + node table |
| `/farms/:id/monitoring` | `MonitoringPage.jsx` | Grafik sensor + tabel reading |
| `/farms/:id/irrigation` | `IrrigationPage.jsx` | Status valve + tabel logika + panel keputusan |
| `/farms/:id/weather` | `WeatherPage.jsx` | Prakiraan cuaca BMKG + impact card |
| `/farms/:id/gateway` | `GatewayPage.jsx` | Status gateway |
| `/farms/:id/nodes` | `NodesPage.jsx` | Tabel node sensor |
| `/farms/:id/logs` | `LogsPage.jsx` | Riwayat irigasi, filter + export CSV |
| `/settings` | `SettingsPage.jsx` | Profil akun, edit nomor HP, ganti sandi, logout |
| `/change-password` | `ChangePasswordPage.jsx` | Ganti password (sudah login) |

### Sidebar (context-aware)

Sidebar otomatis ganti isi saat masuk farm context:

```text
[Selector mode]       [Farm context mode]
Dashboard             (FarmSwitcher pill di Topbar)
Kebun Saya            Monitoring
Settings              Irigasi
                      Gateway
                      Node Sensor
                      Cuaca
                      Riwayat
```

Jangan mengubah struktur sidebar kecuali user meminta eksplisit.

## Dua Flow Ganti Password (PENTING — jangan dicampur)

| Flow | Halaman | Endpoint | Auth | Kapan dipakai |
|------|---------|----------|------|---------------|
| Lupa Password | `/reset-password` | `POST /api/auth/reset-password` | OTP 6 digit | User belum login, lupa password |
| Ganti Password | `/change-password` | `POST /api/auth/change-password` | JWT Bearer | User sudah login, ganti sandi dari Settings |

- Tombol "Ganti Sandi" di Settings HARUS menuju `/change-password` — tanpa OTP.
- Flow lupa password (dari Login) pakai urutan: `forgot-password` -> `reset-password/verify` -> `reset-password`, wajib OTP 2 tahap.
- Jangan arahkan user yang sudah login ke `/reset-password`.

## Catatan Porting (gotcha lama ke baru)

- FarmMap: Leaflet tidak auto-resize di container flex (versi lama pakai fix `invalidateSize` via ResizeObserver + requestAnimationFrame). Di build baru pakai react-leaflet; kalau peta tidak ter-render penuh dalam layout flex, terapkan `invalidateSize` lewat hook/event react-leaflet.
- Domain logic yang harus diangkat dari page lama: CSV export dan `classifyLog` (LogsPage), weather-code map (WeatherPage), badge/status mappers + `timeAgo` + `getSoilStatusFromMoisture` (`farmHelpers.js`).
- Login response: pastikan menyertakan objek user (versi lama menyimpan user ke localStorage saat login). Verifikasi shape-nya sebelum dipakai di AuthContext.
- Hack lama yang TIDAK perlu dibawa ke build baru: `#root { display: contents }` di index.html (itu workaround setup lama, tidak relevan di Vite + shadcn bersih).

## Tipografi

- Em dash rapat tanpa spasi untuk sisipan. En dash untuk rentang angka/tahun. Jangan hyphen pendek atau dua hyphen untuk fungsi itu.
- Jangan pakai horizontal rule (tiga hyphen) sebagai separator di file markdown mana pun.

## Git Commit Rules

- JANGAN PERNAH menambahkan trailer `Co-Authored-By: Claude` ke commit message.
- JANGAN PERNAH menambahkan baris atribusi AI/Claude (mis. "Generated with Claude Code") dalam bentuk apa pun.
- Commit message hanya berisi deskripsi perubahan teknis, tanpa atribusi AI.
- Author commit selalu user (KullyanHubbard), bukan Claude.

## Cara Kerja (anti-error)

- Kerjakan SATU fase per instruksi. Setelah selesai: jalankan `npx tsc --noEmit` dan `npm run dev`, pastikan nol error.
- Tampilkan ringkasan file yang dibuat/diubah.
- JANGAN lanjut ke fase berikutnya tanpa diminta. Akurasi di atas kecepatan.
- Jangan refactor besar tanpa kebutuhan langsung dari user. Pertahankan naming convention yang sudah ada.
- Known issue: Vite dev server (`npm run dev`) bisa mati sendiri tanpa warning jelas. Jika semua API call gagal tapi backend sehat, restart Vite.
