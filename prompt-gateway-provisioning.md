# Implementation Prompt: Gateway Provisioning & Farm Claim System

Gunakan prompt ini di Claude Code / editor AI kamu untuk implementasi fitur ini di project LoraField.

---

## Context

Project: **LoraField** — Precision Agriculture System berbasis LoRaWAN.
Stack: ESP32 LoRa sensor nodes → LILYGO LoRa32 gateway → MQTT (Mosquitto) → FastAPI + SQLite backend → React/TypeScript frontend.

Hierarki data:
```
Account (user, JWT auth)
  └── Farms (banyak per akun)
        └── Gateway (TEPAT 1 per farm, relasi 1:1, nullable/transferable)
              └── Nodes (banyak per gateway)
```

Gateway ID diambil dari **ESP32 eFuse MAC** (hardware-derived, immutable), bukan input manual user. ID yang sama dipakai sebagai **MQTT Client ID**. Gateway bisa **unclaimed** (belum nempel farm manapun) atau **claimed** (nempel ke 1 farm), dan bisa **ditransfer** antar farm lewat proses unclaim → claim eksplisit (bukan overwrite langsung).

---

## Task 1 — Database Schema

Update/buat tabel berikut di SQLite (pakai SQLAlchemy models sesuai konvensi project yang sudah ada):

```sql
CREATE TABLE gateways (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT UNIQUE NOT NULL,      -- dari eFuse MAC, format: "gw-XXXXXXXXXXXX"
    farm_id INTEGER UNIQUE,              -- nullable = unclaimed; UNIQUE = enforce 1 farm : 1 gateway
    display_name TEXT,
    first_seen_at TIMESTAMP NOT NULL,
    last_seen_at TIMESTAMP,
    claimed_at TIMESTAMP,
    FOREIGN KEY (farm_id) REFERENCES farms(id)
);
```

Tabel `readings` (atau tabel data sensor kamu yang sudah ada) **wajib** menyimpan snapshot `farm_id` saat insert, bukan hasil JOIN live ke `gateways.farm_id`:

```sql
-- pastikan kolom ini ada di tabel readings
farm_id INTEGER NOT NULL   -- di-freeze saat insert, tidak berubah walau gateway pindah farm nanti
```

**Alasan**: kalau gateway pindah farm di kemudian hari, history data lama tidak boleh ikut "pindah kepemilikan" ke farm baru. Ini mencegah data historis farm A tercampur ke dashboard farm B.

Tambahkan migration script (pakai Alembic kalau sudah dipakai di project, atau manual migration sesuai konvensi yang ada) untuk perubahan ini tanpa merusak data existing.

---

## Task 2 — MQTT Provisioning Flow (Backend Listener)

Gateway yang baru boot akan publish "hello" message ke topic provisioning:

```
Topic: loraField/provision/{device_id}
Payload: { "device_id": "gw-XXXXXXXXXXXX", "firmware_version": "...", "timestamp": ... }
```

Buat MQTT subscriber di backend (integrasi dengan setup Mosquitto client yang sudah ada) yang:
1. Subscribe ke `loraField/provision/+`
2. Saat pesan masuk, cek apakah `device_id` sudah ada di tabel `gateways`
   - Kalau belum ada → insert row baru dengan `farm_id = NULL`, `first_seen_at = now()`
   - Kalau sudah ada → update `last_seen_at = now()`
3. Tidak melakukan auto-claim ke farm manapun — status tetap unclaimed sampai user melakukan aksi eksplisit di UI

---

## Task 3 — FastAPI Endpoints

Implementasikan endpoint berikut (sesuaikan prefix/router dengan konvensi project):

### `GET /gateways/unclaimed`
- Auth: JWT required
- Return list gateway dengan `farm_id IS NULL`, urutkan berdasarkan `first_seen_at` terbaru
- Response fields: `device_id`, `first_seen_at`, `last_seen_at`

### `POST /farms/{farm_id}/gateway/claim`
Body: `{ "device_id": "gw-XXXXXXXXXXXX", "display_name": "Gateway Zona Utara" }`

Validasi berurutan (stop di validasi pertama yang gagal, return error yang jelas):
1. **Auth**: user login valid?
2. **Authorization**: user punya akses ke `farm_id` ini? → 403 kalau tidak
3. **Device exists & unclaimed**: `device_id` ada di tabel gateways dan `farm_id IS NULL`? → 404 kalau device tidak ditemukan, 409 kalau sudah diklaim farm lain
4. **Farm belum punya gateway**: cek `farms.id = farm_id` belum punya gateway lain yang claimed → 409 kalau farm sudah punya gateway aktif (arahkan user untuk unclaim dulu)
5. Kalau semua lolos → update row: `farm_id`, `display_name`, `claimed_at = now()`

### `POST /farms/{farm_id}/gateway/unclaim`
- Auth + authorization sama seperti di atas
- Set `farm_id = NULL`, `display_name = NULL`, `claimed_at = NULL` pada row gateway yang match `farm_id`
- Gateway kembali muncul di `/gateways/unclaimed`

### `GET /farms/{farm_id}/gateway`
- Return detail gateway yang sedang terhubung ke farm ini (atau 404/null kalau belum ada)

---

## Task 4 — Frontend Flow (React/TypeScript)

Di alur registrasi/manajemen farm:

1. **Farm belum punya gateway**: tampilkan CTA "Hubungkan Gateway" → buka modal/halaman yang fetch `GET /gateways/unclaimed`, tampilkan list device yang terdeteksi (device_id + kapan pertama terlihat), user pilih satu + isi `display_name`, submit ke endpoint claim
2. **Farm sudah punya gateway**: tampilkan detail gateway (display_name, device_id, status online/offline berdasarkan `last_seen_at`), dengan opsi "Lepas Gateway dari Farm Ini" (confirm dialog wajib sebelum call endpoint unclaim, jelaskan konsekuensinya ke user)
3. Device ID **tidak pernah diinput manual oleh user** — selalu dipilih dari list hasil deteksi otomatis, untuk mencegah typo mismatch

Konsisten dengan pattern konsolidasi mock data ke single source of truth yang sedang berjalan di frontend — pastikan mock data untuk gateway list ini juga masuk ke source yang sama, bukan hardcoded terpisah.

---

## Task 5 — Firmware Reference (untuk validasi end-to-end nanti, tidak perlu dikerjakan sekarang)

Catat sebagai referensi, implementasi firmware menyusul setelah backend+frontend siap:

```cpp
uint64_t chipid = ESP.getEfuseMac();
char gatewayIdHex[13];
sprintf(gatewayIdHex, "%04X%08X", (uint16_t)(chipid >> 32), (uint32_t)chipid);
String deviceId = "gw-" + String(gatewayIdHex);

client.connect(deviceId.c_str(), mqtt_user, mqtt_pass);
client.publish(("loraField/provision/" + deviceId).c_str(), provisioningPayload);
```

---

## Testing Checklist

- [ ] Insert dummy row ke `gateways` dengan `farm_id = NULL`, pastikan muncul di `/gateways/unclaimed`
- [ ] Claim gateway ke farm A, pastikan tidak bisa diklaim lagi ke farm B (harus reject 409)
- [ ] Claim gateway kedua ke farm A yang sudah punya gateway → harus reject 409
- [ ] Unclaim gateway dari farm A, pastikan muncul lagi di unclaimed list
- [ ] Claim gateway yang sama ke farm B setelah unclaim → harus berhasil
- [ ] Insert dummy readings dengan farm_id snapshot, pindahkan gateway ke farm lain, pastikan readings lama tetap menunjuk farm_id yang lama (tidak ikut pindah)
- [ ] User A tidak bisa claim/unclaim gateway di farm milik User B (authorization check)
