# PROMPT Implementasi Fitur Tambahan LoraField

Dokumen ini adalah **prompt kerja** untuk sesi coding (VSCode / Claude Code), bukan catatan biasa.
Jalankan **satu fase per instruksi** sesuai aturan di `CLAUDE.md` (section "Cara Kerja").
Setelah tiap fase: jalankan `npx tsc --noEmit` dan `npm run dev` di `frontend/`, pastikan **nol error**, tampilkan ringkasan file yang diubah, lalu **BERHENTI** dan lapor. Jangan lanjut ke fase berikutnya tanpa diminta.

## Aturan Wajib (berlaku di SEMUA fase)

Diambil dari `CLAUDE.md`, jangan dilanggar:

- Label UI Bahasa Indonesia. Istilah teknis tetap asli: LoRa, VWC, MQTT, Gateway, Node, BMKG, RSSI.
- Functional components + hooks, TypeScript strict di semua file.
- Akses token localStorage HANYA lewat `src/lib/token.ts`.
- Data fetching HANYA lewat TanStack Query hooks di `src/features/*/queries.ts`. Tidak ada `useEffect` + fetch manual di komponen.
- DILARANG warna hardcoded di JS; pakai token tema shadcn (`text-primary`, `text-muted-foreground`, dst). DILARANG inline style kecuali nilai dinamis wajib (mis. lebar bar dari data).
- Import pakai alias `@/`, bukan `../../`.
- Wajib jalan di dark mode DAN light mode.
- Badge status warna konsisten: green / yellow / red.
- Progress bar selalu sertakan label range `0%` dan `100%`.
- Tipografi: em dash rapat tanpa spasi untuk sisipan; en dash untuk rentang angka/tahun; jangan hyphen pendek atau dua hyphen untuk fungsi itu; jangan horizontal rule sebagai separator.
- Git: JANGAN tambahkan trailer atau atribusi AI/Claude apa pun di commit.

## Aturan Anti-Halusinasi (KRITIS untuk fitur ini)

Beberapa fitur di bawah **belum punya data backend**. Untuk fitur seperti itu:

- DILARANG menampilkan angka/status seolah dari backend. Tampilkan state kosong/placeholder yang jujur ("Belum tersedia", "Belum ada data") + komentar TODO yang menyebut endpoint masa depan.
- DILARANG memanggil endpoint yang belum ada. Endpoint baru hanya yang dibuat eksplisit di Fase G.
- Sumber data yang boleh dipakai untuk fitur frontend = field yang benar-benar ada di response `GET /api/farms/{id}/summary` dan `GET /api/logs` (lihat tiap fase, field dikutip eksplisit).

Bentuk response `GET /api/farms/{id}/summary` yang dipakai berulang (sumber: `backend/app/main.py:1031`):

```
{
  farm, weather, thresholds: { lower, upper },
  gateway_status: "online" | "offline",
  average_soil_moisture, nodes_total, nodes_online, nodes_problem,
  nodes: [ { node, latest_reading, decision } ]
}
```

Catatan penting: `latest_reading` BISA `null` (node tanpa reading), dan `decision` BISA `null`. Selalu guard null → tampilkan "—" atau "menunggu data". Jangan asumsikan selalu ada.

# FASE A — Frontend additive (Node, Irigasi, Riwayat)

Tujuan: tambah info dari data yang SUDAH ada di `summary`. Zero backend. Risiko terendah.

## A1. Tabel Node: tambah nilai sensor terakhir

File: `src/features/nodes/NodesPage.tsx`.

Tambahkan kolom nilai sensor terakhir dari `ns.latest_reading` (tipe `Reading | null`): `soil_moisture` (%), `soil_temp` (DEG_C), `air_temp` (DEG_C), `air_humidity` (%).

- Sumber per node: `summary.nodes[].latest_reading`. Kalau `null` → tampilkan "—" di semua kolom sensor.
- Pakai konstanta `DEG_C` dari `src/lib/format.ts` (jangan tulis simbol derajat manual).
- JANGAN ubah kolom RSSI: tetap "—" (RSSI tidak disimpan backend).
- Pertahankan badge `is_mock_data` ("Data Contoh") yang sudah ada.

## A2. Irigasi: kartu Threshold eksplisit

File: `src/features/irrigation/IrrigationPage.tsx`.

Tambah satu `Card` "Threshold Kelembapan Tanah" yang menampilkan rentang `summary.thresholds.lower`–`summary.thresholds.upper` (format: `{lower}%–{upper}%`, pakai en dash).

- Tambahkan progress bar kelembapan rata-rata `summary.average_soil_moisture` relatif terhadap 0–100, dengan label range `0%` dan `100%` (wajib).
- Lebar bar = nilai dinamis → inline style untuk width saja diperbolehkan.
- Kalau `average_soil_moisture` `null` → tampilkan "—" dan sembunyikan bar.

## A3. Irigasi: detail per node

File: `src/features/irrigation/IrrigationPage.tsx` (tambah `Card` baru, jangan hapus panel keputusan yang ada).

Tabel per node dari `summary.nodes[]`: kolom Node (`ns.node.name` + lokasi), Kelembapan (`ns.latest_reading?.soil_moisture` %), Keputusan (`ns.decision?.decision`), Status Valve (`ns.decision?.valve_state`).

- Guard null: `latest_reading` null → "—"; `decision` null → tampilkan "menunggu data" dengan tone neutral.
- Pakai mapper status yang sudah ada (`getIrrigationStatusBadge`, `getValveStatusBadge`, `valveKeyFromDecision`). Jangan bikin mapper baru.

## A4. Riwayat: laporan node bermasalah

File: `src/features/logs/LogsPage.tsx` (tambah section di atas tabel log, jangan ubah tabel log/CSV export).

Section "Node Bermasalah" dari `summary.nodes[]` yang `ns.node.status === 'offline'`.

- Tampilkan jumlah (boleh cocokkan dengan `summary.nodes_problem`) + daftar nama/lokasi node offline.
- Kalau tidak ada node offline → tampilkan state positif ("Semua node aktif").
- Murni client-side, tanpa endpoint baru.

## Verifikasi Fase A

`npx tsc --noEmit` nol error, `npm run dev` jalan, cek di dark + light mode. Lapor, lalu STOP.

# FASE B — Baterai node (realistis, BUKAN grafik historis)

Tujuan: tampilkan baterai node secara jujur.

Alasan teknis (WAJIB dipatuhi): tabel `readings` TIDAK punya kolom battery (kolom: `soil_moisture, soil_temp, air_temp, air_humidity, created_at`). `battery` hanya nilai terkini di tabel `nodes`. Karena itu **grafik historis baterai mustahil** tanpa perubahan backend. Jangan bikin time-series baterai dengan data karangan.

File: `src/features/monitoring/MonitoringPage.tsx` (tambah `Card` "Baterai Node", jangan ubah 4 grafik sensor yang ada).

- Sumber: `summary.nodes[].node.battery` (nilai terkini, integer %).
- Tampilkan sebagai daftar bar horizontal per node: lebar bar = `battery%` (inline style width boleh, nilai dinamis).
- Sertakan label range `0%` dan `100%` (wajib).
- Warna ambang (pakai token tema, jangan hardcode hex): `< 20%` red, `20–50%` yellow, `> 50%` green. Petakan ke `StatusPill`/token yang sudah ada.
- Kalau `battery` null → "—".
- Tambahkan komentar di kode:
  `// CATATAN: backend tidak menyimpan riwayat baterai (tabel readings tanpa kolom battery). Tampilkan nilai terkini saja. Grafik historis menyusul jika backend menambah kolom/endpoint riwayat baterai.`

## Verifikasi Fase B

Sama seperti Fase A. Lapor, STOP.

# FASE C — Mode Otomatis/Manual (toggle UI saja, belum fungsional)

Tujuan: sediakan toggle Mode di Irigasi, tapi JUJUR bahwa manual belum aktif.

Alasan teknis (WAJIB): valve adalah hasil hitung `calculate_decision`, BUKAN state yang bisa dikontrol. Tidak ada endpoint untuk mengganti mode atau membuka/menutup valve. Maka toggle ini **UI lokal saja**, tanpa panggilan API.

File: `src/features/irrigation/IrrigationPage.tsx`. Ganti badge statis "Mode Otomatis" yang ada dengan toggle dua opsi: `Otomatis` (default) dan `Manual`.

- State disimpan di `useState` lokal saja. DILARANG memanggil API apa pun.
- Saat user memilih `Manual`: tampilkan banner/note tone yellow:
  "Mode manual belum aktif. Kontrol valve manual butuh endpoint backend yang belum tersedia."
  Jangan ubah perilaku keputusan irigasi (tetap dari `decision`).
- Tambahkan komentar TODO berisi kontrak masa depan (TANDAI belum ada):
  ```
  // TODO (future): kontrol manual valve butuh backend.
  // Rencana endpoint (BELUM ADA, jangan dipanggil):
  //   POST /api/farms/{farm_id}/valve/mode  body: { mode: "auto" | "manual" }
  //   POST /api/farms/{farm_id}/valve       body: { state: "open" | "closed" }  (hanya saat mode manual)
  ```

## Verifikasi Fase C

Sama. Pastikan tidak ada network request baru saat toggle. Lapor, STOP.

# FASE D — Manajemen Kebun: edit kebun (wire PATCH yang sudah ada)

Tujuan: aktifkan edit kebun. Endpoint backend SUDAH ADA: `PATCH /api/farms/{farm_id}` (`backend/app/main.py:897`), schema `FarmUpdate` (`backend/app/schemas.py:34`). Frontend `src/lib/api.ts` belum memanggilnya.

Field `FarmUpdate` (semua opsional, terverifikasi dari schemas.py:34):
`name, owner, location, crop_type, area_ha, bmkg_adm4_code, latitude, longitude, status`.
Backend pakai `exclude_unset` dan re-resolve `bmkg_adm4_code` kalau koordinat berubah. Return `{ farm }`.

## D1. api.ts

File: `src/lib/api.ts`. Tambah method:

```ts
updateFarm: (id: string, payload: Partial<CreateFarmPayload>) =>
  apiFetch<{ farm: Farm }>(`/farms/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }),
```

Hanya kirim field yang memang diubah (partial). Jangan kirim field yang tidak ada di `FarmUpdate`.

## D2. queries.ts

File: `src/features/farms/queries.ts`. Tambah `useUpdateFarm` (mutation) yang:
- `onSuccess`: `invalidateQueries(['farms'])` dan `invalidateQueries(['farm-summary', id])`, toast sukses.
- `onError`: toast error pakai `error.message`.
Pola ikuti `useCreateFarm` yang sudah ada.

## D3. UI edit

Sediakan form edit kebun (boleh halaman `/farms/:id` atau modal dari `FarmsPage`). Pertahankan create/delete yang sudah ada, jangan diubah.

- Pre-fill dari data kebun yang ada.
- Submit hanya field yang berubah.
- Validasi minimal sesuai `FarmUpdate` (mis. `name` 2–100 char).

## Verifikasi Fase D

Edit nama kebun → tersimpan, list & summary ter-refresh. `npx tsc --noEmit` nol error. Lapor, STOP.

# FASE E — Riwayat: filter tanggal + filter kebun

Tujuan: filter tanggal di halaman Riwayat, jujur soal keterbatasannya.

Keterbatasan teknis (WAJIB ditampilkan, jangan disembunyikan): `GET /api/logs` HANYA menerima param `limit` (1–100, default 20). TIDAK ada param tanggal/rentang. Maka filter tanggal di sini **client-side pada window yang ter-fetch saja**, bukan query DB beneran.

File: `src/features/logs/LogsPage.tsx` dan `src/features/logs/queries.ts`.

## E1. Filter tanggal

- Tambah input rentang tanggal (dari–sampai). Filter `scopedLogs` berdasarkan `log.created_at` (client-side).
- Naikkan `limit` fetch ke `100` (maksimum yang diizinkan backend) supaya window lebih lebar.
- Tampilkan note kecil: "Filter tanggal hanya berlaku pada {N} log terbaru yang dimuat (maks 100). Untuk rentang lebih lama, dibutuhkan param tanggal di backend (belum ada)."
- Tambahkan komentar TODO:
  `// TODO (future): GET /api/logs belum dukung filter tanggal server-side (hanya ?limit). Tambah param ?start=&end= di backend untuk rentang penuh.`

## E2. Filter kebun

- Halaman Riwayat sudah scoped per kebun via route `:id` + FarmSwitcher di Topbar. JANGAN bikin filter lintas-kebun baru (melanggar model akses per-kebun).
- Cukup pastikan label/heading menyebut nama kebun aktif (`summary.farm.name`) sebagai konteks. Tidak menambah dropdown kebun di halaman ini.

## Verifikasi Fase E

Filter tanggal mempersempit baris dengan benar; note keterbatasan tampil. Lapor, STOP.

# FASE F — Gateway: baris "Koneksi Internet" (placeholder + note)

Tujuan: siapkan slot UI koneksi internet gateway untuk masa depan, tanpa data palsu.

Konteks (dari user): rencananya gateway kebun konek ke web via gateway; pelaporan koneksi internet menyusul. Saat ini backend TIDAK punya field koneksi internet.

File: `src/features/gateway/GatewayPage.tsx`. Tambah `InfoRow` "Koneksi Internet".

- Nilai: tampilkan placeholder jujur "Belum dipantau" (tone neutral/muted). DILARANG menurunkan nilai dari `gateway_status` (itu status node, bukan internet) — jangan mengarang.
- Tambahkan komentar TODO:
  `// TODO (future): status koneksi internet gateway belum dilaporkan backend. Saat hardware gateway lapor konektivitas, tambah field (mis. internet_status) di response summary atau endpoint gateway, lalu render di sini.`

## Verifikasi Fase F

Baris tampil sebagai placeholder, tidak ada angka karangan. Lapor, STOP.

# FASE G — Log Koneksi Gateway (BACKEND dulu, lalu frontend)

Tujuan: bikin fondasi backend untuk log koneksi gateway, lalu tampilkan di frontend. Belum ada hardware yang mengisi, jadi endpoint boleh kembali kosong — itu wajar dan harus ditampilkan jujur.

## G1. Backend: tabel baru

File: `backend/app/database.py`, di dalam `init_db()` `executescript`, tambah (ikuti gaya tabel lain):

```sql
CREATE TABLE IF NOT EXISTS gateway_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    farm_id TEXT NOT NULL,
    event TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (farm_id) REFERENCES farms(id)
);
CREATE INDEX IF NOT EXISTS idx_gateway_logs_farm ON gateway_logs(farm_id);
```

`event` = string status koneksi (mis. "online", "offline", "connected", "disconnected"). Tidak ada enum dipaksakan di DB.

## G2. Backend: schema

File: `backend/app/schemas.py`. Tambah (ikuti gaya Pydantic yang ada):

```python
class GatewayLogIn(BaseModel):
    event: str = Field(..., min_length=1, max_length=50)
    detail: str = Field(default="", max_length=300)
```

## G3. Backend: endpoint

File: `backend/app/main.py`. Tambah dua endpoint, ikuti pola ownership `_get_farm_owned(connection, farm_id, current_user["id"])` dan dependency `get_current_user` yang sudah ada:

GET list (read-only):
```
GET /api/farms/{farm_id}/gateway-logs?limit=20   (limit 1–100, default 20)
-> verifikasi kepemilikan via _get_farm_owned
-> SELECT * FROM gateway_logs WHERE farm_id = ? ORDER BY created_at DESC, id DESC LIMIT ?
-> return { "items": [...], "total": len(items) }
```

POST insert (scaffolding untuk hardware gateway nanti):
```
POST /api/farms/{farm_id}/gateway-logs   body: GatewayLogIn
-> verifikasi kepemilikan via _get_farm_owned
-> INSERT INTO gateway_logs (farm_id, event, detail) VALUES (?, ?, ?)
-> return { "log": <row baru> }, status 201
```

Tambahkan komentar di atas kedua endpoint:
`# CATATAN: belum ada integrasi hardware gateway. Tabel gateway_logs akan kosong sampai gateway/perangkat melapor via POST ini. Frontend harus menampilkan empty state jujur.`

## G4. Frontend: query hook

File baru `src/features/gateway/queries.ts`. Tambah `useGatewayLogs(farmId)` (TanStack Query) yang panggil method baru di `src/lib/api.ts`:

```ts
getGatewayLogs: (farmId: string, limit = 20) =>
  apiFetch<{ items: GatewayLog[] }>(`/farms/${farmId}/gateway-logs?limit=${limit}`),
```

Tambah type `GatewayLog` di `src/types/index.ts`: `{ id: string|number; farm_id: string; event: string; detail: string; created_at: string }` (cocokkan dengan kolom tabel; verifikasi shape dari response asli sebelum dipakai, sesuai aturan anti-halusinasi).

## G5. Frontend: UI

File: `src/features/gateway/GatewayPage.tsx`. Tambah `Card` "Log Koneksi Gateway" yang render daftar dari `useGatewayLogs`.

- Kolom: waktu (`created_at`, pakai `timeAgo`/`formatLogTime`), event (badge), detail.
- Empty state (kemungkinan besar di awal): "Belum ada log koneksi gateway."
- Jangan isi data dummy.

## G6. Update dokumentasi

Setelah backend jalan, update `CLAUDE.md`:
- Tabel "Data": tambah `GET /api/farms/{id}/gateway-logs` dan `POST /api/farms/{id}/gateway-logs`.
- Database Schema: tambah baris `gateway_logs`.

## Verifikasi Fase G

Backend start tanpa error (`init_db` bikin tabel), `GET .../gateway-logs` balas `{ items: [], total: 0 }` untuk kebun valid dan 404 untuk kebun bukan milik user. Frontend tampil empty state. `npx tsc --noEmit` nol error. Lapor, STOP.

# JANGAN Dikerjakan (keputusan user 2026-06-24)

- Riwayat "Laporan Gateway": DIBATALKAN. Jangan tambahkan.
- "Konfigurasi Sistem" di Pengaturan: DIHAPUS dari rencana. Jangan tambahkan.

Kalau menemukan sisa referensi keduanya di kode/dokumen, hapus dengan hati-hati tanpa menyentuh fitur lain.

# Setelah Semua Fase Selesai

Lapor balik ke sesi Cowork (chat ini). Aku akan generate **catatan dokumentasi final** (apa yang ditambah, di file mana, penanda FUTURE/TODO mana yang masih menggantung) untuk kamu simpan sebagai referensi perbaikan berikutnya.
