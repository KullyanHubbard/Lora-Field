# Rencana Bersih-Bersih Kode LoraField

Dibuat 2026-09-23 dari audit 3 agent code reviewer (frontend fitur, frontend bersama, backend + root). Temuan utama sudah dicek ulang manual.

## Aturan main

- Kerjakan satu fase per instruksi. Jangan lanjut ke fase berikutnya tanpa diminta.
- Setiap fase ditutup dengan commit sendiri, tanpa atribusi AI.
- Tampilan Ringkasan Kebun (3 kolom) tidak boleh berubah. Perbaikan di area itu hanya menyentuh data atau teks.
- Tidak ada dependency baru.
- Cek wajib di akhir setiap fase:
  - Frontend: `npx tsc -p tsconfig.app.json --noEmit` (0 error), `npm run build` (sukses), `npm run lint` (tidak ada error baru; saat ini ada 2 error lama).
  - Backend (kalau disentuh): `python backend/scripts/smoke_test.py` (0 gagal) dan diff `openapi_snapshot.py` sebelum/sesudah (harus kosong, kecuali disebut di langkahnya).
  - Catatan: perintah `npx tsc --noEmit` yang tertulis di CLAUDE.md tidak memeriksa file apa pun. Pakai perintah di atas.

## Fase 0: Keputusan yang dibutuhkan

Jawab dengan kode, misalnya "K1 ya, K2 hapus". Fase 1 sampai 3 bisa jalan tanpa menunggu jawaban ini.

| Kode | Pertanyaan | Rekomendasi |
|------|------------|-------------|
| K1 | Tabel logika irigasi dan kartu dampak cuaca hilang dari halaman sejak commit 9819fc7 (2026-06-29). Tinggal 84 teks terjemahannya. Dibuang permanen? | Ya, hapus teksnya. Kelihatannya sengaja dibuang saat halaman dirombak. |
| K2 | Kartu klaim/lepas gateway dibuat 2026-07-15 lalu dicabut sehari kemudian. Tanpa kartu ini gateway tidak bisa diganti setelah kebun dibuat. Pasang lagi atau hapus? | Hapus kodenya. Tetap aman di riwayat git kalau nanti dibutuhkan. |
| K3 | Grafik di 4 kartu metrik Kolom 3 selalu "Tidak ada data" karena belum disambung ke data sensor. Disambungkan? | Ya, tapi sebagai pekerjaan terpisah setelah bersih-bersih. Layout tidak berubah. |
| K4 | Tombol yang belum berfungsi: "Ingat saya", login Google/Apple, tombol Detail dan Manual di kartu node irigasi. Nomor WhatsApp di Pusat Bantuan masih nomor contoh. | Sembunyikan tombolnya sampai fiturnya ada. Kirim nomor WhatsApp asli. |
| K5 | Nilai kosong ditampilkan dengan em dash di sekitar 25 tempat, termasuk kolom RSSI. Aturan antislop melarang em dash. Ganti ke apa? | Ganti semua ke tanda hubung `-`, termasuk RSSI, lalu sesuaikan CLAUDE.md. |
| K6 | `frontend/src/mocks/mockFarmScenario.ts` (551 baris) sudah tidak dipakai. CLAUDE.md masih menyebutnya pusat data mock. Hapus? | Hapus, lalu sesuaikan aturan mock di CLAUDE.md. |
| K7 | Masih pakai Codex? (menentukan nasib `CODEX.md`) Rencana MQTT/gateway di `prompt-gateway-provisioning.md` masih berlaku? | Kalau tidak pakai Codex, hapus `CODEX.md`. Kalau MQTT masih rencana, pindahkan prompt itu ke `docs/` sebagai arsip. |
| K8 | Boleh memperbarui CLAUDE.md supaya cocok dengan kode (rute, file panduan yang sudah hilang, perintah cek, aturan mock)? | Ya, di Fase 4. |
| K9 | Boleh mengubah `package.json`? (hapus `vite-plugin-svgr`, pindahkan `shadcn`, `tailwindcss`, `@tailwindcss/vite`, `tw-animate-css` ke devDependencies) | Ya. `shadcn` sendiri menyumbang 9 dari 14 peringatan keamanan npm. |
| K10 | Notifikasi (toast) mengikuti tema OS, padahal aplikasi selalu gelap. | Kunci toast ke tema gelap sekarang. Atur ulang saat toggle light mode dibuat. |
| K11 | Akses dari luar: `start-ngrok.bat` atau Cloudflare Tunnel (yang tertulis di dokumentasi)? | Cloudflare Tunnel. Hapus `start-ngrok.bat`. |
| K12 | Testimoni di landing page memakai nama dan klaim karangan (mis. "hasil panen naik 20%"). Hapus atau ganti dengan testimoni asli? | Hapus section testimoni sampai ada testimoni asli yang bisa diverifikasi. |

## Fase 1: Perbaikan mendesak

Enam masalah yang sudah berdampak nyata.

- [x] **1.1 Nama folder beda huruf besar/kecil.** Git mencatat `MyFarms` dan `SelectFarms`, sedangkan kode memanggil `myFarms` dan `selectFarms`. Di Linux dan Docker build gagal.
  - Rename dua langkah supaya git mencatatnya: `git mv frontend/src/features/MyFarms frontend/src/features/_tmp_myfarms`, lalu `git mv frontend/src/features/_tmp_myfarms frontend/src/features/myFarms`. Ulangi untuk `SelectFarms`.
  - Cek: `git ls-files frontend/src/features` hanya menampilkan `myFarms` dan `selectFarms`.
  - Commit terpisah (hanya rename).
- [x] **1.2 Link di email reset password rusak.** Link mengarah ke `/static/reset-password`, halaman itu tidak ada.
  - `backend/app/config.py:23`: default `frontend_url` jadi `http://localhost:8000`.
  - `backend/.env` (lokal, tidak masuk git): hapus akhiran `/static` di `FRONTEND_URL`. Hanya baris itu yang diubah.
  - `backend/README.md:39`: sesuaikan.
  - Cek: smoke test lolos. Minta OTP lupa password, tombol di email membuka halaman `/reset-password`.
- [x] **1.3 Card Gateway di Ringkasan Kebun selalu Offline.** Card tidak pernah menerima data gateway, jadi status selalu Offline dan ID gateway kosong.
  - Ambil data gateway dengan `useFarmGateway(farmId)` (sama seperti halaman Gateway), teruskan lewat `DashboardSummaryGrid.tsx` ke `DashboardGatewayInfoContent.tsx`.
  - Buang parameter `_summary` yang tidak terpakai di `buildGatewayInfo` (`features/gateway/gatewayHelpers.ts:45`), sesuaikan juga pemanggilnya di `useGatewayPageViewModel.ts`.
  - Tampilan card tidak berubah (Kolom 1 aman), hanya isinya.
  - Cek: status dan ID gateway di Ringkasan Kebun sama dengan di halaman Gateway.
- [x] **1.4 Docker membawa file rahasia.** Image ikut memuat `backend/.env` (kunci JWT dan Resend) dan file database.
  - Buat `.dockerignore` di root: `backend/.env`, `backend/.venv`, `backend/data/`, `backend/logs/`, `**/__pycache__`, `frontend/node_modules`, `frontend/dist`.
  - `docker-compose.yml`: tambah `env_file: backend/.env`. Dua perubahan ini wajib bersamaan, kalau tidak container gagal start.
  - Cek: `docker compose build` kalau Docker terpasang. Kalau tidak ada Docker, laporkan bahwa langkah ini hanya dicek dengan membaca file.
- [x] **1.5 Dialog edit kebun menampilkan nama kebun sebelumnya.**
  - `features/myFarms/components/MyFarmsView.tsx`: beri `key` berdasarkan id kebun ke `MyFarmEditDialog`, supaya dialog mulai bersih untuk tiap kebun.
  - `MyFarmEditDialog.tsx`: nilai awal nama langsung dari kebun, hapus `setName` yang jalan saat render (baris 33–35).
  - Cek: edit kebun A lalu simpan, buka edit kebun B, yang muncul nama B. Kolom nama bisa dikosongkan.
- [x] **1.6 Perintah cek TypeScript.** Mulai fase ini pakai `npx tsc -p tsconfig.app.json --noEmit`. Teks di CLAUDE.md diperbaiki di Fase 4 (K8).

## Fase 2: Hapus file dan kode yang tidak dipakai

Semua item di sini sudah dicek tidak punya pemakai.

Frontend:
- [x] Folder `frontend/src/assets/icons/` (63 file, 74 KB). Semua ikon diambil dari lucide-react.
- [x] `frontend/src/assets/Hero-Preview1.svg` (480 KB). Landing memakai versi `.png`.
- [ ] Rantai svgr: `frontend/src/types/svg.d.ts`, `svgr()` di `frontend/vite.config.ts`, dan paket `vite-plugin-svgr` (butuh K9).
- [x] Empat file mock pembungkus: `mockFarmData.ts`, `mockGatewayData.ts`, `mockGatewayLogs.ts`, `mockLogs.ts`. `mockFarmScenario.ts` mengikuti K6.
- [x] `frontend/src/lib/markerColors.ts`.
- [x] `frontend/src/components/layout/DashboardBar.tsx` dan komentar yang menyebutnya di `BrandMark.tsx:5`.
- [x] `frontend/src/components/layout/.gitkeep`.
- [x] Sisa panel daftar kebun lama di halaman peta:
  - `selectFarms/components/SelectFarmsList.tsx`, `SelectFarmsListItem.tsx`, `SelectFarmsAddButton.tsx`
  - `getShortFarmLocation` di `selectFarmsHelpers.ts`
  - `farmStatusTone`, `farmStatusLabelKey`, `FarmStatusTone` di `dashboard/farmStatusHelpers.ts` (`getFarmLastUpdate` tetap, dipakai halaman Irigasi)
  - `components/ui/status-lights.tsx` (pemakainya hanya file di atas)
  - `onAddFarm` dan `onOpenFarm` di `useSelectFarmsViewModel.ts`
  - Teks terjemahan yang jadi yatim karenanya (`selectFarms.title`, `selectFarms.empty`, `selectFarms.openFarm`, `farmStatus.*`), dicek dulu satu per satu.
- [x] `frontend/src/features/landing/constants.ts`.
- [x] Barrel tanpa pemakai: `features/auth/index.ts`, `features/dashboard/components/index.ts`.
- [x] `frontend/esb.txt` (catatan error yang nyasar).
- [x] Class `cn-toast` di `components/ui/sonner.tsx` (tidak didefinisikan di mana pun).

Backend:
- [x] `backend/app/data/lorafield.db` (file kosong, database asli ada di `backend/data/`). Keluarkan dari git.
- [x] Model `NodeSelfRegistrationResponse` di `backend/app/schemas.py:150–153`.
- [x] Mount `/static` di `backend/app/main.py:87–89` (foldernya tidak pernah ada).
- [x] Paket `resend` dan `python-multipart` di `backend/requirements.txt`.

Root repo:
- [x] `package-lock.json` di root (kosong, tidak ada `package.json` di root).
- [x] `skills-lock.json` dan folder kosong `.agents/`, `.codex/`.
- [x] `backend/.gitignore` (semua isinya sudah ada di `.gitignore` root).
- [x] `.vscode/settings.json` dikeluarkan dari git dengan `git rm --cached`. File di laptop tetap ada.
- [x] `.gitignore` root: tambah `*.db`, `*.db-journal`, `*.db-wal`, `*.db-shm`, dan file hasil `openapi_snapshot.py` (`backend/scripts/openapi_current.json`, `baseline.json`, `sesudah.json`).

Cek tambahan: buka landing, peta kebun, Kebun Saya, dan halaman Irigasi. Semuanya tampil normal.

## Fase 3: Satukan kode dobel

Tujuannya supaya satu aturan cukup diubah di satu tempat. Tampilan tidak berubah, kecuali format jam yang sekarang ikut bahasa aplikasi.

Frontend:
- [x] **3.1 Label event log gateway** ditulis 2 kali. Pakai versi di `gateway/gatewayHelpers.ts`, hapus `getGatewayLogMeta` di `dashboard/dashboardHelpers.ts`. Daftar filter di `GatewayLogContent.tsx` diambil dari `GATEWAY_EVENT_FILTERS`.
- [x] **3.2 Jam prakiraan cuaca** ditulis 2 kali (`forecastSlotTime` di dashboardHelpers, `formatForecastLabel` di weatherHelpers). Satukan di weatherHelpers. Label "Sekarang" lewat terjemahan.
- [x] **3.3 Format jam terkunci ke bahasa Indonesia** di 5 tempat. Buat satu helper di `lib/format.ts` yang ikut bahasa aplikasi.
- [x] **3.4 Tanda nilai kosong** jadi satu konstanta di `lib/format.ts`. Isinya mengikuti K5.
- [x] **3.5 Aturan password dan email** di register, reset password, dan ganti password disatukan jadi satu helper di `features/auth`.
- [x] ~~**3.6 Logo LoraField** ditulis ulang di `LandingPage.tsx` dan `AuthSplitLayout.tsx`. Pakai `BrandMark` bersama, pastikan ukurannya tetap sama.~~ Dilewati: tiga logo sengaja beda bentuk (link dengan hover di sidebar, teks tebal di navbar landing, teks besar di panel login). Disatukan berarti mengubah tampilan dan perilaku.
- [x] **3.7 Warna status hijau/kuning/merah** didefinisikan di 4 tempat (`status-pill`, `gauge-ring`, `BatteryNodesCard`, dan tipe-tipenya). Satukan di `lib/status.ts`.
- [x] **3.8 Nama node** (`name`, kalau kosong lokasi, kalau kosong ID) ditulis ulang di 6 tempat. Jadikan satu helper. Catatan: hanya 3 pemakaian pola nama/lokasi/ID di Ringkasan Kebun yang disatukan. Pola nama/ID di Irigasi dan Riwayat sengaja dibiarkan karena lokasi sudah tampil terpisah.
- [x] **3.9 FarmContext** hanya menyalin ID kebun dari URL dan tidak dibaca siapa pun. Hapus `contexts/FarmContext.tsx`, pemasangannya di `app/providers.tsx`, dan efek sinkronnya di `AppLayout.tsx`. Hapus juga sisa rute lama `'add'` di `AppLayout.tsx:64`. Ini sekaligus membereskan 1 dari 2 error lint.
- [x] **3.10 Pencarian kode wilayah BMKG** dipanggil langsung dari komponen (`LocationDetector.tsx`, `addFarm/hooks.ts`). Pindahkan ke `addFarm/queries.ts` sesuai aturan data fetching.

Backend:
- [x] **3.11 Cek "kebun sudah punya gateway"** dilakukan 2 kali. Hapus cek di `routers/gateways.py:99–104` karena `gateway_service.py` sudah menanganinya. Tambah 1 kasus uji di `smoke_test.py` untuk skenario ini.
- [x] **3.12 Pembersih nama wilayah dobel**: `wilayah_resolver.py:136–141` pakai `normalize_region_name`. `language_preferences.py` pakai satu fungsi UPDATE. Hapus alias yang tidak pernah terjangkau di `adm4.py:14`.
- [x] **3.13 Sisa kecil backend**:
  - parameter `extra_claims` yang tidak dipakai (`auth.py`)
  - nilai awal mati dan query node dobel (`routers/nodes.py:111–132`)
  - kolom `created_at` yang tidak dibaca (`auth.py:64`)
  - 3 index dobel (`database.py:66`, `67`, `152`)
  - error Nominatim yang ditelan diam-diam, beri log (`adm4.py:126`)
  - label log yang salah (`main.py:67–71`)
- [x] **3.14 Sisa frontend lama di backend**: route `/{page_name}.html` (`main.py:141–147`) dan port Live Server 5500/5501 (`main.py:47–51`). Diff OpenAPI berkurang 1 path, itu disengaja.

Opsional, hanya kalau diminta (refactor besar):
- Gabungkan 4 grafik monitoring yang hampir identik jadi satu komponen.
- Pindahkan query bersama (`useFarms`, `useFarmSummary`) keluar dari folder dashboard, `useCrops`/`useCreateFarm` ke addFarm, `farmColorStorage` ke `lib`, hapus `useIrrigationSummary`.
- Pecah `LandingPage.tsx` (556 baris), `WeatherPage.tsx` (346 baris), dan `dashboardHelpers.ts`.

## Fase 4: Dokumen dan CLAUDE.md

Menunggu K7, K8, K11.

- [ ] CLAUDE.md (K8):
  - Tabel rute disamakan dengan `router.tsx` (`/select-farms`, `/my-farms`, `/addFarm`; halaman nodes sudah tidak ada).
  - Rujukan ke `frontend/docs/Panduan-Rebuild-Frontend-LoraField.md` (sudah terhapus) dibuang.
  - Perintah cek diganti `npx tsc -p tsconfig.app.json --noEmit`.
  - Aturan mock sesuai K6, tanda nilai kosong sesuai K5.
- [ ] `CODEX.md` dan `prompt-gateway-provisioning.md` sesuai K7.
- [ ] Hapus `frontend/PROGRESS.md` (snapshot Juni yang sudah basi).
- [ ] Ganti `frontend/README.md` (masih bawaan template Vite) dengan README singkat proyek.
- [ ] Hapus 4 rencana lama yang sudah selesai atau tergantikan: 2 di `docs/superpowers/plans/`, 2 di `frontend/docs/superpowers/plans/`. Rencana baru cukup di `docs/superpowers/plans/`.
- [ ] Pindahkan `SECURITY_AUDIT_AUTH.md` ke `docs/`, perbarui rujukan barisnya ke `routers/auth.py`. Isinya (rate limit belum ada) masih relevan.
- [ ] Perbarui `backend/README.md`: hapus endpoint yang tidak ada, perbaiki langkah `.env.example`, rujuk tabel endpoint di CLAUDE.md.
- [ ] Gabungkan `backend/start-server.bat` ke menu `lorafield.bat` (buang IP yang ditulis langsung). Rapikan komentar basi di `lorafield.bat`. `start-ngrok.bat` sesuai K11.
- [ ] `anti-slop/audit-001-2026-09-23.md` dibiarkan sampai item #3-nya beres.

## Fase 5: Keputusan produk dan rapikan kecil

Produk (sesuai jawaban Fase 0):
- [ ] K1: hapus 84 teks terjemahan yang tidak dipakai (daftar lengkap dicek ulang saat eksekusi).
- [ ] K2: `GatewayProvisioningCard.tsx` beserta hook klaim/lepas di `gateway/queries.ts`.
- [ ] K4: tombol yang belum berfungsi dan nomor WhatsApp.
- [ ] K9: pindahkan paket build ke devDependencies, naikkan versi minor `react-router-dom` (ada peringatan keamanan).
- [ ] K10: tema toast.
- [ ] Favicon masih logo bawaan Vite. Butuh aset logo dari kamu.

Rapikan kecil:
- [ ] Warna yang ditulis langsung di kode dipindah ke token tema: palet grafik (isi `--chart-1..5` di `index.css`), chip filter log gateway yang tidak kelihatan di light mode, `.summary-subcard-interactive`.
- [ ] Teks yang belum lewat terjemahan: `MetricStatCard`, toast di queries dashboard dan Kebun Saya, header CSV, "km/jam". Di `id.json`, "Logout" dan "Home" diganti Bahasa Indonesia.
- [ ] 10 import `../` diganti alias `@/`.
- [ ] Bug kecil di `WeatherPage.tsx`: sumbu suhu mentok 36°C, warna garis tidak valid. Login jangan memotong spasi di password.
- [x] **Prioritas.** Waktu dari backend disimpan UTC tanpa penanda zona, lalu dibaca sebagai WIB, jadi meleset 7 jam. Selesai (2026-09-24): satu fungsi `parseServerDate` di `lib/format.ts`, dipakai di log aktivitas, halaman Gateway, Monitoring, Riwayat (termasuk filter tanggal dan ekspor CSV), dan Irigasi.
- [ ] Tipe data: hapus `signal_rssi` (tidak ada di backend), rapikan field forecast yang tidak pernah terisi, buat tipe khusus untuk `updateFarm`, hapus komentar basi di `types/index.ts`.
- [ ] Kata `export` yang tidak perlu (sekitar 30 fungsi dan tipe yang hanya dipakai di file sendiri).
- [ ] Em dash di 25 baris komentar kode.
- [ ] Inline style di `BatteryNodesCard.tsx` diganti class Tailwind, tanpa perubahan tampilan (Kolom 2).
- [ ] Skeleton loading halaman peta masih 2 panel, samakan dengan tampilan peta penuh.
- [ ] Jalankan Prettier ke seluruh `src` dalam commit terpisah (murni format, 83 file), bereskan error lint yang tersisa.

## Tidak dikerjakan (dicatat saja)

- File ngrok 32 MB masih ada di riwayat git. Menghapusnya berarti menulis ulang riwayat dan force push, terlalu berisiko.
- Beda respons 403 dan 404 antar pengecekan kepemilikan kebun. Menyamakannya mengubah kontrak API.
- Subkomponen shadcn yang tidak dipakai. Itu bawaan library, biarkan.
- Index database untuk performa. Baru perlu saat data sensor mulai masuk.
- Migrasi kolom lama di `database.py`. Tetap dibutuhkan untuk database versi lama.
- Backup manual `backend/data/lorafield.before-gateway-test-20260715-235939.db` (10,9 MB, tidak masuk git). Kamu yang putuskan disimpan atau dihapus.
- Folder `.claude/skills/` yang ikut di git. Biarkan kecuali memang tidak dipakai lagi.
