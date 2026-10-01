# Rangkuman Sesi Kerja LoraField

Satu bagian per sesi, urut dari yang paling lama. Tiap bagian mencatat commit yang dibuat di sesi itu, apa yang berubah, keputusan yang diambil, dan apa yang belum dikerjakan saat sesi selesai. Sesi berikutnya dimulai dari commit setelah commit terakhir sesi sebelumnya.

## Sesi 1 (2026-09-27 s/d 2026-09-28)

### Cakupan commit

- Commit dari sesi ini: `99510c8` s/d `c01106e` (11 commit, termasuk `4e5d3d1`).
- Titik awal sebelum sesi: `9ad92f1` "remove carto".
- Semua commit setelah `c01106e` (mulai `e90508f` "Fase 11") bukan dari sesi ini. Rangkuman Sesi 2 dimulai dari `e90508f`.
- Cek cepat: `git log --oneline 9ad92f1..c01106e`

### Catatan soal commit Fase 1 (`99510c8`)

Commit ini berisi sekitar 120 file, tapi yang benar-benar perubahan Fase 1 hanya:

- `backend/app/bmkg.py`
- `backend/app/config.py`
- `backend/app/node_service.py`
- `backend/app/routers/nodes.py`
- `backend/app/routers/farms.py`
- `backend/scripts/smoke_test.py`
- `CLAUDE.md`

Sisanya (frontend, simulator, `routers/valves.py`, `valve_control.py`, dan lainnya) adalah perubahan lama yang belum di-commit sejak sebelum sesi ini, lalu ikut ter-commit bersama. Perubahan lama itu tidak dibuat dan tidak diperiksa di sesi ini.

### Perubahan kode per fase

| Fase | Commit | Isi perubahan | Smoke test |
|------|--------|---------------|------------|
| 1 | `99510c8` | Data sensor tetap tersimpan saat BMKG gangguan. Cuaca lama dipakai sampai 12 jam (`WEATHER_STALE_MAX_HOURS`), jeda percobaan ulang BMKG 5 menit, dan kolom cuaca kosong tidak lagi membuat penyimpanan gagal | 116 ke 123 |
| 2 | `2431339` | Pengaturan penutup tanah per kebun (`open`/`mulch`/`roofed`). Hujan hanya menunda siram untuk tanah terbuka (`effective_rain_next_3h`). Pilihan ada di form Tambah Kebun dan dialog edit Kebun Saya | 130 |
| 3 | `f9a04f7` | Label cuaca lama di web: kata "Sekarang" diganti "Per jam" di kartu Dashboard, baris "Data lama, jam" di halaman Cuaca, dan jam prakiraan yang sudah lewat disembunyikan (`dropPastForecast`) | 130 |
| lain | `4e5d3d1` | Aturan "Claude dilarang menjalankan git commit" di CLAUDE.md (dibuat user) | 130 |
| 4 | `bd91127` | Kode wilayah cuaca diambil dari data kebun. `?adm4=` dari alat hanya cadangan, boleh kosong, dan spasinya dibuang | 137 |
| 5 | `25eb73b` | Siram bertahap mode otomatis (`auto_decision`): pulsa 10 menit, jeda resap 30 menit, maksimal 4 pulsa, target batas atas dikurangi 5, darurat batas bawah dikurangi 15, jeda 3 jam setelah batas pulsa, siklus mulai ulang kalau node sempat offline. Keputusan baru `soaking` dan `pulse_limit` | 156 |
| 6 | `5ffb7e5` | Siram ditunda hanya kalau total prakiraan hujan (`tp` BMKG) minimal 5 mm dalam jendela sekitar 6 jam (`rain_outlook`, `RAIN_DELAY_MIN_MM`). Cadangan kata kunci teks kalau `tp` tidak ada. Kartu cuaca punya kondisi "Hujan Ringan" (minimal 1 mm) | 167 |
| 7 | `fdfcc7b` | Label cuaca BMKG di web memakai teks BMKG lebih dulu, dan tabel kode disesuaikan dengan data asli (dulu "Hujan Ringan" tampil "Hujan Sedang"). Label baru: Hujan Petir, Petir, Udara Kabur, Kabut/Asap | 167 |
| 8 | `6f2ced4` | Keamanan: OTP lupa password wajib disertai email, kode hangus setelah 5 kali salah, login dikunci 15 menit setelah 5 kali gagal, lupa password maksimal 5 per hari, tahan serangan paralel (`BEGIN IMMEDIATE` dan lock), pencatat hanya untuk email terdaftar | 182 |
| 9 | `acb83a4` | Riwayat (`decision_logs`) dari reading hanya ditulis saat `decision_type` node berubah. Indeks baru `idx_decision_logs_node_time` | 185 |
| 10 | `c01106e` | Filter Riwayat per kebun dan tanggal di server (`GET /api/logs`: `farm_id`, `start`, `end`, `limit` sampai 1000). Tanpa filter: 100 log, refresh 30 detik. Dengan filter: sampai 1000 log, tanpa refresh. Bug tanggal "Dari" yang bergeser 7 jam ikut beres | 192 |

### File per fase

- Fase 2: `database.py`, `irrigation.py`, `routers/farms.py`, `routers/nodes.py`, `schemas.py`, `smoke_test.py`, `addFarm/AddFarmPage.tsx`, `addFarm/hooks.ts`, `myFarms/components/MyFarmEditDialog.tsx`, `myFarms/components/MyFarmsView.tsx`, `myFarms/useMyFarmsViewModel.ts`, `lib/groundCover.ts` (baru), `types/index.ts`, `id.json`, `en.json`, `CLAUDE.md`.
- Fase 3: `dashboard/components/WeatherForecastCard.tsx`, `dashboard/dashboardHelpers.ts`, `weather/WeatherPage.tsx`, `weather/weatherHelpers.ts`, `types/index.ts`, `id.json`, `en.json`.
- Fase 4: `routers/nodes.py`, `smoke_test.py`, `backend/README.md`, `CLAUDE.md`.
- Fase 5: `config.py`, `database.py`, `irrigation.py`, `routers/farms.py`, `routers/nodes.py`, `routers/valves.py`, `smoke_test.py`, `simulator/config.example.json`, `irrigation/irrigationHelpers.ts`, `logs/logHelpers.ts`, `lib/status.ts`, `types/index.ts`, `id.json`, `en.json`, `CLAUDE.md`.
- Fase 6: `bmkg.py`, `config.py`, `smoke_test.py`, `dashboard/components/WeatherForecastCard.tsx`, `dashboard/dashboardHelpers.ts`, `weather/constants.ts`, `types/index.ts`, `id.json`, `en.json`, `CLAUDE.md`.
- Fase 7: `weather/weatherHelpers.ts`, `id.json`, `en.json`.
- Fase 8: `database.py`, `routers/auth.py`, `schemas.py`, `smoke_test.py`, `auth/queries.ts`, `auth/useResetPasswordViewModel.ts`, `lib/api.ts`, `backend/README.md`, `docs/SECURITY_AUDIT_AUTH.md`, `CLAUDE.md`.
- Fase 9: `database.py`, `node_service.py`, `smoke_test.py`, `CLAUDE.md`.
- Fase 10: `routers/logs.py`, `smoke_test.py`, `lib/api.ts`, `logs/queries.ts`, `logs/logHelpers.ts`, `logs/useLogsViewModel.ts`, `logs/LogsPage.tsx`, `logs/components/LogsView.tsx`, `logs/components/LogsTableCard.tsx`, `id.json`, `en.json`, `CLAUDE.md`.

### Perubahan di luar repo

- Memory Claude: `hardware-lilygo-lora32.md` (perangkat, sensor, keputusan DHT22), `status-deploy-lokal.md` (aplikasi masih lokal), dan entrinya di `MEMORY.md`.

### Keputusan yang diambil

- AI: hybrid, Cloud AI di server dan TinyML di LoRa32.
- Perangkat: LilyGO LoRa32 untuk gateway dan node; sensor tanah kapasitif, DS18B20, DHT22.
- Irigasi: air mengalir seperti keran, 1 node 1 valve.
- Cuaca lama maksimal 12 jam; batas hujan 5 mm; penutup tanah dipilih user per kebun.
- Label cuaca lama menggantikan kata "Sekarang" di kartu Dashboard (disetujui pemilik).
- DHT22 gagal dibaca: firmware mengirim bacaan valid terakhir, backend tidak diubah.
- Aplikasi masih lokal. File cadangan database di `backend/data/` dihapus sendiri oleh user.

### Belum dikerjakan saat Sesi 1 selesai

- Tautan di email reset memaksa user meminta kode baru.
- Halaman daftar membocorkan email terdaftar (temuan 5 di `docs/SECURITY_AUDIT_AUTH.md`).
- Rancangan format pesan MQTT, firmware, pengaman valve di alat (cacat #5), dan jam baca dari alat (cacat #6).
- Peringatan tanaman khusus (padi, mangga, kopi) dan pengaman mode Manual (opsional).
- Persiapan sebelum publik: `EXPOSE_DEV_TOKENS` False, rate limit di proxy, `X-Forwarded-For` hanya dari proxy sendiri.
- Kalibrasi sensor, uji lapangan, logika pertanian lanjutan, dan fitur AI.
- Belum dilihat langsung di browser: kotak "Hujan Ringan" dan filter tanggal Riwayat.

### Pelajaran dan kesalahan

- Prompt Fase 3b sempat menyuruh Claude commit, lalu riwayat git ditulis ulang user. Sejak itu semua prompt punya larangan commit, dan aturannya masuk CLAUDE.md.
- `npx esbuild` sempat mengunduh paket tanpa izin. Sejak itu pengecekan frontend memakai vite yang sudah terpasang, dijalankan lewat stdin.
- Jebakan teknis yang ditemukan: rollback `get_connection()` membatalkan hitungan kalau error dilempar di dalam blok `with`, serangan paralel menembus batas percobaan, memori pencatat bisa dibanjiri email acak, dan `X-Forwarded-For` bisa dipalsukan.
