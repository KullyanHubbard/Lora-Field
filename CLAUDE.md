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
| `routers/valves.py` | Route kendali valve: ganti mode otomatis/manual, jalankan/hentikan pengairan, valve per node |
| `valve_control.py` | Perintah valve mode manual, tutup otomatis setelah batas waktu, catatan ke decision_logs |
| `limited_irrigation.py` | Irigasi Terbatas: batas siram otomatis turun sementara per kebun (`decision_thresholds`), selesai sendiri di tanggalnya (`expire_limited_irrigation`), catatan ke decision_logs |
| `deps.py` | Helper bersama antar-router: `client_ip` dan verifikasi kepemilikan farm/node |
| `gateway_service.py` | `ensure_gateway_unclaimed` + `claim_gateway_for_farm` (dipakai `create_farm` dan `claim_farm_gateway`), `release_gateway` (dipakai `delete_farm` dan `unclaim_farm_gateway`) |
| `node_service.py` | `insert_node` (dipakai registrasi batch gateway dan self-registration) dan `record_reading` (simpan reading + decision_log) |
| `reading_service.py` | `apply_reading`: keputusan irigasi + simpan reading, dipakai route HTTP readings dan jembatan MQTT |
| `mqtt_bridge.py` | Jembatan MQTT sesuai `docs/kontrak-mqtt.md`: terima status/heartbeat/nodes/reading gateway, kirim `valve/set` (retain, dengan `until`) dan perintah `cmd` (`wifi_portal`, tanpa retain). Nonaktif kalau `MQTT_HOST` kosong. Route valve memanggil `publish_farm_valves` setelah transaksi |
| `irrigation.py` | `THRESHOLDS` + `calculate_decision`, aturan buka/tutup valve |
| `bmkg.py` | Fetch prakiraan BMKG, normalisasi response, cache per adm4 |
| `adm4.py` | Resolusi kode adm4 dari koordinat (Nominatim + tabel wilayah; fallback alamat ketikan, termasuk format "Desa, Kecamatan, Kabupaten") |
| `crops.py` | `CROP_THRESHOLDS`, 30 tanaman, sumber `GET /api/crops` |
| `mailer.py` | Kirim email lewat Resend, plus template HTML email reset password |
| `auth.py`, `config.py`, `database.py`, `schemas.py`, `wilayah_resolver.py`, `language_preferences.py` | Sudah ada sebelumnya |

- **Simulator perangkat: `simulator/`**. Script Python yang berperan sebagai gateway dan node sensor selama firmware belum ada. Bicara ke server hanya lewat MQTT sesuai `docs/kontrak-mqtt.md` (tanpa akun, tanpa HTTP), jadi bisa diganti gateway asli tanpa mengubah server. Nilai sensor dihitung dari BMKG (diambil langsung dari BMKG, bagian "dunia" simulasi) dan model fisik di `config.example.json`. Tidak membuat kebun: pengguna mendaftarkan kebun di web dengan ID gateway yang dicetak `run`; `reset` melupakan ID dan menghapus retain di broker. Model tanah: air merembes dengan jeda, kapasitas lapang 85%, penguapan ikut matahari, hujan dari `tp` BMKG sesuai `ground_cover` kebun di config (harus sama dengan kebun di web). Baterai dari arus sesuai firmware (ESP32 dan radio selalu menyala). Gangguan acak: WiFi gateway putus (Last Will), sensor rusak; `run --fault soil-dry|dht22-dead` memaksa node pertama rusak. ID alat diawali `SIM-` sebagai penanda mock. Cek logika simulator: `python simulator/test_sim.py`.
- **Firmware: `firmware/`**. Proyek PlatformIO untuk LilyGO LoRa32 (ESP32): env `gateway`, `node`, dan `native` (tes logika di PC). Gateway mengikuti `docs/kontrak-mqtt.md` sama seperti simulator. Logika bersama tanpa Arduino di `lib/lorafield/`; pin dan kalibrasi hanya di `include/config.h` (baru pin radio LoRa yang terverifikasi dengan alat). Verifikasi: `pio test -e native` dan `pio run -e gateway -e node` dari folder `firmware/` (pio ada di `%USERPROFILE%\.platformio\penv\Scripts\pio.exe`). Gateway sudah dicoba di alat asli (2026-10-01, LoRa32 V2.1 915 MHz, sampai tampil di web); node dan valve belum. Sejak firmware 0.2.0 gateway tidak memakai `secrets.h`: alamat dan port broker, password MQTT, dan password hotspot ada di memori alat (diisi lewat USB dengan `firmware/tools/provision.py`), WiFi diisi pembeli lewat portal WiFiManager (hotspot `LoraField-XXXX`, teks Indonesia di `include/wm_strings_id.h`, RST dua kali untuk membuka portal). Portal terbukti di alat 2026-10-02 (iPhone, gateway tersambung ke server). Board tanpa baterai sering brownout saat WiFi menyala; firmware mematikan pendeteksi brownout hanya selama menyambung WiFi, perbaikan utamanya di sumber daya. Detail di `firmware/README.md`. Cara pakai di `simulator/README.md`.

Entrypoint tetap `app.main:app`. Aturan urutan route: catch-all SPA `/{full_path:path}` di `main.py` WAJIB tetap terdaftar paling akhir, setelah semua `include_router`. Kalau digeser ke atas, semua route API akan ketelan. Startup pakai `lifespan` (bukan `on_event` yang sudah deprecated).
- **Panduan rebuild lama** (`frontend/docs/Panduan-Rebuild-Frontend-LoraField.md`) sudah dihapus. Acuan sekarang CLAUDE.md ini; jangan menambah teknologi atau library di luar section Stack.

Label UI: Bahasa Indonesia. Istilah teknis dipertahankan: LoRa, VWC, MQTT, Gateway, Node, BMKG, RSSI.

MQTT: broker Mosquitto 2.1 terpasang sebagai service Windows (otomatis jalan). Satu listener 1883 untuk jaringan lokal, semua klien wajib username dan password (plugin password-file `C:/mosquitto-data/passwd` dan acl-file `C:/mosquitto-data/acl`, konfigurasi di akhir `C:\Program Files\Mosquitto\mosquitto.conf`). Gateway dan simulator: username = ID gateway, hanya boleh di `lorafield/gw/{ID}/#`. Server: username `lorafield-server`. Setiap selesai `mosquitto_passwd`, jalankan `icacls C:\mosquitto-data\passwd /grant SYSTEM:R` (admin), kalau tidak service gagal membaca file itu dan mati. Backend menyambung kalau `MQTT_HOST` diisi di `backend/.env` (plus `MQTT_USERNAME`, `MQTT_PASSWORD`); simulator memakai `mqtt.password` di `simulator/config.json`. Format pesan gateway: `docs/kontrak-mqtt.md`. Smoke test mematikan MQTT dan memakai klien palsu. Jalan menuju produk (VPS, TLS, keamanan, izin): `docs/rencana-produk.md`.

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
- Sudah terverifikasi lewat `backend/scripts/smoke_test.py` (2026-09-22): kolom `weather` di decision_logs berisi string kondisi cuaca (mis. `Cerah Berawan`), bukan JSON; string kosong `""` kalau cuaca tidak tersedia (BMKG gagal dan tidak ada cache cadangan yang layak pakai). Response `/login` = `{ access_token, token_type, user }`. Response `/summary` = `{ farm, weather, thresholds, gateway_status, average_soil_moisture, nodes_total, nodes_online, nodes_problem, nodes }`.
- Data dummy/mock harus ditandai jelas sebagai mock, jangan seolah dari backend.
- Saat ini frontend tidak punya data mock (`src/mocks/` sudah dihapus). Data uji perangkat dibuat oleh `simulator/` lewat API, bukan di kode frontend. Kalau mock dibutuhkan lagi, taruh semua nilainya terpusat di satu file di `frontend/src/mocks/`; query adapter tidak boleh mendefinisikan ID, count, status, atau measurement dummy sendiri.
- Kalau ragu atau butuh keputusan desain: BERHENTI dan tanya.

## Konvensi Kode

- Functional components + hooks. TypeScript di semua file.
- Akses token localStorage HANYA lewat `src/lib/token.ts`. Tidak ada komponen yang baca localStorage token langsung.
- Data fetching HANYA lewat TanStack Query hooks (`src/features/*/queries.ts`). Tidak ada useEffect + fetch manual di komponen.
- Styling: Tailwind utility + CSS variable tema shadcn. DILARANG warna hardcoded di JS (pakai token tema seperti `text-primary`). DILARANG inline style kecuali nilai dinamis yang wajib (mis. tinggi bar dari data).
- Import pakai alias `@/` (bukan `../../`).
- Waktu dari backend (UTC tanpa penanda zona) dibaca lewat `parseServerDate` di `src/lib/format.ts`, jangan `new Date()` langsung. Waktu prakiraan BMKG/Open-Meteo sudah jam lokal, jangan lewat fungsi itu.

## Backend Endpoints

### Auth

| Endpoint | Method | Auth | Keterangan |
|----------|--------|------|-----------|
| `/api/auth/register` | POST | Publik | Daftar akun, tahap 1. Selalu 202 `{ message }` untuk email apa pun, supaya tidak membocorkan email terdaftar. Email baru atau yang belum verifikasi dikirimi kode 6 digit (tabel `password_resets`, 30 menit; kirim ulang ikut batas 5 per hari forgot-password, tanpa 429). Email yang sudah terverifikasi tidak dikirimi apa pun dan akunnya tidak berubah. Akun yang tidak diverifikasi dalam 7 hari (dan tanpa kebun) dihapus saat ada pendaftaran berikutnya. |
| `/api/auth/register/verify` | POST | OTP | Daftar akun, tahap 2. Body `{ name, email, password, language, token }`. Kode benar = nama, password, dan bahasa dari body ini disimpan dan email terverifikasi. Kode hangus setelah 5 kali salah |
| `/api/auth/login` | POST | Publik | Login, return JWT. Setelah 5 kali gagal dalam 15 menit login dikunci, password benar pun ditolak. Email tak dikenal, password salah, dan akun terkunci dibalas sama (401, pesan sama, bcrypt tetap jalan) supaya tidak membocorkan email terdaftar. 403 kalau email belum diverifikasi (dicek setelah password benar) |
| `/api/auth/forgot-password` | POST | Publik | Kirim OTP ke email (di background). Maksimal 5 kode per hari per akun; lewat batas, balasan tetap 200 dengan pesan sama tanpa kode, supaya tidak membocorkan email terdaftar. |
| `/api/auth/reset-password/verify` | POST | Publik | Verifikasi OTP 6 digit. Body wajib `{ email, token }`; kode hangus setelah 5 kali salah |
| `/api/auth/reset-password` | POST | OTP | Ganti password (flow lupa password). Body wajib `{ email, token, new_password }`. Ikut memverifikasi email akun yang belum verifikasi |
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
| `/api/farms/{farm_id}` | PATCH | Update kebun (partial, `exclude_unset`); re-resolve `bmkg_adm4_code` kalau koordinat berubah. `crop_type` tidak bisa diganti: nilai berbeda dari tanaman kebun ditolak 422, nilai yang sama diterima tanpa perubahan. Return `{ farm }`. Schema body: `FarmUpdate` (routers/farms.py:43) |
| `/api/farms/{farm_id}` | DELETE | Hapus kebun (verifikasi kepemilikan). Menghapus juga decision_logs, readings, nodes, dan gateway_logs milik kebun itu, lalu melepas gateway-nya (baris `gateways` tetap ada). routers/farms.py:101. Setelah itu perintah valve retain tiap node di broker dihapus (isi kosong = valve tutup) |

### Gateway

| Endpoint | Method | Keterangan |
|----------|--------|-----------|
| `/api/farms/{farm_id}/gateway` | GET | Gateway yang terpasang di kebun. Return `{ gateway }`, isinya `null` kalau kebun belum punya gateway. routers/gateways.py:67 |
| `/api/farms/{farm_id}/gateway/claim` | POST | Klaim gateway ke kebun. Body `GatewayClaimPayload` (`device_id`, `display_name`). 409 kalau gateway sudah dipakai kebun lain atau kebun sudah punya gateway. Return `{ gateway }`. routers/gateways.py:83 |
| `/api/farms/{farm_id}/gateway/unclaim` | POST | Lepas gateway dari kebun. Baris `gateways` tidak dihapus, hanya `farm_id`, `display_name`, dan `claimed_at` yang dikosongkan supaya device bisa dipakai kebun lain. Setelah itu perintah valve retain tiap node di broker dihapus (isi kosong = valve tutup). Return `{ gateway }`. routers/gateways.py:104 |
| `/api/farms/{farm_id}/gateway/wifi-portal` | POST | Tombol "Ganti WiFi" di halaman Gateway: kirim `{"action":"wifi_portal"}` ke topik MQTT `cmd` (QoS 1, tanpa retain), gateway membuka portal WiFi 5 menit dengan WiFi lama sebagai cadangan. 404 kalau kebun belum punya gateway, 409 kalau gateway offline (aturan sama dengan `summary.gateway_status`, lewat `gateway_link_state` di `gateway_service.py`), 503 kalau jembatan MQTT nonaktif atau kiriman gagal. Mencatat event `wifi_portal` di gateway_logs. Return `{ gateway }` |
| `/api/gateways/{gateway_id}/register` | POST | Batch register node dari firmware gateway. `gateway_id` di path = `device_id`, bukan kolom `id`. Body `GatewayRegisterPayload` (`farm_id`, `nodes[]`). Node yang belum ada dibuat otomatis. Response menyebut status `pending` untuk node baru dan `active` untuk node lama, tapi di DB keduanya tersimpan `online` (baterai awal 100, belum dari perangkat). Idempoten. Return `GatewayRegisterResponse`. routers/gateways.py:130 |

### Utils

| Endpoint | Keterangan |
|----------|-----------|
| `GET /api/crops` | List 30 jenis tanaman + threshold VWC, bisa filter `?q=` |
| `GET /api/utils/resolve-adm4?lat=X&lon=Y` | Resolve kode BMKG adm4 dari koordinat GPS via Nominatim OSM |

### Data

| Endpoint | Keterangan |
|----------|-----------|
| `GET /api/farms/{id}/summary` | Summary kebun (gateway, nodes, soil avg, valve, threshold, decision). routers/farms.py:200 |
| `GET /api/farms/{id}/weather` | Prakiraan cuaca BMKG untuk kebun (auto-resolve adm4, cache 30 menit). Kalau BMKG gangguan, pakai cache lama sampai umurnya WEATHER_STALE_MAX_HOURS (default 12 jam), lalu balas 502 kalau tidak ada cache yang layak pakai. **Ini endpoint cuaca yang dipakai frontend.** routers/farms.py:177 |
| `GET /api/nodes` | List node (filter `?farm_id=`). Return `{ items, total }`. routers/nodes.py:18 |
| `PATCH /api/nodes/{id}/location` | Update lokasi/region/koordinat node. Return `{ node }`. routers/nodes.py:49 |
| `PATCH /api/nodes/{id}/name` | Ganti nama node (1–40 karakter, di-trim, cek kepemilikan). Return `{ node }`. Nama bawaan node = `Node` + 4 karakter terakhir ID (sesuai stiker); nama dari gateway MQTT hanya dipakai saat node pertama terdaftar |
| `GET /api/nodes/{id}/readings` | Pembacaan sensor node (`limit` 1–100, default 20). Opsional `hours` (1–72): semua reading dalam N jam sebelum reading terbaru node, `limit` diabaikan. Frontend memakai `hours` (`READINGS_FETCH_HOURS` di `src/lib/timeWindows.ts`). routers/nodes.py |
| `POST /api/nodes/{id}/readings` | Insert reading + hitung decision (threshold kebun) + tulis decision_log. Cuaca memakai kode BMKG kebun; `?adm4=` opsional, hanya cadangan kalau kebun belum punya kode. Body boleh menyertakan `battery` (0–100) dari perangkat dan `rssi` (dBm, -150 sampai 0) yang diukur gateway saat menerima paket. Kalau node belum ada, node dibuat otomatis (self-registration) dan body WAJIB menyertakan `farm_id`, kalau tidak 400. Reading tidak pernah gagal karena BMKG gangguan: kalau cuaca tidak tersedia, keputusan otomatis pakai rain_next_3h=false. Return `{ reading, decision, node_created, node_status }`. routers/nodes.py:101 |
| `GET /api/weather?adm4=X` | Cuaca BMKG mentah by adm4 (debug, butuh auth, bypass cache jadi selalu memanggil BMKG). routers/utils.py:42 |
| `GET /api/decision?soil_moisture=X&rain_next_3h=bool` | Simulator keputusan irigasi (stateless, butuh auth). routers/utils.py:50 |
| `GET /api/logs` | Decision logs milik user. `limit` 1–1000 (default 20). Query opsional `farm_id` (cek kepemilikan, 404 kalau bukan milik user), `start` dan `end` (ISO date-time, inklusif, tanpa zona dianggap UTC). Web mengambil 100 log terbaru (refresh berkala) kalau tanpa filter tanggal, dan sampai 1000 log tanpa refresh berkala kalau filter tanggal dipakai. Tiap item membawa `decision_type` (`open`/`delayed`/`closed`/`standby`/`soaking`/`pulse_limit`, null untuk log lama tak dikenal); frontend membaca ini, bukan teks `decision`. Baris Irigasi Terbatas (`limited_*`) juga membawa `limited_until` dan `limited_reason` (null di baris lain). Baris dari reading (`record_reading`) hanya ditulis kalau `decision_type` node berubah dari baris terakhirnya; aksi tombol valve manual (`_log_manual_action`) tetap selalu dicatat. Bacaan sensor tetap tersimpan tiap reading di tabel `readings`. Baris lama per menit sebelum 2026-09-27 dibiarkan |
| `GET /api/farms/{id}/gateway-logs` | Log koneksi gateway kebun (`limit` 1–100, default 20). Verifikasi kepemilikan. Return `{ items, total }`. Kosong sampai hardware gateway lapor. routers/gateways.py:26 |
| `POST /api/farms/{id}/gateway-logs` | Insert log koneksi gateway (scaffolding hardware). Body `GatewayLogIn` (`event`, `detail`). Return `{ log }`, status 201. routers/gateways.py:47 |

### Kendali Valve

| Endpoint | Method | Keterangan |
|----------|--------|-----------|
| `/api/farms/{farm_id}/irrigation-mode` | PATCH | Body `{ mode: 'auto' \| 'manual' }`. 409 kalau semua node offline. Masuk manual = semua perintah valve `closed`; kembali otomatis = perintah dihapus. Return `{ farm }` |
| `/api/farms/{farm_id}/irrigation/start` | POST | Mode manual saja. Buka valve semua node online yang punya reading, kecuali node yang tanahnya jenuh (reading terakhir >= `SOIL_SATURATION_STOP_PCT`, default 98). 409 kalau semua node jenuh. Return `{ nodes }` |
| `/api/farms/{farm_id}/irrigation/stop` | POST | Mode manual saja. Tutup semua valve terbuka, termasuk node offline. Return `{ nodes }` |
| `/api/nodes/{node_id}/valve` | PATCH | Mode manual saja. Body `{ open }`. Membuka butuh node online, sudah punya reading, dan tanah belum jenuh (409 kalau tidak). Return `{ node }` |
| `/api/nodes/{node_id}/irrigation/resume` | POST | Mode otomatis saja. Tombol "Aktifkan lagi" menghapus jeda penyiraman otomatis node. Mode manual dibalas 409. Return `{ node }` |
| `/api/farms/{farm_id}/limited-irrigation` | POST | Mulai Irigasi Terbatas. Body `{ reason: 'flowering' \| 'harvest' \| 'other', until }` (`until` ISO date-time, tanpa zona dianggap UTC; frontend mengirim akhir hari lokal). 409 kalau mode manual, tanaman padi, atau sudah aktif. 422 kalau `until` tidak di antara sekarang dan `LIMITED_IRRIGATION_MAX_DAYS` (default 28) hari + 1. Return `{ farm }` |
| `/api/farms/{farm_id}/limited-irrigation` | PATCH | Ubah tanggal selesai, boleh di mode apa pun. Body `{ until }`, aturan 422 sama. 409 kalau tidak aktif. Return `{ farm }` |
| `/api/farms/{farm_id}/limited-irrigation` | DELETE | Hentikan Irigasi Terbatas. 409 kalau tidak aktif. Return `{ farm }` |

Perintah valve disimpan di server (`nodes.valve_command`) lalu dikirim ke gateway lewat MQTT (`valve/set`). `valve_command_sent_at` diisi saat reading MQTT melaporkan field `valve` sama dengan perintah, dan dikosongkan lagi kalau laporan berikutnya berbeda (mis. node sempat mati); reading lewat HTTP tidak pernah mengisinya. UI wajib menyebut perintah "belum terkirim ke alat" selama NULL. Kalau reading MQTT masih melaporkan posisi valve lain dan perintah terakhir node sudah dikirim minimal `VALVE_RESEND_MINUTES` (default 5) menit lalu, server mengirim ulang `valve/set`.

## Database Schema (SQLite)

```text
users           : id, email, name, password_hash, phone, language, email_verified_at, created_at, updated_at
farms           : id, user_id, name, owner, location, crop_type, area_ha, bmkg_adm4_code, latitude, longitude, status, lower_threshold, upper_threshold, irrigation_mode, ground_cover, limited_until, limited_reason
nodes           : id, farm_id, gateway_id, name, location, region, latitude, longitude, status, battery, first_seen_at, last_seen_at, battery_updated_at, valve_command, valve_command_at, valve_command_sent_at, auto_pulse_count, auto_pulse_started_at, auto_limit_at, auto_cycle_baseline, auto_confirmed_pulse_count, auto_paused_at, updated_at
readings        : id, farm_id, node_id, soil_moisture, soil_temp, air_temp, air_humidity, rssi, created_at
decision_logs   : id, node_id, soil_moisture, weather, decision, decision_type, valve_state, reason, created_at, limited_until, limited_reason
gateways        : id, device_id (UNIQUE), farm_id (UNIQUE, NULL kalau belum diklaim), display_name, first_seen_at, last_seen_at, claimed_at, booted_at (perkiraan jam menyala dari uptime heartbeat, via ensure_column, untuk deteksi restart), boot_id (nomor nyala acak dari heartbeat, via ensure_column; deteksi restart utama, jam menyala hanya cadangan), wifi_ssid, wifi_rssi (WiFi gateway menurut heartbeat terakhir, via ensure_column; kartu Gateway menampilkannya hanya saat online)
gateway_logs    : id, farm_id, event, detail, created_at; log koneksi gateway (kosong sampai hardware lapor)
weather_cache   : adm4 (PK), data (JSON), updated_at; TTL 30 menit. Cache lewat TTL tetap dipakai sebagai cadangan (dihitung ulang dari isi "forecast") kalau BMKG gagal, sampai umurnya WEATHER_STALE_MAX_HOURS (default 12 jam). BMKG yang gagal untuk suatu adm4 tidak dicoba lagi selama 5 menit (jeda percobaan ulang, in-memory per proses)
wilayah         : kode (PK, format adm4 BMKG), nama, nama_norm, level (1=provinsi s/d 4=desa), parent; di-seed sekali dari app/data/wilayah.csv
password_resets : id, user_id, token (6-digit OTP), expires_at, used, created_at, attempts (jumlah kode salah, kode hangus di 5)
```

Kolom `farms.ground_cover` ditambahkan via `ensure_column` (`'open'`/`'mulch'`/`'roofed'`, default `'open'`). Kebun bermulsa plastik atau beratap tidak kena hujan, jadi prediksi hujan BMKG hanya menunda irigasi untuk `'open'` (lihat `effective_rain_next_3h` di `irrigation.py`, dipakai `create_reading` dan `get_farm_summary`; `/api/decision` debug TIDAK memakainya).

Catatan: `password_hash` tidak pernah dikirim ke frontend. Type `User` di frontend = id, name, email, phone (opsional), language; `created_at`/`updated_at` tidak ikut dikirim ke frontend. Kolom `phone` dan `language` ditambahkan via `ensure_column` (migration otomatis saat startup). `language` bernilai `'id'` atau `'en'` (CHECK constraint), dan NULL untuk baris lama sampai login, `/auth/me`, atau `/auth/profile` mem-backfill-nya. Kolom `nodes.gateway_id`, `nodes.first_seen_at`, dan `readings.farm_id` juga ditambahkan via `ensure_column`, begitu juga `farms.lower_threshold`/`upper_threshold`, `nodes.last_seen_at`/`battery_updated_at`, `readings.rssi`, dan `decision_logs.decision_type` (di-backfill saat startup). Kolom `users.email_verified_at` (NULL = belum verifikasi, tidak bisa login) juga lewat `ensure_column`; akun yang sudah ada diisi `created_at` SEKALI saja saat kolom dibuat (jangan diubah jadi backfill tiap startup).

Catatan gateway: `summary.gateway_status` = `online` kalau ada node online atau gateway melapor (`gateways.last_seen_at`) dalam `GATEWAY_OFFLINE_AFTER_MINUTES` (default 15, terpisah dari batas node, wajib lebih dari 10 menit jarak heartbeat; nilai lebih kecil ditolak saat startup, karena gateway tanpa node akan tampil offline bergantian), kecuali laporan koneksi terakhir di `gateway_logs` adalah `disconnected` (status offline atau Last Will) dan belum ada kabar sesudahnya: langsung `offline` tanpa menunggu batas waktu. Kartu Gateway di frontend membaca nilai ini, tidak menghitung sendiri. Status retain yang diterima saat backend menyambung ulang ke broker dicatat di gateway_logs hanya kalau berbeda dari laporan koneksi terakhir (`last_link_event` di `gateway_service.py`), supaya Riwayat Koneksi tetap cocok dengan status. Heartbeat tidak dicatat; gateway yang sempat restart (jam menyala dari uptime maju lebih dari 1 menit) dicatat `restarted` pada perkiraan jam menyala, detailnya kode `boot_reason` dari heartbeat (diterjemahkan web).

Catatan node (via `present_node` di `node_service.py`): kolom `nodes.status` hanya diisi saat insert dan tidak dibaca lagi. `status` di response API diturunkan dari `last_seen_at`, `offline` kalau tidak ada data melewati `NODE_OFFLINE_AFTER_MINUTES` (default 15). `battery` di response = null kalau perangkat belum pernah melaporkannya.

Catatan FK: `PRAGMA foreign_keys` aktif di tiap koneksi, dan TIDAK ADA satu pun FK yang pakai `ON DELETE CASCADE`. Jadi kode yang menghapus baris induk wajib menghapus baris anaknya lebih dulu. Lihat `delete_farm` (routers/farms.py:101) sebagai contoh urutannya.

## Endpoint Belum Ada (jangan panggil/karang)

> Catatan (2026-09-27): pembatas percobaan login dan forgot-password SUDAH ADA (lihat tabel Auth), tapi in-memory per proses (`routers/auth.py`): hitungannya hilang saat server restart dan tidak dibagi antar-worker. Pindahkan ke tabel DB kalau backend dijalankan dengan lebih dari satu worker.

> Catatan (2026-06-24): `PATCH /api/farms/{farm_id}` SUDAH ADA di backend (routers/farms.py:43), sebelumnya tertulis belum ada. Frontend memanggilnya lewat `api.updateFarm` (`src/lib/api.ts`) untuk edit nama kebun di Kebun Saya.

## Logika Irigasi

- Threshold per kebun, diambil dari jenis tanaman (`crops.py`) saat kebun dibuat. Satu kebun satu tanaman: `crop_type` tidak bisa diganti setelah kebun dibuat (PATCH farm menolak 422 kalau berbeda). `crop_type` wajib salah satu dari daftar `GET /api/crops` (POST farm menolak 422 kalau tidak); form Tambah Kebun hanya menyediakan pilihan, tanpa ketik bebas. Default 40–70% (`DEFAULT_THRESHOLDS` di `irrigation.py`) hanya untuk kebun lama yang tanamannya tidak dikenal. `summary.thresholds` berisi threshold kebun itu.
- Mode otomatis menyiram bertahap (`auto_decision` di `irrigation.py`, ingatan siklus di kolom `nodes.auto_pulse_*` dan `auto_limit_at`). Siklus mulai saat kelembapan di bawah batas bawah: valve buka satu pulsa `AUTO_PULSE_MINUTES` (default 10), lalu tutup `AUTO_SOAK_MINUTES` (default 30) menunggu air meresap (`soaking`), lalu pulsa berikutnya. Siklus selesai saat kelembapan mencapai target = batas atas dikurangi `AUTO_TARGET_MARGIN` (default 5).
- Kalau target belum tercapai setelah `AUTO_MAX_PULSES` pulsa (default 4), keputusan `pulse_limit` dan siklus baru ditahan `AUTO_LIMIT_COOLDOWN_HOURS` (default 3). Jeda ini menang atas kondisi darurat, supaya sensor rusak yang terbaca sangat kering tidak membuat valve menyiram terus.
- Pengaman `check_irrigation` ("Periksa penyiraman"): pada setiap akhir masa resap mulai pulsa ke-`AUTO_NO_RISE_PULSES` (default 2), bila semua pulsa siklus terkonfirmasi oleh laporan valve terbuka dan kenaikan kelembapan dari `auto_cycle_baseline` kurang dari `AUTO_NO_RISE_MIN_POINTS` (default 2 poin persentase), valve ditutup dan node dijeda (`auto_paused_at`). Kenaikan tepat 2 poin atau lebih tidak memicu jeda ini.
- Irigasi Terbatas (`limited_irrigation.py`), per kebun, semua node serempak: selama `farms.limited_until` belum lewat, keputusan mode otomatis memakai batas bawah dan atas tanaman dikurangi `LIMITED_IRRIGATION_DROP_POINTS` (default 10). `summary.thresholds` tetap batas tanaman. Mulai hanya di mode otomatis dan bukan padi; pindah ke manual tidak membatalkannya dan tanggal selesai tidak bergeser. Selesai sendiri saat tanggal lewat (dicek saat reading masuk atau summary dibaca, dicatat pada waktu `limited_until`). Mulai, ubah tanggal, dihentikan, dan selesai dicatat di decision_logs (`limited_started`/`limited_changed`/`limited_stopped`/`limited_ended`, dengan `limited_until` dan `limited_reason`) untuk tiap node kebun yang sudah punya reading pada waktu kejadian; kelembapan dan posisi valve di catatan itu diambil dari data sampai waktu kejadian, bukan data sesudahnya. Mulai, ubah tanggal, dan hentikan memegang kunci tulis sejak awal (`BEGIN IMMEDIATE`), jadi permintaan bersamaan antre. Padi tidak pernah memakai batas Terbatas.
- Batas darurat hujan: di bawah batas bawah dikurangi `RAIN_EMERGENCY_MARGIN` (default 15), prediksi hujan diabaikan dan tanah tetap disiram.
- Siklus dimulai ulang dari pulsa pertama kalau node sempat offline. Ganti mode otomatis/manual mereset state pulsa, tetapi tidak menghapus `auto_paused_at`: jeda tetap berlaku sampai pengguna menekan "Aktifkan lagi" di halaman Irigasi saat mode otomatis. Ringkasan hanya membaca state, tidak mengubahnya.
- Hujan dianggap cukup untuk menunda siram kalau total `tp` (curah hujan BMKG, mm) di jendela cek hujan (`RAIN_CHECK_SLOTS`, 2 slot) >= `RAIN_DELAY_MIN_MM` (default 5). Kalau ada slot tanpa angka `tp`, kembali ke kata kunci teks (`rain_outlook` di `bmkg.py`). Totalnya disimpan di field cuaca `rain_next_3h_mm` (null kalau memakai cadangan teks). Kartu cuaca Dashboard menampilkan "Hujan Ringan" untuk total >= 1 mm yang belum menunda siram (`RAIN_LIGHT_MIN_MM`).
- Irigasi ditunda jika BMKG memprediksi hujan, HANYA untuk kebun `ground_cover` `'open'` (tanah terbuka). Kebun `'mulch'` (mulsa plastik) dan `'roofed'` (beratap/rumah kaca) tidak kena hujan, jadi prediksi hujan diabaikan dan irigasi tetap jalan kalau kelembapan rendah.
- Mode per kebun: `auto` (aturan di atas) atau `manual` (valve mengikuti perintah pengguna, decision `manual_open`/`manual_closed`). Valve yang dibuka manual ditutup otomatis setelah `MANUAL_IRRIGATION_MAX_MINUTES` (default 30) dan tercatat `manual_timeout`. Ganti mode 2 langkah di kartu Status Valve: pilih, lalu Terapkan.
- Tanah jenuh (reading >= `SOIL_SATURATION_STOP_PCT`, default 98): valve yang dibuka manual langsung ditutup server (decision `manual_saturated`, tercatat di riwayat) dan perintah buka ditolak. Mode otomatis sudah berhenti jauh sebelumnya (target di bawah batas atas tanaman). Web memberi peringatan mulai 92% (`SOIL_WET_WARNING_PCT` di `dashboardHelpers.ts`): tombol Jalankan Pengairan minta konfirmasi, panel Atur Valve menampilkan peringatan per node dan mengunci switch buka saat jenuh.
- Sistem menunggu data sensor terbaru jika gateway offline. Di summary, node yang offline mendapat decision `disconnected` (tampil "Terputus", valve `unknown`), bukan keputusan terakhir yang sudah basi. `disconnected` tidak pernah tercatat di decision_logs.
- RSSI disimpan per reading (`readings.rssi`, dBm, NULL kalau gateway tidak melaporkannya). Kartu Sensor Node menampilkan RSSI dari `latest_reading` node terpilih, dan `-` kalau kosong (konstanta `EMPTY_VALUE` di `src/lib/format.ts`, penanda nilai kosong untuk seluruh UI).

## Akses User

- Tiap user hanya melihat kebun miliknya. Jangan buat fitur yang menampilkan kebun lintas-user kecuali mode admin pusat diminta eksplisit.
- Sumber kebenaran user = JWT backend. JANGAN pakai `user_id` di query params endpoint farm.
- Model akses: `User -> Farm -> Gateway -> Node -> Sensor Data -> Irrigation Log -> Dashboard`
- Satu kebun = satu tanaman (tidak bisa diganti), satu gateway (`gateways.farm_id` UNIQUE, klaim kedua ditolak 409), dan beberapa node (tiap node milik satu kebun; registrasi node dari kebun lain ditolak 409).

## Aturan Produk & UI (untuk build baru)

- Dashboard Utama = ringkasan cepat semua kebun, BUKAN data detail. Peta Kebun Interaktif wajib ada di Dashboard. Card kebun adalah jalur alternatif selain map untuk masuk ke Detail Kebun.
- Detail Kebun dibatasi hanya kebun yang dipilih (`useParams().id`).
- Dukung dark mode dan light mode (di build baru lewat tema shadcn, toggle via class/`data-theme` di `<html>`). Pastikan style jalan di kedua mode.
- Badge status warna konsisten: green/yellow/red.
- Progress bar selalu sertakan label range `0%` dan `100%`.
- Landing page marketing publik ADA di route `/` (lihat tabel Routes). Aturan lama "jangan buat landing page" sudah dicabut user (2026-06-21). Dashboard tetap pengalaman utama bagi user yang sudah login; landing hanya etalase di `/` (publik, tanpa auth guard, untuk semua pengunjung).
- Logo/brand: teks "LoraField" (ikon `Sprout` sementara dihapus). Lihat `BrandMark` di `frontend/src/components/layout/BrandMark.tsx`. Favicon: `frontend/public/favicon.svg` (masih logo bawaan Vite, belum diganti).

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
- Kartu Status Valve berisi switch mode Otomatis/Manual, tombol Jalankan/Hentikan Pengairan (mode manual), dan panel Atur Valve (disetujui pemilik, 2026-09-26). Di mode Otomatis tingginya sama dengan baseline.

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

### Routes & Pages

Rute aktual ada di `frontend/src/app/router.tsx`. Kolom kedua = referensi porting dari frontend lama. Rute lain (`*`) diarahkan ke `/select-farms`.

| Route | Page (referensi lama) | Keterangan |
|-------|------|-----------|
| `/` | `LandingPage.tsx` | Landing marketing PUBLIK, tanpa auth guard. Tombol Login/CTA → `/login`. Dark-only. |
| `/login` | `LoginPage.jsx` | Login + inline forgot password 2-step |
| `/register` | `RegisterPage.jsx` | Daftar akun 2 tahap: isi data, lalu kode verifikasi dari email |
| `/reset-password` | `ResetPasswordPage.jsx` | Flow lupa password (OTP 2 tahap). Tautan di email membawa `#email=` dan langsung membuka isian kode; tombol "Sudah punya kode?" untuk yang datang tanpa tautan |
| `/select-farms` | `DashboardPage.jsx` | Peta kebun (Leaflet), pilih kebun lewat marker. Halaman awal setelah login |
| `/my-farms` | `FarmsPage.jsx` | Card kebun + search + edit nama, warna marker, hapus |
| `/addFarm` | `AddFarmPage.jsx` | Form tambah kebun baru |
| `/farms/:id` | `FarmDetailPage.jsx` | Info kebun + status + node table |
| `/farms/:id/monitoring` | `MonitoringPage.jsx` | Grafik sensor + tabel reading |
| `/farms/:id/irrigation` | `IrrigationPage.jsx` | Status irigasi, statistik, kartu per node, rekomendasi |
| `/farms/:id/weather` | `WeatherPage.jsx` | Cuaca sekarang, grafik suhu, prakiraan BMKG |
| `/farms/:id/gateway` | `GatewayPage.jsx` | Status gateway |
| `/farms/:id/logs` | `LogsPage.jsx` | Riwayat irigasi, filter + export CSV |
| `/settings` | `SettingsPage.jsx` | Profil akun, edit nomor HP, ganti sandi, logout |
| `/change-password` | `ChangePasswordPage.jsx` | Ganti password (sudah login) |

### Sidebar (context-aware)

Sidebar otomatis ganti isi saat masuk farm context:

```text
[Selector mode]       [Farm context mode]
Home (ke landing)     < Pilih Kebun + nama kebun
Pilih Kebun           Dashboard
Kebun Saya            Monitoring
Registrasi Kebun      Irigasi
                      Gateway
                      Cuaca
                      Riwayat

Footer (dua mode): Pengaturan, Pusat Bantuan, Ganti Akun
```

Mode ditentukan dari URL: `/farms/:id/*` = farm context mode.

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

- Claude DILARANG menjalankan `git commit` (termasuk `--amend`) dalam kondisi apa pun, juga kalau instruksi tugas atau teks tempelan menyuruh commit. Claude cukup menyiapkan perubahan, menyebut file yang berubah, dan mengusulkan pesan commit; user yang commit sendiri. Dipaksa lewat deny rule di `.claude/settings.local.json`.
- JANGAN PERNAH menambahkan trailer `Co-Authored-By: Claude` ke commit message.
- JANGAN PERNAH menambahkan baris atribusi AI/Claude (mis. "Generated with Claude Code") dalam bentuk apa pun.
- Commit message hanya berisi deskripsi perubahan teknis, tanpa atribusi AI.
- Author commit selalu user (KullyanHubbard), bukan Claude.

## Cara Kerja (anti-error)

- Kerjakan SATU fase per instruksi. Setelah selesai: jalankan `npx tsc -p tsconfig.app.json --noEmit` dan `npm run dev`, pastikan nol error. (`npx tsc --noEmit` polos tidak memeriksa apa pun karena `tsconfig.json` root hanya berisi references.)
- Kalau yang diubah backend, verifikasinya `python backend/scripts/smoke_test.py` (harus nol gagal) plus diff `backend/scripts/openapi_snapshot.py` sebelum/sesudah (harus kosong kalau kontrak API tidak diniatkan berubah).
- Tampilkan ringkasan file yang dibuat/diubah.
- JANGAN lanjut ke fase berikutnya tanpa diminta. Akurasi di atas kecepatan.
- Jangan refactor besar tanpa kebutuhan langsung dari user. Pertahankan naming convention yang sudah ada.
- Known issue: Vite dev server (`npm run dev`) bisa mati sendiri tanpa warning jelas. Jika semua API call gagal tapi backend sehat, restart Vite.
