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

## Sesi 2 (2026-09-28 s/d 2026-09-29)

### Cakupan commit

- Commit dari sesi ini: `e90508f` s/d `d2f214f` (7 commit, Fase 11 sampai Fase 17).
- Titik awal sebelum sesi: `c01106e` "Fase 10: filter riwayat per kebun dan tanggal".
- Pola kerja sesi ini: sesi perancang membuat prototipe di folder scratchpad, membuktikannya dengan smoke test dan uji versi salah, lalu menulis prompt untuk sesi pelaksana. Setelah user commit, hasilnya diverifikasi ulang di repo (file dibandingkan dengan prototipe, smoke test, diff OpenAPI, tsc, lint, prettier).
- Semua commit setelah `d2f214f` (mulai `e7bf0dc` "new part 3", fitur pengaman tanah basah) bukan dari sesi ini. Rangkuman Sesi 3 dimulai dari `e7bf0dc`.
- Cek cepat: `git log --oneline c01106e..d2f214f`

### Catatan soal commit Fase 12 (`c6ebaf1`)

Commit ini berisi 42 file, tapi yang merupakan Fase 12 hanya:

- `backend/app/database.py`
- `backend/app/mailer.py`
- `backend/app/routers/auth.py`
- `backend/README.md`
- `docs/SECURITY_AUDIT_AUTH.md`
- `frontend/src/lib/api.ts`
- `frontend/src/features/auth/queries.ts`
- `frontend/src/features/auth/useRegisterViewModel.ts`
- `frontend/src/features/auth/components/RegisterView.tsx`
- `frontend/src/i18n/locales/id.json` dan `en.json`
- `backend/app/schemas.py`, `backend/scripts/smoke_test.py`, `CLAUDE.md` (campuran, lihat di bawah)

Sisanya adalah pekerjaan jembatan MQTT, simulator, dan firmware dari sesi lain yang belum di-commit, lalu ikut ter-commit bersama atas keputusan user: `.gitignore`, `config.py`, `main.py`, `mqtt_bridge.py` (baru), `node_service.py`, `reading_service.py` (baru), `routers/nodes.py`, `routers/valves.py`, `valve_control.py`, `requirements.txt`, `docs/kontrak-mqtt.md` (baru), seluruh `firmware/` (baru), dan `simulator/` (`README.md`, `config.example.json`, `environment.py`, `gateway_link.py` baru, `lorafield_sim.py`, `node_model.py`, `test_sim.py` baru, `api_client.py` dihapus). File `schemas.py` (model pesan MQTT), `smoke_test.py` (section "Jembatan MQTT", 21 cek), dan `CLAUDE.md` berisi perubahan dari keduanya. Pekerjaan MQTT itu tidak dibuat di sesi ini, hanya ikut diperiksa lewat smoke test gabungan.

### Perubahan kode per fase

| Fase | Commit | Isi perubahan | Smoke test |
|------|--------|---------------|------------|
| 11 | `e90508f` | Tautan di email reset membawa email di fragmen URL (`#email=`, tidak terkirim ke server), jadi halaman reset langsung membuka isian kode tanpa meminta kode baru. Tombol "Sudah punya kode?" di langkah isian email | 192 ke 193 |
| 12 | `c6ebaf1` | Verifikasi email saat daftar. `POST /api/auth/register` selalu 202 dengan pesan sama untuk email apa pun. Kode 6 digit memakai tabel `password_resets`. Endpoint baru `POST /api/auth/register/verify`: nama, password, dan bahasa disimpan di langkah ini supaya pendaftar lebih dulu tidak bisa membajak akun. Login akun belum verifikasi ditolak 403. Reset password ikut memverifikasi akun. Kolom baru `users.email_verified_at`, akun lama diisi `created_at` sekali saat kolom dibuat. Password di-hash di semua jalur, email dikirim di background, dan isi email tanpa input pengguna | 210 (Fase 12) dan 231 setelah ditambah cek MQTT |
| 13 | `c926c65` | Pesan error validasi 422 dari server tampil terbaca (gabungan `msg`), tidak lagi "[object Object]" (`detailMessage` di `apiFetch`) | 231 |
| 14 | `6fe6902` | Nama bawaan node = `Node` + 4 karakter terakhir ID (sesuai stiker alat). Endpoint baru `PATCH /api/nodes/{id}/name`. Nama dari gateway MQTT hanya dipakai saat node pertama terdaftar. Nama lama `Node <ID utuh>` diganti saat startup. Ikon pensil dan dialog ganti nama di kartu node halaman Irigasi | 239 |
| 15 | `de7a050` | Saat kebun dihapus atau gateway dilepas, server mengirim isi kosong (retain) ke `valve/set` tiap node, jadi perintah lama terhapus di broker dan valve ditutup gateway | 244 |
| 16 | `ae2fe7f` | Server mengirim ulang `valve/set` kalau alat masih melapor posisi valve lain minimal `VALVE_RESEND_MINUTES` (default 5) menit setelah perintah terakhir dikirim | 247 |
| 17 | `d2f214f` | Akun yang tidak diverifikasi dalam 7 hari (dan tanpa kebun) dihapus saat ada pendaftaran berikutnya. Login: email tak dikenal, password salah, dan akun terkunci dibalas sama (401, pesan sama, bcrypt tetap jalan lewat hash acak). Lupa password tanpa 429, lewat batas tetap 200 tanpa kode, email dikirim di background | 251 |

### File per fase

- Fase 11: `routers/auth.py`, `smoke_test.py`, `backend/README.md`, `auth/useResetPasswordViewModel.ts`, `auth/components/ResetPasswordView.tsx`, `id.json`, `en.json`, `CLAUDE.md`.
- Fase 12: `database.py`, `schemas.py`, `mailer.py`, `routers/auth.py`, `smoke_test.py`, `backend/README.md`, `lib/api.ts`, `auth/queries.ts`, `auth/useRegisterViewModel.ts`, `auth/components/RegisterView.tsx`, `id.json`, `en.json`, `CLAUDE.md`, `docs/SECURITY_AUDIT_AUTH.md` (lihat catatan commit `c6ebaf1` di atas).
- Fase 13: `lib/api.ts`.
- Fase 14: `database.py`, `mqtt_bridge.py`, `node_service.py`, `routers/nodes.py`, `schemas.py`, `smoke_test.py`, `irrigation/components/IrrigationNodeCard.tsx`, `irrigation/components/NodeNameDialog.tsx` (baru), `irrigation/queries.ts`, `lib/api.ts`, `id.json`, `en.json`, `CLAUDE.md`, `docs/kontrak-mqtt.md`.
- Fase 15: `mqtt_bridge.py`, `routers/farms.py`, `routers/gateways.py`, `smoke_test.py`, `CLAUDE.md`, `docs/kontrak-mqtt.md`.
- Fase 16: `config.py`, `mqtt_bridge.py`, `smoke_test.py`, `backend/README.md`, `CLAUDE.md`, `docs/kontrak-mqtt.md`.
- Fase 17: `routers/auth.py`, `smoke_test.py`, `CLAUDE.md`, `docs/SECURITY_AUDIT_AUTH.md`.

### Perubahan di luar repo

- Mosquitto: dua baris ditambahkan user di `C:\Program Files\mosquitto\mosquitto.conf` (`persistence true`, `persistence_location C:/mosquitto-data/`), folder `C:\mosquitto-data` dibuat, cadangan konfigurasi asli di `C:\mosquitto-data\mosquitto.conf.bak`, lalu service di-restart. `mosquitto.db` sudah muncul di folder itu.
- Memory Claude: `todo-lorafield.md` dan `pola-prompt-ketat.md` (baru), `rencana-mqtt-simulator.md` (catatan Fase 15 dan 16 sudah selesai), dan entrinya di `MEMORY.md`. Kedua file baru itu kemudian diperbarui lagi oleh sesi lain.
- Prompt Fase 11 sampai Fase 17 dan prototipenya disimpan di folder scratchpad sesi (sementara, bukan bagian repo).
- Backend di-restart user setelah Fase 14 sampai Fase 17.

### Keputusan yang diambil

- Fase 11: email di tautan reset diletakkan di fragmen `#`, bukan query, supaya tidak tercatat di log server. Kode reset tidak dimasukkan ke tautan.
- Fase 12: email yang sudah terdaftar tidak dikirimi email pemberitahuan; halaman daftar cukup menjelaskan bahwa kode tidak dikirim kalau email sudah punya akun. Fase 12 dan pekerjaan MQTT di-commit bersama (keputusan user).
- Fase 14: isi stiker node = 4 karakter terakhir ID alat. Tombol ganti nama ditaruh di halaman Irigasi, bukan di Ringkasan Kebun yang layout-nya terkunci.
- Fase 15: penanganan yang sama berlaku untuk hapus kebun dan lepas gateway, karena akar masalahnya sama.
- Fase 16: jeda kirim ulang 5 menit, bisa diatur lewat `.env`.
- Fase 17: akun belum verifikasi dihapus setelah 7 hari, hanya kalau tidak punya kebun. Pesan login gagal digabung: "Email atau password salah. Setelah 5 kali salah, login dikunci 15 menit."
- Mosquitto memakai penyimpanan permanen, supaya perintah valve retain tidak hilang saat broker atau PC restart.
- Usulan angka pengaman sensor rusak: periksa setelah 2 pulsa, sensor dianggap bermasalah kalau kelembapan naik kurang dari 2 poin, angka bisa diatur lewat `.env`.

### Belum dikerjakan saat Sesi 2 selesai

Item dari daftar Sesi 1:

- Tautan di email reset memaksa user meminta kode baru: selesai di Fase 11.
- Halaman daftar membocorkan email terdaftar: selesai di Fase 12. Sisa kebocoran lewat 429 login dan lupa password ditutup di Fase 17.
- Rancangan format pesan MQTT dan firmware: selesai, tapi dikerjakan di sesi lain lalu ikut ter-commit di `c6ebaf1`. Pengaman valve di alat (cacat #5) masuk firmware: node menutup valve sendiri saat waktu `until` habis. Jam baca dari alat (cacat #6) belum: kontrak memilih membuang data lama saat koneksi putus.
- Peringatan tanaman khusus (padi, mangga, kopi): belum.
- Pengaman mode Manual saat tanah terlalu basah: belum di sesi ini. Fitur pengaman tanah basah dibuat sesi lain dan saat sesi ini selesai masih belum di-commit (16 file).
- Persiapan sebelum publik: belum.
- Kalibrasi sensor, uji lapangan, logika pertanian lanjutan, dan fitur AI: belum.
- Belum dilihat langsung di browser: kotak "Hujan Ringan" dan filter tanggal Riwayat (data lama).

Item baru:

- Pengaman sensor rusak: hentikan siram otomatis kalau kelembapan tidak naik setelah disiram.
- Nama koneksi MQTT backend (`client_id` masih `lorafield-server`) bisa diatur.
- (opsional) Siram otomatis tidak melewati batas atas.
- Rapikan dokumen: nomor baris yang tidak akurat di CLAUDE.md (termasuk kalimat Fase 15 yang terletak setelah nomor baris di baris DELETE kebun), dan tiga bagian lama di `docs/SECURITY_AUDIT_AUTH.md` (temuan 2 masih menyebut 429, contoh "Testing the Fixes", judul temuan 5 masih "OPEN").
- User mengisi `FRONTEND_URL` di `backend/.env` supaya email reset punya tombol tautan.
- Kirim `docs/kontrak-mqtt.md` ke tim IoT, tambahkan aturan "gateway mengulang perintah" (butuh persetujuan user), dan beri tahu isi stiker node.
- (opsional) Hapus kebun uji lama: "Kebun Fase 3 Test", "Kebun Fase 3b 936", "Kebun Test Auto-Resolve 310".
- Commit fitur pengaman tanah basah (16 file dari sesi lain), lalu restart backend dan simulator.

### Pelajaran dan kesalahan

- Prompt Fase 12 sekitar 1.240 baris terpotong saat ditempel ke sesi pelaksana. Pelaksana berhenti dengan benar, dan sisa prompt dikirim terpisah. Sejak itu prompt dibuat lebih ringkas.
- Teks dokumen di prompt Fase 12 (bagian 12e) memakai backtick di dalam backtick sehingga rusak. Pelaksana memperbaikinya dengan tepat. Sejak itu teks dokumen di prompt ditaruh di blok `text` terpisah.
- Uji versi salah menemukan tes yang lemah: tes kegagalan kirim email (V10) awalnya tidak menangkap error dari background task karena klien uji menelannya. Diganti klien uji ketat sebelum masuk prompt.
- Docstring di endpoint register ikut masuk ke dokumentasi API (OpenAPI). Diganti komentar biasa supaya kontrak API hanya berubah seperlunya.
- Alat edit sempat mengubah teks `\u2014` di prompt menjadi em dash asli. Ditemukan lewat pengecekan dan dikembalikan.
- Prototipe frontend memakai `node_modules` yang sama dengan proyek, sehingga cache Vite dev server user tertimpa dan halaman `localhost:5173` putih (504 Outdated Optimize Dep). Diperbaiki user dengan `npm run dev -- --force`.
- Pemeriksa izin otomatis untuk perintah terminal beberapa kali gangguan. Pelaksana Fase 14 berhenti sebelum mengubah file; sesi perancang beralih ke pengecekan baca saja.
- Sesi pelaksana Fase 14 sampai Fase 16 lupa menulis kalimat wajib soal git. Dipastikan lewat riwayat git bahwa hanya user yang commit.
- Fase 12 sempat tercampur di working tree dengan pekerjaan MQTT dari sesi lain, lalu di-commit bersama.
- Prompt serah terima pertama dibuka di sesi cloud (clone dari GitHub), sehingga file yang belum di-commit, memori proyek, Mosquitto, dan simulator tidak terlihat. Sesi lanjutan harus dibuka sebagai sesi lokal.
- Daftar dari sesi lain menyebut 14 file belum di-commit, padahal 16. Klaim dari sesi lain selalu dicek ulang ke repo.
- Temuan lain saat uji: validator email backend menolak domain `.test`, dan error 422 tampil "[object Object]" (diperbaiki di Fase 13).

## Sesi 3 (2026-09-28 s/d 2026-10-01)

### Cakupan commit

- Commit dari sesi ini: `e7bf0dc` "new part 3" (1 commit, fitur pengaman tanah basah).
- Titik awal sebelum sesi: `d2f214f` "Fase 17: hapus akun belum verifikasi dan tutup kebocoran email di login".
- Sesi ini berjalan bersamaan dengan Sesi 2 sejak 2026-09-28. Pekerjaan utamanya (jembatan MQTT, simulator, firmware, dan perbaikan setelah analisis) sudah lebih dulu ter-commit di `c6ebaf1`, yang masuk cakupan Sesi 2. Lihat catatan di bawah.
- Sesi ini memakai penomoran sendiri (Fase 1 sampai Fase 4 untuk MQTT, lalu Langkah 1 sampai Langkah 3 setelah analisis), tidak sama dengan nomor fase di nama commit. Di tabel ditulis "MQTT 1" sampai "MQTT 4" dan "Langkah 1" sampai "Langkah 3" supaya tidak tertukar dengan Fase 1 sampai Fase 17.
- Semua commit setelah `e7bf0dc` (mulai `61f0abe` "commit codex,gemini,claude" sampai `59f36f8` "docs: rangkuman sesi 1") bukan dari sesi ini, dan tidak ada yang menyentuh file sesi ini (simulator, firmware, `mqtt_bridge.py`, `docs/kontrak-mqtt.md`, kartu valve). Rangkuman sesi berikutnya dimulai dari `61f0abe`.
- Cek cepat: `git log --oneline d2f214f..e7bf0dc` dan `git show --stat c6ebaf1`.

### Catatan soal commit `c6ebaf1`

Commit `c6ebaf1` "fase 12 done, and mqtt" (2026-09-28 18:34) berisi 42 file. Selain file Fase 12 (lihat catatan di Sesi 2), commit itu membawa pekerjaan sesi ini:

- `.gitignore`
- `backend/app/config.py`, `backend/app/main.py`, `backend/app/mqtt_bridge.py` (baru), `backend/app/node_service.py`, `backend/app/reading_service.py` (baru), `backend/app/routers/nodes.py`, `backend/app/routers/valves.py`, `backend/app/valve_control.py`, `backend/requirements.txt`
- `docs/kontrak-mqtt.md` (baru)
- seluruh `firmware/` (baru, 9 file)
- `simulator/README.md`, `simulator/config.example.json`, `simulator/environment.py`, `simulator/gateway_link.py` (baru), `simulator/lorafield_sim.py`, `simulator/node_model.py`, `simulator/test_sim.py` (baru), `simulator/api_client.py` (dihapus)
- `backend/app/schemas.py` (model pesan MQTT), `backend/scripts/smoke_test.py` (section "Jembatan MQTT", 21 cek), dan `CLAUDE.md`, yang berisi campuran Fase 12 dan pekerjaan sesi ini.

Commit `e7bf0dc` hanya berisi pekerjaan sesi ini (16 file).

### Perubahan kode per fase

| Fase | Commit | Isi perubahan | Smoke test |
|------|--------|---------------|------------|
| MQTT 1 | `c6ebaf1` | Kontrak MQTT `docs/kontrak-mqtt.md`: lima topik di bawah `lorafield/gw/{gw}/` (status dengan Last Will, heartbeat, nodes, reading, `valve/set`), isi pesan JSON, aturan ID 4–32 karakter, `valve/set` retain dengan jam tutup mutlak `until` sebagai pengaman, dan konfirmasi lewat field `valve` di reading | 210 (tanpa perubahan kode) |
| MQTT 2 | `c6ebaf1` | Jembatan MQTT di backend (`mqtt_bridge.py`, paho-mqtt): terima status, heartbeat, nodes, dan reading dari gateway yang sudah diklaim; kirim `valve/set` hanya saat isinya berubah; `valve_command_sent_at` diisi saat posisi valve yang dilaporkan sama dengan perintah; route valve langsung mengirim perintah. Logika keputusan reading dipindah ke `reading_service.py` supaya dipakai HTTP dan MQTT. Jembatan nonaktif kalau `MQTT_HOST` kosong | 210 ke 226 |
| MQTT 3 | `c6ebaf1` | Simulator jadi gateway MQTT: tanpa akun dan tanpa HTTP, ID `SIM-`, Last Will, heartbeat, perintah valve diteruskan ke node dengan pengaman waktu tutup, cuaca langsung dari BMKG, perintah `run` dan `reset`, state lama dimigrasi (gateway `SIM-GW-7585bd` dipertahankan) | 226 (backend tidak berubah) |
| MQTT 4 | `c6ebaf1` | Firmware PlatformIO untuk LilyGO LoRa32 (`ttgo-lora32-v21`): gateway (LoRa ke MQTT, NTP, Last Will, kirim ulang perintah setelah node mengirim data kalau posisi valve berbeda) dan node (DS18B20, DHT22, sensor tanah kapasitif, relay, timer valve maksimal 1 jam per perintah). Logika bersama di `lib/lorafield` dites di PC | 226; firmware 10/10, compile gateway dan node lolos |
| Langkah 1 | `c6ebaf1` | Perbaikan hasil analisis: simulator tidak mengejar putaran setelah laptop sleep, nama bawaan node memakai ID utuh (kemudian diganti Fase 14), mode kebun dibaca ulang setelah menunggu BMKG, ID node dicek dengan `fullmatch`, tanda terkirim dikosongkan lagi kalau alat melapor posisi berbeda, timer valve firmware tahan urutan `millis()`, RSSI firmware dibatasi ke rentang -150 sampai 0, gateway simulasi mengulang perintah seperti firmware, cuaca simulasi pindah ke kurva cadangan saat prakiraan habis, node yang mati tidak membuka valve | 226 ke 231 |
| Langkah 2 | `c6ebaf1` | Realisme kebun di simulator: air merembes ke sensor dengan jeda 20 menit (rumus eksak), kapasitas lapang 85%, penguapan ikut matahari (malam hampir nol) dan tutupan awan `tcc`, hujan dari `tp` BMKG dikali paparan penutup tanah (`ground_cover`), jadwal kirim per node dengan jeda acak | 231 (backend tidak berubah) |
| Langkah 3 | `c6ebaf1` | Baterai simulasi dihitung dari arus sesuai firmware (60 mA, relay 70 mA, panel 350 mA, 3000 mAh, awan dari `tcc`), RAM firmware hilang saat node menyala ulang, WiFi gateway putus acak dengan Last Will, sensor rusak acak, opsi `run --fault soil-dry` dan `run --fault dht22-dead` | 231 (backend tidak berubah) |
| Jenuh | `e7bf0dc` | Pengaman tanah basah: web memberi peringatan mulai 92% (konfirmasi dua langkah di tombol Jalankan Pengairan, peringatan per node di panel Atur Valve). Reading mulai 98% (`SOIL_SATURATION_STOP_PCT`) menutup valve manual dengan keputusan baru `manual_saturated`, dan perintah buka ditolak 409. Batas tanah simulator dinaikkan dari 95% ke 100% | 251 ke 256 |

### File per fase

- MQTT 1: `docs/kontrak-mqtt.md` (baru).
- MQTT 2: `config.py`, `schemas.py`, `main.py`, `mqtt_bridge.py` (baru), `reading_service.py` (baru), `routers/nodes.py`, `routers/valves.py`, `valve_control.py`, `requirements.txt`, `smoke_test.py`, `CLAUDE.md`.
- MQTT 3: `simulator/lorafield_sim.py`, `simulator/node_model.py`, `simulator/environment.py`, `simulator/config.example.json`, `simulator/README.md`, `simulator/gateway_link.py` (baru), `simulator/test_valve.py` (baru, diganti nama jadi `test_sim.py` di Langkah 1), `simulator/api_client.py` (dihapus), `docs/kontrak-mqtt.md`, `CLAUDE.md`.
- MQTT 4: `firmware/platformio.ini`, `firmware/include/config.h`, `firmware/include/secrets.example.h`, `firmware/lib/lorafield/src/lorafield.h`, `firmware/lib/lorafield/src/lorafield.cpp`, `firmware/src/gateway/main.cpp`, `firmware/src/node/main.cpp`, `firmware/test/test_logic/test_main.cpp`, `firmware/README.md` (semua baru), `.gitignore`, `CLAUDE.md`.
- Langkah 1: `mqtt_bridge.py`, `node_service.py`, `routers/nodes.py`, `smoke_test.py`, `firmware/lib/lorafield/src/lorafield.cpp`, `firmware/test/test_logic/test_main.cpp`, `simulator/lorafield_sim.py`, `simulator/environment.py`, `simulator/test_sim.py`, `simulator/README.md`, `CLAUDE.md`.
- Langkah 2: `simulator/environment.py`, `simulator/node_model.py`, `simulator/lorafield_sim.py`, `simulator/config.example.json`, `simulator/test_sim.py`, `simulator/README.md`, `CLAUDE.md`.
- Langkah 3: `simulator/node_model.py`, `simulator/environment.py`, `simulator/lorafield_sim.py`, `simulator/gateway_link.py`, `simulator/config.example.json`, `simulator/test_sim.py`, `simulator/README.md`, `CLAUDE.md`.
- Jenuh: `config.py`, `irrigation.py`, `reading_service.py`, `routers/valves.py`, `valve_control.py`, `smoke_test.py`, `dashboard/components/ValveStatCard.tsx`, `dashboard/components/ValveControlSheet.tsx`, `dashboard/dashboardHelpers.ts`, `logs/logHelpers.ts`, `lib/status.ts`, `types/index.ts`, `id.json`, `en.json`, `simulator/config.example.json`, `CLAUDE.md`.

### Perubahan di luar repo

- Mosquitto 2.1.2 dipasang lewat winget sebagai service Windows (otomatis jalan, hanya localhost, tanpa password).
- `paho-mqtt` 2.1.0 dipasang ke venv backend dan ke Python sistem (untuk simulator).
- `backend/.env`: ditambah `MQTT_HOST=127.0.0.1`.
- `simulator/config.json` (tidak ikut git): dibuat user, lalu dirapikan di sesi ini menjadi kebun "Kebun Sawit" (key `Kebun Faiz`), lokasi Padang Leban, Tanjung Kemuning, Kaur, Bengkulu (kode BMKG `17.04.02.2012`), tanah terbuka, 4 node, dan batas tanah 100%.
- `simulator/.state.json` (tidak ikut git): dimigrasi ke format baru saat simulator dijalankan, dan akhiran barisnya sempat dinormalisasi ke LF (isi sama).
- Library firmware diunduh PlatformIO ke `firmware/.pio/` (diabaikan git). PlatformIO dan toolchain ESP32 sudah ada sebelum sesi ini.
- Data di database dev: user menghapus kebun demo lama "Kebun Cabai Balecatur" dan membuat "Kebun Sawit Faiz 1" (`farm-f4cb90db`, gateway `SIM-GW-89706d`). Backend di-restart user pada 2026-09-28 18:18 sehingga MQTT aktif.
- Memory Claude: `rencana-mqtt-simulator.md` (baru, diperbarui tiap fase), `hardware-lilygo-lora32.md` (firmware sudah ada, listrik PLN, angka deep sleep board), dan entrinya di `MEMORY.md`.
- Skrip uji sesi ini (uji ujung ke ujung lewat Mosquitto, simulasi dipercepat, probe bug) disimpan di folder scratchpad sesi (sementara, bukan bagian repo).

### Keputusan yang diambil

- Format MQTT dibuat sesi ini lalu diserahkan ke tim IoT. Broker Mosquitto. Semua data alat lewat MQTT, alat tidak memakai akun pengguna. Kebun simulasi didaftarkan lewat web memakai ID gateway, simulator tidak membuat kebun sendiri.
- Lingkup: kode dan firmware sampai tahap simulasi, alat riil dikesampingkan.
- Perintah valve memakai jam tutup mutlak (`until`, epoch UTC) supaya kiriman ulang tidak memperpanjang siram. Node menutup valve sendiri saat waktunya habis.
- Gateway dan node memakai board yang sama (LilyGO T3 v1.6.1), ID dari MAC (`GW-` dan `ND-`), paket LoRa biner 18 dan 13 byte.
- Simulator memisahkan "dunia" (cuaca BMKG, tanah, hujan, matahari) dari "alat" (perilaku firmware). Angka model tanah dan baterai adalah perkiraan dan bisa diatur di config.
- Mode hemat daya (deep sleep) ditunda: board LilyGO T3 v1.6.1 terukur 8–9 mA saat tidur, dan solenoid 12V biasa sekitar 320 mA saat terbuka. Node memakai listrik PLN lewat kabel DC 12V atau 24V dari adaptor di sumber.
- Pengaman tanah basah: peringatan mulai 92% di web, valve berhenti otomatis mulai 98% di mode apa pun. Konfirmasi memakai pola dua langkah yang sama dengan ganti mode, supaya layout kartu Status Valve tidak berubah.

### Belum dikerjakan saat Sesi 3 selesai

Item dari daftar Sesi 2:

- Pengaman sensor rusak: tidak dikerjakan di sesi ini. Dikerjakan di luar sesi ini (commit `2369808`).
- Nama koneksi MQTT backend bisa diatur: belum. Sesi ini membuktikan masalahnya: backend dev dan backend uji dengan `client_id` sama saling menendang di broker.
- (opsional) Siram otomatis tidak melewati batas atas: belum. Simulasi dipercepat sesi ini menunjukkan puncak 81,3% untuk Cabai (batas atas 80%) karena air pulsa terakhir masih merembes.
- Rapikan dokumen (nomor baris CLAUDE.md, bagian lama `docs/SECURITY_AUDIT_AUTH.md`): belum.
- `FRONTEND_URL` di `backend/.env`: belum.
- Kirim `docs/kontrak-mqtt.md` ke tim IoT, tambah aturan "gateway mengulang perintah" (butuh persetujuan user), beri tahu isi stiker node: belum.
- (opsional) Hapus kebun uji lama: belum (ketiganya masih ada saat diperiksa 2026-09-29).
- Commit fitur pengaman tanah basah: selesai, dibuat di sesi ini dan di-commit user di `e7bf0dc`. Restart backend dan simulator sesudahnya tidak diperiksa di sesi ini.
- Pengaman mode Manual saat tanah terlalu basah (dari daftar Sesi 1): selesai di `e7bf0dc`.
- Jam baca dari alat (cacat #6), peringatan tanaman khusus, persiapan sebelum publik, kalibrasi dan uji lapangan, fitur AI, cek "Hujan Ringan" di browser: belum.

Item baru:

- Tim IoT: cocokkan pin dan kalibrasi di `firmware/include/config.h`, tentukan jenis valve (biasa atau latching), cek daya pancar (bawaan library 17 dBm, batas pita 920–923 MHz Indonesia perlu dicek), uji firmware di alat asli, ukur arus alat asli.
- Firmware gateway melewatkan paket LoRa saat sibuk (mode dengar sekali jalan, sambung MQTT memblokir sekitar 3 detik saat broker mati). Catatan untuk alat asli.
- Keamanan LoRa: paket belum dienkripsi atau diautentikasi, jadi perintah valve bisa dipalsukan dan node baru bisa terdaftar ke gateway tetangga.
- Sebelum produk dijual: server online dengan Mosquitto ikut di paket server (Docker belum berisi Mosquitto, dan `MQTT_HOST=127.0.0.1` salah di dalam container), password dan TLS broker, pengaturan WiFi gateway lewat HP, kartu ID atau QR dan kode klaim, sertifikasi SDPPI, update firmware jarak jauh (OTA), peringatan otomatis, casing tahan air, instalasi kabel PLN yang aman, database yang lebih kuat.
- Nanti: mode hemat daya untuk versi baterai atau panel surya, gateway sekaligus node untuk kebun kecil.

### Pelajaran dan kesalahan

- Analisis mendalam menemukan bug yang lolos dari tes awal, semuanya dibuktikan lewat percobaan: simulator mengejar putaran yang terlewat setelah laptop sleep (jam `GetTickCount64` ikut berjalan saat sleep), nama node kembar dari awalan MAC yang sama, mode kebun basi selama menunggu BMKG, `re.match` dengan `$` menerima ID berakhiran baris baru, dan timer valve firmware yang langsung menutup karena selisih `millis()` unsigned. Tes firmware awal tidak menangkapnya karena tidak meniru urutan di `loop()`.
- Rumus rembesan versi pertama memberi hasil berbeda tergantung panjang langkah waktu. Ketahuan lewat tes yang memajukan waktu 10 menit sekaligus, lalu diganti rumus eksak.
- Skrip uji sendiri beberapa kali salah (pulsa pertama tidak terhitung, langkah 8 jam terpotong `max_step_hours`, urutan cek DHT22). Setiap hasil yang tidak masuk akal ditelusuri sampai ketemu penyebabnya sebelum disimpulkan.
- Patch lewat heredoc di terminal mengubah `\n` di dalam teks menjadi baris baru asli. Sejak itu patch ditulis ke file skrip lalu dijalankan.
- `Path.write_text` di Windows menulis akhiran baris CRLF, padahal repo memakai LF. File dikembalikan ke LF; normalisasi itu ikut menyentuh `simulator/.state.json` (isinya tetap sama).
- Perkiraan baterai "berbulan-bulan" dengan deep sleep terlalu optimis. Setelah dicek ke sumber pengukuran, angkanya dikoreksi ke user (board 8–9 mA saat tidur, perkiraan sekitar 1,5–2 minggu dengan 3000 mAh).
- Uji ujung ke ujung sempat gagal 4 dari 13 karena backend dev user dan backend uji memakai `client_id` MQTT yang sama. Dengan `client_id` berbeda lolos 13 dari 13. Selama sekitar 1 menit backend dev sempat terputus-sambung dari broker.
- Pemeriksa izin otomatis beberapa kali gangguan (Edit, Bash, pencarian web). Perubahan diterapkan lewat skrip dan pencarian diulang setelah pulih.
- Config simulator dari user sempat berisi nilai yang tidak dikenali (`ground_cover` "Closed") dan key kebun yang sudah dipakai kebun demo. Ditangkap sebelum simulator dijalankan.
- Firmware hanya dibuktikan sampai compile dan tes logika di PC. Belum pernah dicoba di alat asli.

## Sesi 4 (2026-09-29 s/d 2026-10-01)

### Cakupan commit

- Commit dalam cakupan sesi ini: `61f0abe` s/d `4ce3212` (9 commit). Tidak semuanya dibuat di sesi ini, lihat catatan di bawah.
- Titik awal sebelum sesi: `e7bf0dc` "new part 3" (akhir Sesi 3). Sesi ini dimulai dari serah terima pada 2026-09-29 dengan HEAD `d2f214f` dan 16 file pengaman tanah basah yang belum di-commit; user meng-commit-nya menjadi `e7bf0dc` sebelum pekerjaan sesi ini dimulai.
- Pola kerja berubah di tengah sesi. Awalnya sesi ini menjadi perancang: memeriksa klaim dan hasil kerja ke repo, lalu menulis prompt untuk Codex (user pindah ke Codex untuk eksekusi). Sejak Irigasi Terbatas, user meminta sesi ini menulis kode langsung (tanpa commit), sedangkan Codex dipakai untuk review dan tugas kecil. Satu sesi Claude Code lain memperbaiki temuan review Codex.
- Semua commit setelah `4ce3212` (mulai `59f36f8` "docs: rangkuman sesi 1" dan `cddc46c` "docs: rangkuman sesi 3") bukan dari sesi ini. Rangkuman sesi berikutnya dimulai dari `59f36f8`.
- Cek cepat: `git log --oneline e7bf0dc..4ce3212`

### Catatan soal asal commit

- `61f0abe` "commit codex,gemini,claude": aturan kerja agen lain (`AGENTS.md`, `GEMINI.md`, `scripts/guard_diff.py`). Dibuat di luar sesi ini. Sesi ini hanya membaca `AGENTS.md` dan memakai `guard_diff.py` untuk verifikasi.
- `76cae63` dan `26d2d50` (keduanya "fix"): pengaman "Periksa penyiraman" versi pertama, dikerjakan Codex di luar sesi ini. Sesi ini memeriksanya dan menemukan kelemahan yang diperbaiki di `2369808`.
- `445b0dc` "fix": perbaikan Riwayat, dikerjakan Codex dari dua cacat yang ditemukan sesi ini. Diperiksa sesi ini sebelum di-commit.
- `2369808`: dikerjakan Codex dari prompt sesi ini, lalu diverifikasi ulang di repo.
- `0d25d05`, `340c80d`, `4ce3212`: dibuat di sesi ini.
- `99d31d2`: dikerjakan sesi Claude Code lain dari hasil review Codex atas `0d25d05`. Sesi ini hanya memeriksa hasilnya (smoke test, dan memastikan web tidak pernah mengirim perubahan tanaman).

### Perubahan kode per fase

| Fase | Commit | Isi perubahan | Smoke test |
|------|--------|---------------|------------|
| lain | `61f0abe` | Aturan kerja untuk Codex dan Gemini: larangan commit, PRA-CEK sebelum edit, zona sensitif, daftar file terlarang, dan pemeriksa diff `guard_diff.py` (cek commit, file terkunci, warna hex, em dash, dan lainnya) | 256 (backend tidak berubah) |
| Periksa 1 | `76cae63` | Pengaman "Periksa penyiraman" (`check_irrigation`): siram otomatis node dijeda kalau kelembapan tidak naik setelah 2 pulsa yang terkonfirmasi lewat laporan valve MQTT. Kolom baru `auto_cycle_baseline`, `auto_confirmed_pulse_count`, `auto_paused_at`; pengaturan `AUTO_NO_RISE_PULSES`; endpoint `POST /api/nodes/{id}/irrigation/resume`; tombol "Aktifkan lagi" di halaman Irigasi dan peringatan di Dashboard di atas Ringkasan Kebun | 256 ke 269 |
| Periksa 1b | `26d2d50` | Summary tidak lagi memajukan pulsa atau menjeda node (`advance_after_soak=False`), dan cek jeda tidak lagi mensyaratkan laporan valve di reading terakhir | 274 |
| Riwayat | `445b0dc` | Kolom Waktu Riwayat menampilkan tanggal, dan tahun 5 digit di filter tanggal tidak lagi membuat halaman error | 274 (frontend saja) |
| Periksa 2 | `2369808` | Jeda dicek di setiap akhir masa resap mulai pulsa ke-2, dengan syarat kenaikan kurang dari `AUTO_NO_RISE_MIN_POINTS` (default 2 poin), bukan "tidak naik sama sekali". Sensor lepas dalam simulasi 1000 kali tertangkap 1000, sebelumnya sekitar 52%. CLAUDE.md mencatat endpoint, kolom, dan aturan jeda yang tetap berlaku walau mode diganti | 274 ke 284 |
| Terbatas A | `0d25d05` | Irigasi Terbatas di backend (`limited_irrigation.py`): per kebun, batas bawah dan atas siram otomatis turun `LIMITED_IRRIGATION_DROP_POINTS` (default 10) sampai tanggal selesai (maksimal `LIMITED_IRRIGATION_MAX_DAYS`, default 28), selesai sendiri saat tanggal lewat, hanya bisa dimulai di mode otomatis dan bukan padi, tetap berjalan saat mode manual. Kolom baru `farms.limited_until`, `farms.limited_reason`, `decision_logs.limited_until`, `decision_logs.limited_reason`. Endpoint `POST`, `PATCH`, `DELETE /api/farms/{id}/limited-irrigation`. Mulai, ubah tanggal, dihentikan, dan selesai tercatat di Riwayat per node. `summary.thresholds` tetap batas tanaman | 284 ke 307 |
| Terbatas B | `340c80d` | Tampilan Irigasi Terbatas: kartu di halaman Irigasi (Mulai dengan pilihan alasan berbunga 3 minggu, menjelang panen 2 minggu, lainnya 1–4 minggu, tanggal selesai, konfirmasi, Ubah tanggal, Hentikan, tanda tanya yang bisa ditekan), catatan padi, tanda "Irigasi Terbatas sampai ..." di Dashboard di atas Ringkasan Kebun, dan label baris Irigasi Terbatas di Riwayat. Teks alasan "Periksa penyiraman" diganti "belum naik cukup" | 307 (frontend saja) |
| Terbatas fix | `99d31d2` | Enam temuan review Codex: permintaan bersamaan antre (`BEGIN IMMEDIATE`), bacaan sensor memakai periode Irigasi Terbatas terbaru, padi selalu memakai batas normal, Riwayat "selesai" dan "dihentikan" membawa tanggal dan alasan, catatan memakai data sampai waktu kejadian, tanggal ekstrem ditolak 422. Aturan baru: jenis tanaman kebun tidak bisa diganti lewat `PATCH /api/farms/{id}` (422 kalau berbeda) | 307 ke 323 |
| Riwayat 422 dan Bantuan | `4ce3212` | Filter tanggal ekstrem di `GET /api/logs` ditolak 422, bukan error server. `crop_type` dihapus dari `UpdateFarmPayload` web. Pusat Bantuan mendapat bagian "Panduan Fitur" berisi penjelasan lengkap Irigasi Terbatas (komponen bersama `LimitedIrrigationHelp`, dipakai juga tanda tanya), dan dialognya bisa digulir | 323 ke 325 |

### File per fase

- lain: `AGENTS.md` (baru), `GEMINI.md`, `scripts/guard_diff.py` (baru).
- Periksa 1: `config.py`, `database.py`, `irrigation.py`, `reading_service.py`, `routers/valves.py`, `smoke_test.py`, `dashboard/DashboardPage.tsx`, `irrigation/IrrigationPage.tsx`, `irrigation/queries.ts`, `logs/logHelpers.ts`, `lib/api.ts`, `lib/status.ts`, `types/index.ts`, `id.json`, `en.json`.
- Periksa 1b: `irrigation.py`, `routers/farms.py`, `smoke_test.py`.
- Riwayat: `logs/logHelpers.ts`.
- Periksa 2: `config.py`, `irrigation.py`, `smoke_test.py`, `CLAUDE.md`.
- Terbatas A: `config.py`, `crops.py`, `database.py`, `limited_irrigation.py` (baru), `reading_service.py`, `routers/farms.py`, `routers/valves.py`, `schemas.py`, `smoke_test.py`, `CLAUDE.md`.
- Terbatas B: `dashboard/DashboardPage.tsx`, `dashboard/components/DashboardWarningCard.tsx`, `irrigation/IrrigationPage.tsx`, `irrigation/components/LimitedIrrigationCard.tsx` (baru), `irrigation/components/LimitedIrrigationDateDialog.tsx` (baru), `irrigation/limitedIrrigation.ts` (baru), `irrigation/queries.ts`, `logs/components/LogsTableCard.tsx`, `logs/logHelpers.ts`, `logs/useLogsViewModel.ts`, `lib/api.ts`, `lib/status.ts`, `types/index.ts`, `id.json`, `en.json`.
- Terbatas fix: `limited_irrigation.py`, `routers/farms.py`, `routers/valves.py`, `smoke_test.py`, `CLAUDE.md`.
- Riwayat 422 dan Bantuan: `routers/logs.py`, `smoke_test.py`, `helpCenter/components/HelpCenterDialog.tsx`, `irrigation/components/LimitedIrrigationCard.tsx`, `irrigation/components/LimitedIrrigationHelp.tsx` (baru), `types/index.ts`, `id.json`, `en.json`.

### Perubahan di luar repo

- Database dev: tiga kebun uji lama ("Kebun Fase 3 Test", "Kebun Fase 3b 936", "Kebun Test Auto-Resolve 310", milik akun uji, tanpa gateway, node, bacaan, atau riwayat) dihapus langsung di database pada 2026-09-29 dengan urutan yang sama seperti `delete_farm`, setelah cadangan `backend/data/lorafield-backup-2026-09-29.db` dibuat. Cadangan itu kemudian dihapus user. Belakangan user menghapus "Kebun Gejawan Kulon" dan "Kebun Ngaglik", jadi database dev kini hanya berisi "Kebun Sawit Faiz 1".
- User mencoba Irigasi Terbatas di "Kebun Sawit Faiz 1" pada 2026-10-01 (alasan "Lainnya", sampai 22 Oktober). Saat sesi ini selesai, periode itu masih aktif.
- Backend di-restart dan web di-build ulang user setelah Irigasi Terbatas di-commit.
- Server uji terpisah (port 8011, database baru di folder scratchpad, tanpa MQTT, akun uji buatan sesi) dipakai untuk mengecek tampilan Irigasi Terbatas dan Pusat Bantuan di layar komputer, HP, mode gelap, dan mode terang. Dimatikan setelah uji. Backend, simulator, dan database user tidak disentuh.
- Riset jurnal lewat pencarian web (FAO-56, *regulated deficit irrigation*, mangga, kopi, bawang menjelang panen, padi basah-kering bergantian, kalibrasi sensor per jenis tanah). Sumbernya dicatat di percakapan, tidak di repo.
- Memory Claude: `todo-lorafield.md` (ditulis ulang, termasuk keputusan Irigasi Terbatas), `pola-prompt-ketat.md` (pelajaran baru), dan entrinya di `MEMORY.md`.
- Prototipe backend Irigasi Terbatas, skrip simulasi sensor lepas, skrip uji versi salah, skrip teks i18n, dan skrip uji tanggal ekstrem disimpan di folder scratchpad sesi (sementara, bukan bagian repo).

### Keputusan yang diambil

- Pengaman sensor tidak menyebut "sensor rusak", karena penyebabnya bisa juga valve, pipa, atau air. Labelnya "Periksa penyiraman". Jeda tetap berlaku walau mode diganti, sampai tombol "Aktifkan lagi" ditekan.
- Peringatan khusus padi, mangga, dan kopi dibatalkan, diganti fitur umum Irigasi Terbatas. Dasarnya praktik *regulated deficit irrigation* yang didukung penelitian (misalnya Fereres dan Soriano 2007, mangga di Australia, kopi, bawang), dengan catatan bahwa angka per tanaman perlu dicek ahli setempat.
- Irigasi Terbatas: nama "Irigasi Terbatas" (Inggris *Limited Irrigation*), bukan mode ketiga melainkan pilihan sementara di mode otomatis. Petani memilih alasan, bukan angka. Batas turun 10 poin untuk semua kebun dan tidak ditampilkan ke petani. Berlaku per kebun untuk semua node sekaligus. Pindah ke manual tidak membatalkan dan tanggal selesai tidak bergeser. Tanggal selesai bisa diubah selama aktif (paling cepat besok, paling lambat 28 hari). Tombol disembunyikan untuk padi, diganti catatan "Padi lebih cocok memakai mode Manual, karena sensor mengukur kelembapan tanah, bukan tinggi genangan air." (tanpa kata "sawah"). Tanda di Dashboard di atas Ringkasan Kebun disetujui user, tombol Hentikan hanya di halaman Irigasi. Tanda tanya harus bisa ditekan, karena petani banyak memakai HP.
- Satu kebun satu tanaman: jenis tanaman tidak bisa diganti setelah kebun dibuat (diputuskan di sesi lain, `99d31d2`).
- Untuk prototipe yang sudah lolos uji, Claude langsung menerapkannya ke repo tanpa commit, bukan lewat prompt untuk sesi lain (permintaan user).
- Tabel Riwayat akan dibagi per halaman, 20 baris per halaman. Ekspor CSV tetap berisi semua baris.

### Belum dikerjakan saat Sesi 4 selesai

Item dari daftar Sesi 3:

- Pengaman sensor rusak: selesai (`76cae63`, `26d2d50`, `2369808`), dengan nama "Periksa penyiraman".
- Nama koneksi MQTT backend bisa diatur: belum.
- (opsional) Siram otomatis tidak melewati batas atas: belum.
- Rapikan dokumen (nomor baris CLAUDE.md, bagian lama `docs/SECURITY_AUDIT_AUTH.md`): belum.
- `FRONTEND_URL` di `backend/.env`: belum.
- Kirim `docs/kontrak-mqtt.md` ke tim IoT, tambah aturan "gateway mengulang perintah" (butuh persetujuan user), beri tahu isi stiker node: belum.
- (opsional) Hapus kebun uji lama: selesai (dihapus di database pada 2026-09-29).
- Restart backend dan simulator setelah `e7bf0dc`: dilakukan user pada 2026-09-29.
- Peringatan tanaman khusus: dibatalkan, diganti Irigasi Terbatas (selesai di `0d25d05`, `340c80d`, `99d31d2`, `4ce3212`).
- Filter tanggal Riwayat (dari daftar Sesi 1): kodenya diperiksa, dua cacat tampilan diperbaiki di `445b0dc`, dan tanggal ekstrem di server diperbaiki di `4ce3212`.
- Tim IoT (pin, kalibrasi, jenis valve, daya pancar, uji alat asli, ukur arus), firmware gateway yang melewatkan paket saat sibuk, keamanan LoRa, jam baca dari alat, persiapan sebelum publik dan sebelum dijual, kalibrasi dan uji lapangan, fitur AI, mode hemat daya, cek "Hujan Ringan" di browser: belum.

Item baru:

- Tabel Riwayat dibagi per halaman (20 baris): prompt untuk Claude Code sudah dibuat, belum dikerjakan.
- Catatan "Manual: ditutup otomatis" (`manual_timeout`) mungkin memakai kelembapan dari waktu sesudah kejadian, mirip temuan 5 di `99d31d2`: belum diuji.
- Review ulang `99d31d2` oleh Codex: belum.
- Uji lapangan: setel angka "Periksa penyiraman" (2 poin) dan penurunan Irigasi Terbatas (10 poin).
- Logika pertanian lanjutan: jenis tanah dan kalibrasi per kebun (menurut penelitian paling berpengaruh), tanggal tanam supaya batas mengikuti fase tumbuh, sensor tinggi air untuk padi.
- Web saat ini selalu mode gelap (`index.html` memakai class `dark`, tidak ada tombol ganti tema), padahal CLAUDE.md meminta dukungan dua mode. Fitur baru tetap dicek di kedua mode.

### Pelajaran dan kesalahan

- Klaim dari sesi lain selalu dicek ulang: "9 perbaikan bug" ditelusuri sampai transkrip sesi simulator lalu dicocokkan dengan kode, dan "tes firmware 10/10" dijalankan ulang.
- "Periksa penyiraman" versi pertama lolos smoke test, tapi hanya menangkap sensor lepas sekitar 52% (cek hanya tepat di pulsa ke-2, dan syarat "tidak naik sama sekali" kalah oleh getaran angka sensor). Ketahuan lewat simulasi 1000 kali memakai `auto_decision` asli.
- Prototipe Irigasi Terbatas lolos 9 uji versi salah, tapi review Codex tetap menemukan 6 masalah nyata (permintaan bersamaan, periode basi, padi setelah tanaman diganti, Riwayat tanpa tanggal, data sesudah kejadian, tanggal ekstrem membuat error server). Pemeriksa kedua dari agen lain terbukti berguna.
- Satu uji versi salah (catatan "selesai" dobel saat dua proses bersamaan) tidak bisa ditangkap tes yang berjalan berurutan, jadi tidak dimasukkan. Belakangan masalah serupa memang ditemukan review Codex.
- Prompt Fase A menulis `--allow` di `guard_diff.py` dua kali. Opsi itu memakai `nargs='*'`, jadi izin pertama hilang. Yang benar satu opsi berisi semua path.
- Salinan backend lewat `tar` di Git Bash berakhiran baris CRLF, padahal repo memakai LF. Dinormalkan ke LF sebelum dibandingkan dan disalin.
- User mempertanyakan pola "salinan lalu prompt" untuk pekerjaan yang sudah siap. Sejak itu prototipe yang sudah lolos langsung diterapkan ke repo tanpa commit.
- Validator email menolak domain `.test` (sudah tercatat di Sesi 2) dan terulang saat membuat akun uji.
- Tangkapan layar browser sering gagal karena jendela tertutup jendela lain. Pengecekan dilanjutkan lewat teks halaman, lalu tangkapan layar diulang.
- Tiga kebun uji dihapus langsung di database karena endpoint hapus butuh login pemilik. Cadangan dibuat lebih dulu, dan data anak diperiksa kosong sebelum menghapus.
