# Catatan Fitur Tambahan LoraField

Ringkasan apa yang ditambah, di file mana, dan apa yang masih menggantung. Simpan ini untuk referensi perbaikan berikutnya. Tanggal kerja: 2026-06-24.

## Status verifikasi

- `tsc -b` (type-check, gate build frontend): bersih, exit 0.
- Scan korupsi (NUL/truncation) di semua file berubah: bersih.
- Backend Python (`main.py`, `schemas.py`, `database.py`): py_compile OK.
- Belum diverifikasi dari sandbox (perlu dijalankan di mesin Windows): `npm run build` tahap bundling vite, dan smoke test runtime backend.

## Perbaikan saat verifikasi (di luar fitur, tapi penting)

- `src/lib/mockFarmData.ts` — dua variabel tak terpakai (`nodeId`, `i`) dan dua byte NUL korup di ekor file. Diperbaiki; tadinya bikin `npm run build` gagal padahal `tsc --noEmit` lolos.
- `src/features/farms/FarmDetailPage.tsx` — file di disk terpotong di baris 550 (berakhir mid-token `</Tabl`, penutup `</Table></CardContent></Card></div>` hilang). Dilengkapi. Sekaligus refactor form edit (lihat Fase D) untuk hapus lint `set-state-in-effect`.

## Fitur per fase

### Fase A — additive dari data summary (tanpa endpoint baru)

- `src/features/nodes/NodesPage.tsx` — kolom nilai sensor terakhir (soil moisture, soil temp, air temp, air humidity) dari `summary.nodes[].latest_reading`. Guard null → "—". RSSI tetap "—".
- `src/features/irrigation/IrrigationPage.tsx` — kartu Threshold (`summary.thresholds.lower`–`upper`) + progress bar kelembapan rata-rata dengan label `0%`/`100%`, dan tabel detail irigasi per node.
- `src/features/logs/LogsPage.tsx` — section "Node Bermasalah" dari node berstatus offline.

### Fase B — Baterai node (nilai terkini, bukan grafik historis)

- `src/features/monitoring/MonitoringPage.tsx` — kartu "Baterai Node": bar per node dari `summary.nodes[].node.battery`, ambang warna (`<20%` red, `20–50%` yellow, `>50%` green), label `0%`/`100%`.
- Alasan tidak ada grafik historis dicatat di kode: tabel `readings` tak punya kolom battery.

### Fase C — Mode Otomatis/Manual (toggle UI saja)

- `src/features/irrigation/IrrigationPage.tsx` — toggle Otomatis/Manual via `useState` lokal. Pilih Manual → banner peringatan, tidak ada panggilan API. Ada komentar TODO kontrak endpoint masa depan.

### Fase D — Edit kebun (wire PATCH yang sudah ada)

- `src/lib/api.ts` — method `updateFarm(id, payload)` → `PATCH /api/farms/{id}`.
- `src/features/farms/queries.ts` — `useUpdateFarm(farmId)`, invalidate `['farms']` dan `['farm-summary', farmId]`.
- `src/features/farms/FarmDetailPage.tsx` — komponen `EditFarmSheet` (wrapper) + `EditFarmForm` (anak, di-`key` oleh `open` supaya reset via remount, bukan setState di effect). Submit hanya field yang berubah (partial).

### Fase E — Filter tanggal + filter kebun (Riwayat)

- `src/features/logs/LogsPage.tsx` — filter tanggal dari–sampai, client-side pada window yang ter-fetch. Ada note keterbatasan + komentar TODO.
- `src/features/logs/queries.ts` — komentar TODO bahwa `GET /api/logs` belum dukung param tanggal server-side.
- Filter kebun: tetap pakai scope per-kebun (route `:id` + FarmSwitcher), tidak menambah dropdown lintas-kebun.

### Fase F — Koneksi internet gateway (placeholder)

- `src/features/gateway/GatewayPage.tsx` — baris "Koneksi Internet" menampilkan "Belum dipantau" + komentar TODO. Tidak ada nilai karangan.

### Fase G — Log koneksi gateway (backend baru + frontend)

- `backend/app/database.py` — tabel `gateway_logs` (id, farm_id, event, detail, created_at) + index `idx_gateway_logs_farm`.
- `backend/app/schemas.py` — `GatewayLogIn` (`event`, `detail`).
- `backend/app/main.py` — `GET /api/farms/{farm_id}/gateway-logs` (ownership + limit 1–100) dan `POST` (scaffolding hardware), status 201.
- `src/types/index.ts` — type `GatewayLog`.
- `src/lib/api.ts` — `getGatewayLogs(farmId, limit)`.
- `src/features/gateway/queries.ts` (baru) — `useGatewayLogs(farmId)`.
- `src/features/gateway/GatewayPage.tsx` — section "Log Koneksi Gateway", empty state jujur tanpa mock.
- `CLAUDE.md` — tabel endpoint + schema sudah diperbarui.

### Dibatalkan (keputusan user)

- Riwayat "Laporan Gateway" — tidak dibuat.
- Pengaturan "Konfigurasi Sistem" — tidak dibuat.

### i18n

- `src/i18n/locales/id.json` dan `en.json` — semua key baru (monitoring.battery*, irrigation.mode*/threshold*/manual*, gateway.internet*/logs*, nodes.colSoil*/Air*, logs.dateFilter* dll) sudah ada.

## TODO / FUTURE yang masih menggantung

Semua ini placeholder/UI yang sengaja belum fungsional penuh karena butuh backend atau hardware. Lokasi komentar TODO ada di file terkait.

- Grafik historis baterai — butuh kolom/endpoint riwayat baterai di backend (sekarang nilai terkini saja).
- Mode manual valve — butuh endpoint kontrol: rencana `POST /api/farms/{id}/valve/mode` dan `POST /api/farms/{id}/valve` (belum ada, jangan dipanggil).
- Koneksi internet gateway — butuh backend lapor field konektivitas (mis. `internet_status`) saat hardware gateway aktif.
- Log koneksi gateway — tabel & endpoint sudah ada, tapi kosong sampai hardware gateway mengirim via `POST .../gateway-logs`.
- Filter tanggal Riwayat — masih client-side (maks 100 log ter-fetch). Untuk rentang penuh, tambah param `?start=&end=` di `GET /api/logs`.

## Housekeeping (non-blocking)

- ESLint: 8 error pre-existing di file shadcn (`react-refresh/only-export-components` di badge, button, sidebar, tabs, AuthContext) + `use-mobile.ts` (set-state-in-effect). Bukan dari fitur ini, tidak nge-block build.
- Line endings: working tree kelihatan berubah masif karena CRLF↔LF. Perubahan nyata hanya 17 file (~893 baris). Cek `git config core.autocrlf` atau tambah `.gitattributes` sebelum commit.

## Sebelum commit / deploy

1. Jalankan `npm run build` di `frontend/` (Windows) — pastikan bundling lolos.
2. Start `uvicorn backend.app.main:app` sekali, hit `GET /api/farms/{id}/gateway-logs` — harus balas `{ items: [], total: 0 }` untuk kebun valid, 404 untuk kebun bukan milik user.
3. Beresin CRLF supaya diff commit bersih.
