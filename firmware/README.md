# Firmware LoraField

Firmware gateway dan node sensor untuk LilyGO LoRa32 (ESP32), proyek PlatformIO. Gateway bicara
ke server lewat MQTT sesuai [docs/kontrak-mqtt.md](../docs/kontrak-mqtt.md), sama dengan
simulator, jadi keduanya bisa saling menggantikan tanpa mengubah server.

Status: sudah di-compile dan logikanya dites di PC, **belum pernah dicoba di alat**. Pin,
frekuensi, dan kalibrasi di `include/config.h` masih perkiraan.

## Isi

| Bagian | Isi |
|--------|-----|
| `src/gateway/` | Terima paket LoRa dari node, teruskan ke MQTT, teruskan perintah valve ke node |
| `src/node/` | Baca DS18B20, DHT22, soil moisture, baterai; kirim lewat LoRa; jalankan relay valve |
| `lib/lorafield/` | Logika bersama tanpa Arduino: format paket LoRa, JSON kontrak, konversi sensor, timer valve |
| `include/config.h` | Pin, frekuensi LoRa, interval, kalibrasi. Satu-satunya file yang perlu disetel per alat |
| `test/test_logic/` | Tes logika `lib/lorafield` di PC |

## Cara kerja singkat

- ID alat dari MAC ESP32: gateway `GW-XXXXXXXXXXXX`, node `ND-XXXXXXXXXXXX`. ID gateway tampil di
  Serial Monitor saat menyala; pakai ID itu saat mendaftarkan kebun di web.
- Node mengirim data tiap 1 menit (plus jeda acak) dan selalu mendengarkan radio di antaranya.
- Gateway meneruskan perintah valve saat perintah datang, dan mengulanginya setelah node mengirim
  data kalau posisi valve yang dilaporkan belum sama.
- Node menutup valve sendiri saat waktu buka habis, walau perintah tutup tidak sampai. Satu
  perintah buka dibatasi maksimal 1 jam.
- DHT22 atau DS18B20 gagal dibaca: node mengirim bacaan valid terakhir. Sebelum ada bacaan valid
  pertama, node tidak mengirim data.

Paket LoRa (biner, little-endian, CRC LoRa aktif):

| Paket | Isi |
|-------|-----|
| Data sensor, 18 byte | `0x4C`, `1`, MAC node (6), kelembapan tanah, suhu tanah, suhu udara, kelembapan udara (masing-masing int16 sepersepuluh), baterai (`0xFF` = tidak diketahui), valve (0/1) |
| Perintah valve, 13 byte | `0x4C`, `2`, MAC node (6), buka (0/1), durasi detik (uint32) |

## Perintah

Butuh PlatformIO (ekstensi VS Code, atau `pip install platformio`). Jalankan dari folder ini:

```bat
pio test -e native
pio run -e gateway -e node
pio run -e gateway -t upload
pio run -e node -t upload
pio device monitor
```

Sebelum upload gateway, salin `include/secrets.example.h` menjadi `include/secrets.h` lalu isi
WiFi dan alamat broker. Tanpa file itu firmware tetap ter-compile dengan isi contoh (ada
peringatan saat compile).

## Sebelum dipasang di alat

- Cocokkan pin di `config.h` dengan wiring dan versi board.
- Kalibrasi soil moisture per sensor: catat angka ADC di udara (`SOIL_ADC_DRY`) dan di air
  (`SOIL_ADC_WET`).
- Cek level relay (`VALVE_ACTIVE_LEVEL`) dan pembagi tegangan baterai.
- Frekuensi, spreading factor, dan sync word gateway dan node wajib sama.
- Belum ada: enkripsi paket LoRa, TLS ke broker, update firmware lewat udara (OTA), deep sleep.
