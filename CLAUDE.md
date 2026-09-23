# CLAUDE.md: LoraField

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

Ini proyek rebuild frontend dengan pendekatan strangler migration. Frontend React lama yang berantakan (CSS monolit, fetch manual duplikatif, tanpa TypeScript) sudah digantikan sepenuhnya. Promote selesai (2026-06-21): folder rebuild di-rename menjadi `frontend/` (menggantikan frontend React lama yang dihapus). Kini `frontend/` satu-satunya frontend.

- **Frontend tunggal: `frontend/`**. Semua perintah npm/npx dijalankan di sini. `npm run build` menghasilkan `frontend/dist/`.
- **Backend (tidak diubah dalam rebuild ini): `backend/`**. FastAPI + SQLite. Backend men-serve `frontend/dist/` di `/` (SPA fallback + asset di `/assets`). Contract-nya ada di section "Backend Endpoints" + "Database Schema" di bawah; itu sumber kebenaran.

Modul di `backend/app/` (hasil Fase 1 sampai Fase 4 rapikan backend, 2026-09-23):

| File | Isi |
|------|-----|
| `main.py` | Setup app, logging, CORS, startup, exception handler, `include_router`, serving SPA. Tidak ada route API di sini |
| `routers/auth.py` | Route `/api/auth/*` plus helper OTP |
| `routers/farms.py` | Route `/api/farms*`, termasuk `/summary` dan `/weather` per kebun |
| `routers/gateways.py` | Route gateway: klaim, lepas, registrasi node batch, gateway-logs |
| `routers/nodes.py` | Route `/api/nodes*` dan pembacaan sensor |
| `routers/logs.py` | Route `/api/logs` |
| `routers/utils.py` | Route `/api/crops`, `/api/utils/resolve-adm4`, `/api/weather`, `/api/decision` |
| `deps.py` | Helper bersama antar-router: `client_ip` dan verifikasi kepemilikan farm/node |
| `gateway_service.py` | `ensure_gateway_unclaimed` + `claim_gateway_for_farm` (dipakai `create_farm` dan `claim_farm_gateway`), `release_gateway` (dipakai `delete_farm` dan `unclaim_farm_gateway`) |
| `node_service.py` | `insert_node` (dipakai registrasi batch gateway dan self-registration) dan `record_reading` (simpan reading + decision_log) |
| `irrigation.py` | `THRESHOLDS` + `calculate_decision`, aturan buka/tutup valve |
| `bmkg.py` | Fetch prakiraan BMKG, normalisasi response, cache per adm4 |
| `adm4.py` | Resolusi kode adm4 dari koordinat (Nominatim + tabel wilayah + alias lokal) |
| `crops.py` | `CROP_THRESHOLDS`, 30 tanaman, sumber `GET /api/crops` |
| `mailer.py` | Kirim email lewat Resend, plus template HTML email reset password |
| `auth.py`, `config.py`, `database.py`, `schemas.py`, `wilayah_resolver.py`, `language_preferences.py` | Sudah ada sebelumnya |

Entrypoint tetap `app.main:app`. Aturan urutan route: catch-all SPA `/{full_path:path}` di `main.py` WAJIB tetap terdaftar paling akhir, setelah semua `include_router`. Kalau digeser ke atas, semua route API akan ketelan. Startup pakai `lifespan` (bukan `on_event` yang sudah deprecated).
- **Sumber kebenaran tunggal untuk langkah rebuild:** `frontend/docs/Panduan-Rebuild-Frontend-LoraField.md`. Tiap fase ikuti bagian relevan; jangan menambah teknologi, library, atau langkah di luar panduan.

Label UI: Bahasa Indonesia. Istilah teknis dipertahankan: LoRa, VWC, MQTT, Gateway, Node, BMKG, RSSI.

Dev server: `cd frontend && npm run dev` (port 5173, proxy `/api` ke port 8000). Backend: `uvicorn backend.app.main:app --host 0.0.0.0 --port 8000`.

## Stack

Frontend (`frontend/`), kunci ke ini, jangan ganti:

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
- Field yang masih perlu verifikasi shape-nya terhadap response asli: struktur detail forecast BMKG di dalam summary cuaca. Kalau tidak cocok dengan type, LAPORKAN, jangan diam-diam ubah.
- Sudah terverifikasi lewat `backend/scripts/smoke_test.py` (2026-09-22): kolom `weather` di decision_logs berisi string kondisi cuaca (mis. `Cerah Berawan`), bukan JSON. Response `/login` = `{ access_token, token_type, user }`. Response `/summary` = `{ farm, weather, thresholds, gateway_status, average_soil_moisture, nodes_total, nodes_online, nodes_problem, nodes }`.
- Data dummy/mock harus ditandai jelas sebagai mock, jangan seolah dari backend.
- Semua nilai mock frontend harus disentralisasi di `frontend/src/mocks/mockFarmScenario.ts`; query adapter boleh terpisah tetapi tidak boleh mendefinisikan ID, count, status, atau measurement dummy sendiri.
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
| `/api/auth/register` | POST | Publik | Daftar akun baru |
| `/api/auth/login` | POST | Publik | Login, return JWT |
| `/api/auth/forgot-password` | POST | Publik | Kirim OTP ke email |
| `/api/auth/reset-password/verify` | POST | Publik | Verifikasi OTP 6 digit |
| `/api/auth/reset-password` | POST | OTP | Ganti password (flow lupa password) |
| `/api/auth/change-password` | POST | JWT | Ganti password (sudah login) |
| `/api/auth/profile` | PATCH | JWT | Update phone number. Query opsional `browser_language` (`id`/`en`, default `en`) dipakai untuk backfill kolom `language` akun lama. |
| `/api/auth/me` | GET | JWT | Fetch profil user (return UserPublic). Query opsional `browser_language` (`id`/`en`, default `en`). Sumber: routers/auth.py:142. |
| `/api/auth/preferences/language` | PATCH | JWT | Set preferensi bahasa akun. Body `{ language }` (`id`/`en`), return `{ language }`. Sumber: routers/auth.py:216. |

> Catatan: AuthContext memakai `/api/auth/me` saat bootstrap untuk memverifikasi token tersimpan sebelum route terproteksi dirender. Request-nya dibatasi 8 detik; kegagalan transport atau 5xx jatuh ke cache `lf_user`, sedangkan 4xx mengakhiri sesi.

### Farms

| Endpoint | Method | Keterangan |
|----------|--------|-----------|
| `/api/farms` | GET | List kebun milik user (dari JWT). Return `{ items, total }` |
| `/api/farms/{farm_id}` | GET | Detail kebun. Return `{ farm }` |
| `/api/farms` | POST | Buat kebun baru. Body WAJIB berisi `gateway_device_id` (schema `FarmCreate`), dan gateway itu langsung diklaim ke kebun baru. Auto-resolve `bmkg_adm4_code` dari koordinat. Return `{ farm, gateway }`. routers/farms.py:128 |
| `/api/farms/{farm_id}` | PATCH | Update kebun (partial, `exclude_unset`); re-resolve `bmkg_adm4_code` kalau koordinat berubah. Return `{ farm }`. Schema body: `FarmUpdate` (routers/farms.py:43) |
| `/api/farms/{farm_id}` | DELETE | Hapus kebun (verifikasi kepemilikan). Menghapus juga decision_logs, readings, nodes, dan gateway_logs milik kebun itu, lalu melepas gateway-nya (baris `gateways` tetap ada). routers/farms.py:101 |

### Gateway

| Endpoint | Method | Keterangan |
|----------|--------|-----------|
| `/api/farms/{farm_id}/gateway` | GET | Gateway yang terpasang di kebun. Return `{ gateway }`, isinya `null` kalau kebun belum punya gateway. routers/gateways.py:67 |
| `/api/farms/{farm_id}/gateway/claim` | POST | Klaim gateway ke kebun. Body `GatewayClaimPayload` (`device_id`, `display_name`). 409 kalau gateway sudah dipakai kebun lain atau kebun sudah punya gateway. Return `{ gateway }`. routers/gateways.py:83 |
| `/api/farms/{farm_id}/gateway/unclaim` | POST | Lepas gateway dari kebun. Baris `gateways` tidak dihapus, hanya `farm_id`, `display_name`, dan `claimed_at` yang dikosongkan supaya device bisa dipakai kebun lain. Return `{ gateway }`. routers/gateways.py:111 |
| `/api/gateways/{gateway_id}/register` | POST | Batch register node dari firmware gateway. `gateway_id` di path = `device_id`, bukan kolom `id`. Body `GatewayRegisterPayload` (`farm_id`, `nodes[]`). Node yang belum ada dibuat otomatis. Response menyebut status `pending` untuk node baru dan `active` untuk node lama, tapi di DB keduanya tersimpan `online` (baterai awal 100, belum dari perangkat). Idempoten. Return `GatewayRegisterResponse`. routers/gateways.py:137 |

### Utils

| Endpoint | Keterangan |
|----------|-----------|
| `GET /api/crops` | List 30 jenis tanaman + threshold VWC, bisa filter `?q=` |
| `GET /api/utils/resolve-adm4?lat=X&lon=Y` | Resolve kode BMKG adm4 dari koordinat GPS via Nominatim OSM |

### Data

| Endpoint | Keterangan |
|----------|-----------|
| `GET /api/farms/{id}/summary` | Summary kebun (gateway, nodes, soil avg, valve, threshold, decision). routers/farms.py:200 |
| `GET /api/farms/{id}/weather` | Prakiraan cuaca BMKG untuk kebun (auto-resolve adm4, cache 30 menit). **Ini endpoint cuaca yang dipakai frontend.** routers/farms.py:177 |
| `GET /api/nodes` | List node (filter `?farm_id=`). Return `{ items, total }`. routers/nodes.py:18 |
| `PATCH /api/nodes/{id}/location` | Update lokasi/region/koordinat node. Return `{ node }`. routers/nodes.py:49 |
| `GET /api/nodes/{id}/readings` | Pembacaan sensor node (`limit` 1–100, default 20). routers/nodes.py:81 |
| `POST /api/nodes/{id}/readings` | Insert reading + hitung decision + tulis decision_log. Query wajib `?adm4=`. Kalau node belum ada, node dibuat otomatis (self-registration) dan body WAJIB menyertakan `farm_id`, kalau tidak 400. Return `{ reading, decision, node_created, node_status }`. routers/nodes.py:101 |
| `GET /api/weather?adm4=X` | Cuaca BMKG mentah by adm4 (debug, butuh auth, bypass cache jadi selalu memanggil BMKG). routers/utils.py:42 |
| `GET /api/decision?soil_moisture=X&rain_next_3h=bool` | Simulator keputusan irigasi (stateless, butuh auth). routers/utils.py:50 |
| `GET /api/logs` | Decision logs milik user (`limit` 1–100, default 20; filter client-side per farm) |
| `GET /api/farms/{id}/gateway-logs` | Log koneksi gateway kebun (`limit` 1–100, default 20). Verifikasi kepemilikan. Return `{ items, total }`. Kosong sampai hardware gateway lapor. routers/gateways.py:26 |
| `POST /api/farms/{id}/gateway-logs` | Insert log koneksi gateway (scaffolding hardware). Body `GatewayLogIn` (`event`, `detail`). Return `{ log }`, status 201. routers/gateways.py:47 |

## Database Schema (SQLite)

```text
users           : id, email, name, password_hash, phone, language, created_at, updated_at
farms           : id, user_id, name, owner, location, crop_type, area_ha, bmkg_adm4_code, latitude, longitude, status
nodes           : id, farm_id, gateway_id, name, location, region, latitude, longitude, status, battery, first_seen_at, updated_at
readings        : id, farm_id, node_id, soil_moisture, soil_temp, air_temp, air_humidity, created_at
decision_logs   : id, node_id, soil_moisture, weather, decision, valve_state, reason, created_at
gateways        : id, device_id (UNIQUE), farm_id (UNIQUE, NULL kalau belum diklaim), display_name, first_seen_at, last_seen_at, claimed_at
gateway_logs    : id, farm_id, event, detail, created_at; log koneksi gateway (kosong sampai hardware lapor)
weather_cache   : adm4 (PK), data (JSON), updated_at; TTL 30 menit
wilayah         : kode (PK, format adm4 BMKG), nama, nama_norm, level (1=provinsi s/d 4=desa), parent; di-seed sekali dari app/data/wilayah.csv
password_resets : id, user_id, token (6-digit OTP), expires_at, used, created_at
```

Catatan: `password_hash` tidak pernah dikirim ke frontend. Type `User` di frontend = id, name, email, phone (opsional), language; `created_at`/`updated_at` tidak ikut dikirim ke frontend. Kolom `phone` dan `language` ditambahkan via `ensure_column` (migration otomatis saat startup). `language` bernilai `'id'` atau `'en'` (CHECK constraint), dan NULL untuk baris lama sampai login, `/auth/me`, atau `/auth/profile` mem-backfill-nya. Kolom `nodes.gateway_id`, `nodes.first_seen_at`, dan `readings.farm_id` juga ditambahkan via `ensure_column`.

Catatan FK: `PRAGMA foreign_keys` aktif di tiap koneksi, dan TIDAK ADA satu pun FK yang pakai `ON DELETE CASCADE`. Jadi kode yang menghapus baris induk wajib menghapus baris anaknya lebih dulu. Lihat `delete_farm` (routers/farms.py:101) sebagai contoh urutannya.

## Endpoint Belum Ada (jangan panggil/karang)

- Rate limit brute-force untuk endpoint auth sensitif belum ada.

> Catatan (2026-06-24): `PATCH /api/farms/{farm_id}` SUDAH ADA di backend (routers/farms.py:43), sebelumnya tertulis belum ada. Frontend `src/lib/api.ts` belum memanggilnya; kalau mau pakai fitur edit kebun, tambahkan method-nya dulu sesuai schema `FarmUpdate`.

## Logika Irigasi

- Valve dibuka jika kelembapan tanah di bawah threshold dan tidak ada prediksi hujan.
- Valve ditutup jika kelembapan tanah sudah cukup.
- Irigasi ditunda jika BMKG memprediksi hujan.
- Sistem menunggu data sensor terbaru jika gateway offline.
- RSSI tidak disimpan di backend, selalu tampilkan `—` di tabel node.

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
- Logo/brand: ikon `Sprout` (lucide-react) + teks "LoraField". Lihat `BrandMark` di `frontend/src/components/layout/AppLayout.tsx` dan landing. Favicon: `frontend/public/favicon.svg`.

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

## Dua Flow Ganti Password (PENTING, jangan dicampur)

| Flow | Halaman | Endpoint | Auth | Kapan dipakai |
|------|---------|----------|------|---------------|
| Lupa Password | `/reset-password` | `POST /api/auth/reset-password` | OTP 6 digit | User belum login, lupa password |
| Ganti Password | `/change-password` | `POST /api/auth/change-password` | JWT Bearer | User sudah login, ganti sandi dari Settings |

- Tombol "Ganti Sandi" di Settings HARUS menuju `/change-password`, tanpa OTP.
- Flow lupa password (dari Login) pakai urutan: `forgot-password` -> `reset-password/verify` -> `reset-password`, wajib OTP 2 tahap.
- Jangan arahkan user yang sudah login ke `/reset-password`.

## Catatan Porting (gotcha lama ke baru)

- FarmMap: Leaflet tidak auto-resize di container flex (versi lama pakai fix `invalidateSize` via ResizeObserver + requestAnimationFrame). Di build baru pakai react-leaflet; kalau peta tidak ter-render penuh dalam layout flex, terapkan `invalidateSize` lewat hook/event react-leaflet.
- Domain logic yang harus diangkat dari page lama: CSV export dan `classifyLog` (LogsPage), weather-code map (WeatherPage), badge/status mappers + `timeAgo` + `getSoilStatusFromMoisture` (`farmHelpers.js`).
- Login response: pastikan menyertakan objek user (versi lama menyimpan user ke localStorage saat login). Verifikasi shape-nya sebelum dipakai di AuthContext.
- Hack lama yang TIDAK perlu dibawa ke build baru: `#root { display: contents }` di index.html (itu workaround setup lama, tidak relevan di Vite + shadcn bersih).

## Tipografi

- JANGAN pakai em dash di teks mana pun. Pakai koma, titik, titik dua, atau kurung. Ini mengikuti antislop R-02 dan menggantikan aturan em dash lama proyek ini (keputusan user, 2026-09-22).
- En dash untuk rentang angka/tahun. Jangan hyphen pendek atau dua hyphen untuk fungsi itu.
- Jangan pakai horizontal rule (tiga hyphen) sebagai separator di file markdown mana pun.

## Git Commit Rules

- JANGAN PERNAH menambahkan trailer `Co-Authored-By: Claude` ke commit message.
- JANGAN PERNAH menambahkan baris atribusi AI/Claude (mis. "Generated with Claude Code") dalam bentuk apa pun.
- Commit message hanya berisi deskripsi perubahan teknis, tanpa atribusi AI.
- Author commit selalu user (KullyanHubbard), bukan Claude.

## Cara Kerja (anti-error)

- Kerjakan SATU fase per instruksi. Setelah selesai: jalankan `npx tsc --noEmit` dan `npm run dev`, pastikan nol error.
- Kalau yang diubah backend, verifikasinya `python backend/scripts/smoke_test.py` (harus nol gagal) plus diff `backend/scripts/openapi_snapshot.py` sebelum/sesudah (harus kosong kalau kontrak API tidak diniatkan berubah).
- Tampilkan ringkasan file yang dibuat/diubah.
- JANGAN lanjut ke fase berikutnya tanpa diminta. Akurasi di atas kecepatan.
- Jangan refactor besar tanpa kebutuhan langsung dari user. Pertahankan naming convention yang sudah ada.
- Known issue: Vite dev server (`npm run dev`) bisa mati sendiri tanpa warning jelas. Jika semua API call gagal tapi backend sehat, restart Vite.
