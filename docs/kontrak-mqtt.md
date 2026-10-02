# Kontrak MQTT LoraField

Acuan bersama antara server LoraField, simulator (`simulator/`), dan firmware gateway. Selama
kedua pihak mengikuti dokumen ini, gateway asli bisa menggantikan simulator tanpa mengubah web
atau server.

Status: draf v1, 2026-09-28. Perubahan format wajib disepakati tim web dan tim IoT.

## Gambaran

```text
Node sensor --LoRa--> Gateway --WiFi/MQTT--> Broker (Mosquitto) <--> Server LoraField --> Web
```

- Hanya gateway yang bicara MQTT. Format paket LoRa antara node dan gateway bebas, ditentukan
  tim IoT, asalkan gateway bisa menyusun pesan di bawah.
- Gateway dan node: LilyGO LoRa32 (ESP32). Library MQTT yang umum: PubSubClient.

## Koneksi ke broker

| Hal | Nilai |
|-----|-------|
| Alamat | `mqtt://<ip-server>:1883` (lokal, tanpa TLS) |
| Client ID dan username | ID gateway (`device_id`) |
| Password | Satu password per gateway, diberikan admin server |
| Keep alive | 60 detik |
| Last Will | topik `status`, isi `{"state":"offline"}`, retain, QoS 1 |
| Ukuran pesan | Maks 1024 byte. Di PubSubClient panggil `setBufferSize(1024)` |
| Jam | Gateway wajib sinkron NTP sebelum menyambung (dipakai perintah valve) |

Setelah tersambung, gateway langsung: kirim `status` online, kirim `heartbeat` dan `nodes`, lalu subscribe
`lorafield/gw/{device_id}/node/+/valve/set` dan `lorafield/gw/{device_id}/cmd` dengan QoS 1.

## Aturan ID

- ID gateway dan ID node: huruf, angka, `-`, `_`, panjang 4–32 karakter. Tanpa spasi, `/`, `+`, `#`.
- Harus unik di seluruh sistem. Saran: dari MAC ESP32, mis. `GW-A1B2C3D4E5F6` dan `ND-A1B2C3D4E5F6`.
- Awalan `SIM-` khusus simulator, jangan dipakai alat asli.
- ID gateway yang sama diketik pengguna di web saat mendaftarkan kebun, jadi tempel labelnya di alat.
- Stiker node memuat 4 karakter terakhir ID (mis. `E5F6`), sama dengan nama bawaan node di web.

## Daftar topik

`{gw}` = ID gateway, `{node}` = ID node.

| Topik | Arah | QoS | Retain | Kapan dikirim |
|-------|------|-----|--------|---------------|
| `lorafield/gw/{gw}/status` | gateway ke server | 0 | ya | Saat tersambung, dan Last Will saat putus |
| `lorafield/gw/{gw}/heartbeat` | gateway ke server | 0 | tidak | Saat tersambung, lalu tiap 10 menit (di bawah batas offline 15 menit) |
| `lorafield/gw/{gw}/nodes` | gateway ke server | 0 | tidak | Saat tersambung, saat daftar node berubah, dan tiap heartbeat |
| `lorafield/gw/{gw}/node/{node}/reading` | gateway ke server | 0 | tidak | Tiap paket sensor diterima dari node |
| `lorafield/gw/{gw}/node/{node}/valve/set` | server ke gateway | 1 | ya | Saat posisi valve node harus berubah |
| `lorafield/gw/{gw}/cmd` | server ke gateway | 1 | tidak | Saat pengguna menekan "Ganti WiFi" di web |

Semua isi pesan berupa JSON UTF-8. Field yang tidak dikenal diabaikan server.

## Isi pesan

### status

```json
{"state": "online", "fw": "1.0.0"}
```

`fw` = versi firmware gateway (opsional). Saat restart terencana, gateway sebaiknya mengirim
`{"state": "offline"}` sendiri sebelum memutus koneksi. Saat mati mendadak, broker yang mengirim
Last Will.

### heartbeat

```json
{"uptime_s": 3600, "nodes_heard": 3, "wifi_ssid": "Rumah Pak Budi", "wifi_rssi": -58, "boot_reason": "power_on", "boot_id": 3141592653}
```

- `uptime_s`: detik sejak gateway menyala. Tidak boleh kembali ke 0 selama gateway menyala (firmware memakai
  pencacah 64-bit, bukan `millis()` yang berputar ke 0 setelah 49 hari). Server menghitung jam menyala
  (waktu terima dikurangi `uptime_s`); jam menyala yang maju lebih dari 1 menit dari heartbeat sebelumnya
  dicatat sebagai `restarted` ("Menyala ulang") di Log Gateway, pada perkiraan jam menyala itu. Heartbeat
  sendiri tidak dicatat di Log Gateway; ia hanya kabar (status online dan waktu terakhir di web).
- `nodes_heard`: jumlah node berbeda yang paketnya diterima sejak heartbeat sebelumnya.
- `wifi_ssid` (opsional): nama WiFi yang sedang dipakai gateway, maksimal 32 byte. Password WiFi tidak pernah
  dikirim. `wifi_rssi` (opsional): kekuatan sinyal WiFi gateway ke router, dBm, -120 sampai 0. Server
  menyimpan keduanya untuk kartu Gateway di web; nilai yang tidak sah diabaikan, nilai lama tetap.
- `boot_reason` (opsional): penyebab gateway menyala, salah satu dari `power_on` (listrik padam atau tombol RST,
  ESP32 tidak bisa membedakannya), `brownout` (listrik turun), `watchdog` (program macet), `crash` (program
  error), `planned` (restart dari firmware sendiri, mis. Ganti WiFi), `firmware_update` (versi firmware baru),
  `other`. Server menuliskannya di detail log `restarted`; kode lain dikosongkan.
- `boot_id` (opsional): nomor nyala, bilangan acak 1–4294967295 yang dibuat baru setiap gateway menyala. Nomor
  yang berbeda dari heartbeat sebelumnya berarti gateway sempat restart, berapa pun jaraknya. Tanpa `boot_id`
  (firmware lama, simulator), server memakai cara jam menyala dari `uptime_s` di atas.

### nodes

```json
{"nodes": [{"node_id": "ND-A1B2C3D4E5F6", "name": "Blok Utara"}]}
```

Daftar node yang dikelola gateway. Dikirim ulang tiap heartbeat, karena pengguna bisa mendaftarkan
kebun di web setelah gateway menyala dan pesan saat tersambung sudah terlewat. `name` opsional; kalau kosong server memberi nama
`Node <4 karakter terakhir ID>`. `name` hanya dipakai saat node pertama terdaftar; setelah itu nama diatur di web
dan tidak ditimpa daftar ini. Pesan ini hanya mendaftarkan node. Status online node tetap ditentukan
dari data sensor, bukan dari daftar ini.

### reading

```json
{"soil_moisture": 54.2, "soil_temp": 27.1, "air_temp": 30.4, "air_humidity": 71.0, "battery": 86.5, "rssi": -92, "valve": "closed"}
```

| Field | Satuan | Rentang | Wajib | Sumber |
|-------|--------|---------|-------|--------|
| `soil_moisture` | % | 0–100 | ya | Capacitive Soil Moisture Sensor. Node mengubah angka ADC mentah ke persen memakai kalibrasi per sensor (nilai ADC kering dan basah) |
| `soil_temp` | °C | -20–80 | ya | DS18B20 |
| `air_temp` | °C | -20–80 | ya | DHT22. Kalau gagal dibaca, kirim bacaan valid terakhir |
| `air_humidity` | % | 0–100 | ya | DHT22, aturan sama |
| `battery` | % | 0–100 | tidak | Node |
| `rssi` | dBm | -150–0 | tidak | Diukur gateway saat menerima paket LoRa, bukan dari node |
| `valve` | `open`/`closed` | | ya | Posisi valve yang sebenarnya saat ini, bukan perintah terakhir |

- Satu nilai di luar rentang membuat seluruh pesan ditolak. Contoh: DS18B20 yang gagal
  membaca `-127`. Jangan kirim nilai error sensor.
- Tiap node mengirim tiap 1–5 menit. Lebih dari 15 menit tanpa data, web menganggap node offline.
- Server mencatat waktu saat pesan diterima. Kalau koneksi putus, buang data lama dan jangan
  kirim tumpukannya saat tersambung lagi, karena akan tercatat dengan jam yang salah.

### valve/set (server ke gateway)

```json
{"state": "open", "until": 1790003600}
```

```json
{"state": "closed"}
```

- `until`: waktu valve wajib tertutup lagi, dalam epoch detik UTC. Gateway menghitung sisa waktu
  (`until` dikurangi jam NTP) lalu menyuruh node buka selama sisa waktu itu. Node menutup valve
  sendiri saat waktunya habis, walau perintah tutup tidak sampai. Ini pengaman kalau koneksi putus
  saat menyiram.
- Kalau sisa waktu sudah habis atau negatif, perlakukan sebagai `closed`.
- Kalau reading masih melaporkan posisi berbeda minimal 5 menit (`VALVE_RESEND_MINUTES` di server) setelah perintah terakhir dikirim, server mengirim ulang perintah yang sama. Gateway memprosesnya seperti perintah biasa.
- Pesan ini retain: gateway menerima perintah terakhir tiap kali subscribe ulang. Karena `until`
  berupa jam mutlak, perintah yang diterima ulang tidak memperpanjang waktu siram.
- Isi kosong berarti tidak ada perintah: valve tutup. Server mengirimnya (retain) untuk tiap node saat kebun dihapus atau gateway dilepas dari kebun.
- Gateway meneruskan perintah ke node pada kesempatan terima berikutnya (mis. tepat setelah node
  mengirim data). Node melaporkan posisi barunya lewat field `valve` di reading berikutnya. Web
  menampilkan perintah "terkirim ke alat" setelah posisi yang dilaporkan sama dengan perintah.

### cmd (server ke gateway)

```json
{"action": "wifi_portal"}
```

- `wifi_portal`: pengguna menekan "Ganti WiFi" di web. Gateway mengirim `status` offline sendiri, lalu
  membuka portal WiFi (hotspot `LoraField-XXXX`) selama 5 menit. WiFi lama tetap tersimpan: kalau tidak
  ada WiFi baru yang disimpan, gateway kembali memakai WiFi lama.
- Tidak retain, karena perintah yang tersimpan di broker akan dijalankan lagi setiap gateway menyambung.
  Server hanya mengirim perintah saat gateway online.
- `action` lain diabaikan gateway.

## Perilaku server

- Gateway yang belum didaftarkan pengguna ke kebun: semua pesannya diabaikan dan dicatat di log
  server. Data mulai diproses setelah pengguna mendaftarkan kebun di web dengan ID gateway itu.
- Node baru otomatis masuk kebun milik gateway saat reading pertamanya diterima. Node yang sudah
  terdaftar di kebun lain ditolak.
- Pesan rusak (bukan JSON, field wajib hilang, nilai di luar rentang) diabaikan dan dicatat di
  log server. Server tidak membalas error ke gateway.
- Gateway dianggap online kalau `status` online, `heartbeat`, `nodes`, atau `reading` diterima dalam
  15 menit terakhir (`GATEWAY_OFFLINE_AFTER_MINUTES` di server, terpisah dari batas offline node), atau
  ada node kebun yang masih mengirim data. `status` online dan offline tercatat di Log Gateway web. `status` offline (termasuk Last
  Will) langsung membuat gateway offline di web, sampai ada pesan baru darinya. `status` yang diterima
  ulang dari retain saat server menyambung ulang ke broker hanya dicatat di Log Gateway kalau berbeda
  dari laporan koneksi terakhir di log (gateway tersambung atau putus selagi server putus dari broker).
  Isinya sama dengan catatan biasa. `status` online dari retain tetap
  dihitung sebagai kabar.

## Keamanan

- Tiap gateway punya password sendiri. Broker membatasi gateway hanya boleh kirim dan subscribe
  di bawah `lorafield/gw/{device_id}/`.
- Versi lokal belum memakai TLS. Sebelum server online wajib pindah ke TLS (port 8883).

## Urutan normal

1. Gateway menyala, sambung WiFi, sinkron NTP, sambung broker dengan Last Will.
2. Gateway kirim `status` online, `heartbeat`, dan `nodes`, lalu subscribe `valve/set` dan `cmd`.
3. Node kirim data lewat LoRa. Gateway menambahkan `rssi` lalu kirim `reading`.
4. Server menghitung keputusan irigasi (mode Otomatis) atau memakai perintah pengguna (mode
   Manual). Kalau posisi valve harus berubah, server kirim `valve/set`.
5. Gateway meneruskan perintah ke node. Node membuka atau menutup valve, lalu reading berikutnya
   membawa posisi barunya.
6. Gateway mati mendadak: setelah keep alive habis (sekitar 1,5 menit), broker kirim Last Will.
   Kejadian itu tercatat di Log Gateway web dan status gateway langsung berubah offline. Tanpa Last
   Will (misalnya server sempat putus dari broker), status berubah offline setelah 15 menit tanpa
   pesan.

## Belum didukung di v1

- Data tertunda dengan jam asli (simpan dulu saat offline, kirim belakangan).
- Update firmware lewat udara (OTA).
- Perintah pengaturan dari server ke alat (interval kirim, kalibrasi sensor). Topik `cmd` baru
  dipakai untuk `wifi_portal`.
- TLS.
