# Firmware LoraField

Firmware gateway dan node sensor untuk LilyGO LoRa32 (ESP32), proyek PlatformIO. Gateway bicara
ke server lewat MQTT sesuai [docs/kontrak-mqtt.md](../docs/kontrak-mqtt.md), sama dengan
simulator, jadi keduanya bisa saling menggantikan tanpa mengubah server.

Status: gateway sudah dicoba di alat asli (2026-10-01, LoRa32 V2.1 915 MHz, firmware 0.1.0): radio
terdeteksi, tersambung ke WiFi dan Mosquitto dengan password, dan tampil di web. Portal WiFi dan
pengaturan lewat USB (firmware 0.2.0) dicoba di alat 2026-10-02: mode pengaturan, alat bantu produksi,
pengaturan dari memori, WiFi tersimpan, MQTT, RST dua kali, dan portal dari iPhone (pilih WiFi, simpan,
gateway tersambung ke server) berhasil. Board tanpa baterai sering brownout saat radio WiFi menyala dan
selama hotspot aktif (port USB komputer dan charger 5V 1,2A); akibatnya hotspot sempat tampil tanpa nama
dan board restart terus. Firmware kini mematikan pendeteksi brownout hanya selama menyambung WiFi
(`setBrownoutDetector`), dan sejak itu restart maupun portal di port USB komputer berjalan normal.
Perbaikan utamanya tetap di sumber daya (rencana produk H2). Log rinci WiFiManager untuk diagnosis:
`setDebugOutput(true, WM_DEBUG_VERBOSE)` di `connectWifi`. Node dan valve **belum dicoba di alat**; pin
sensor, relay, dan kalibrasi di `include/config.h` masih perkiraan.

## Isi

| Bagian | Isi |
|--------|-----|
| `src/gateway/` | Terima paket LoRa dari node, teruskan ke MQTT, teruskan perintah valve ke node |
| `src/node/` | Baca DS18B20, DHT22, soil moisture, baterai; kirim lewat LoRa; jalankan relay valve |
| `lib/lorafield/` | Logika bersama tanpa Arduino: format paket LoRa, JSON kontrak, konversi sensor, timer valve |
| `include/config.h` | Pin, frekuensi LoRa, interval, kalibrasi, waktu portal WiFi. Sama untuk semua alat sejenis |
| `include/wm_strings_id.h` | Teks portal WiFi dalam Bahasa Indonesia (turunan teks WiFiManager, lisensi MIT) |
| `include/lora_radio.h` | Menyalakan radio LoRa, satu urutan untuk gateway dan node |
| `tools/provision.py` | Alat bantu produksi: isi pengaturan per alat lewat USB dan cetak isi stiker |
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

## Pengaturan gateway (sejak firmware 0.2.0)

Tidak ada pengaturan yang ditanam di kode, jadi satu file firmware dipakai untuk semua gateway.

| Pengaturan | Disimpan di | Diisi oleh |
|------------|-------------|------------|
| Alamat dan port broker MQTT, password MQTT, password hotspot portal | Memori alat (`Preferences`, namespace `lorafield`) | Pembuat alat, lewat USB dengan `tools/provision.py` |
| WiFi | Memori WiFi ESP32 (WiFiManager) | Pembeli, lewat portal di HP |

**Saat produksi (sekali per alat):**

1. Upload firmware gateway.
2. Daftarkan gateway di broker dulu: username = ID gateway, dengan password MQTT-nya.
3. Jalankan alat bantu produksi. Password MQTT diketik tersembunyi lalu **dicek ke broker sebelum
   disimpan** (salah ketik langsung ditolak, pengaturan gateway tidak diubah). Password hotspot dibuat
   acak kalau `--ap-pass` tidak diisi:
   ```bat
   %USERPROFILE%\.platformio\penv\Scripts\python.exe tools\provision.py --port COM3 --mqtt-host 192.168.1.4
   ```
   Pilihan lain: `--portal` (langsung buka portal setelah selesai), `--forget-wifi` (hapus WiFi sisa
   uji, portal terbuka sendiri), `--skip-mqtt-check` (broker tidak terjangkau dari komputer produksi).
4. Cetak stiker dari hasilnya: ID gateway, nama dan password hotspot, QR code WiFi.

Gateway yang pengaturannya belum lengkap selalu masuk **mode pengaturan** dan hanya menunggu
perintah Serial, tidak pernah membuka hotspot tanpa password. Perintah Serial (115200 baud) bisa
juga diketik manual lewat `pio device monitor`: `show`, `set mqtt_host <alamat>`,
`set mqtt_port <port>`, `set mqtt_pass <password>`, `set ap_pass <password>`, `portal`,
`forget wifi`, `restart`. Password tidak pernah dicetak balik. Untuk mengubah pengaturan gateway yang sudah
berjalan, ketik `config` dalam 3 detik setelah menyala (alat bantu produksi melakukannya sendiri).

**Pembeli (sekali saat pemasangan):**

1. Nyalakan gateway. Gateway tanpa WiFi tersimpan membuka hotspot `LoraField-XXXX`
   (4 karakter terakhir ID gateway).
2. Sambungkan HP ke hotspot itu dengan password di stiker, atau pindai QR code-nya.
3. Halaman pengaturan terbuka sendiri (alamat cek internet iPhone, Android, dan Windows dialihkan ke
   `/wifi`). Satu kartu, tiga tahap: pilih WiFi, ketik password, lalu status **Menghubungkan ke
   Wi-Fi**, **Terhubung ke Wi-Fi**, atau **Gagal Terhubung ke Wi-Fi** (dengan tombol Coba Lagi).
   Halaman itu juga menampilkan ID gateway untuk didaftarkan di web. Kalau halaman tidak terbuka
   sendiri, buka browser ke `192.168.4.1`.

Halaman portal ada di `portal/index.html` (gaya mengikuti tema gelap web LoraField, font Geist ikut
tertanam, lisensi di `portal/GEIST-OFL.txt`) dan ditanam ke firmware lewat `board_build.embed_*` di
`platformio.ini`. Halaman ini menggantikan `/wifi` bawaan WiFiManager; penyimpanan tetap lewat
`/wifisave` bawaan WiFiManager. Alamat tambahan: `/scan.json` (daftar WiFi), `/status.json` (hasil
percobaan sambung), `/geist.woff2`. Status "Terhubung" bisa dilaporkan karena hotspot ditahan
`PORTAL_SUCCESS_NOTICE_MS` setelah berhasil; kalau HP sempat terputus saat hotspot berpindah kanal
dan tidak ada jawaban sama sekali selama 90 detik, halaman juga menganggap berhasil (hotspot hanya
ditutup kalau berhasil). Jaringan tersembunyi tidak bisa dipilih.

Ganti WiFi saat gateway online: tombol **Ganti WiFi** di halaman Gateway web LoraField. Server mengirim
perintah `wifi_portal` (topik `cmd`), gateway mengirim status offline lalu membuka portal 5 menit dengan
WiFi lama sebagai cadangan.

Ganti WiFi atau password router: tekan tombol RST dua kali dalam 3 detik. Portal dibuka 5 menit
tanpa menghapus WiFi lama; kalau tidak ada WiFi baru yang berhasil tersambung, gateway kembali memakai WiFi lama
(listrik berkedip dua kali tidak membuat gateway kehilangan WiFi). Restart karena brownout tidak
dihitung, dan permintaan portal tetap tersimpan sampai portal benar-benar terbuka. Lewat Serial:
`portal` (buka portal) atau `forget wifi` (hapus WiFi).

WiFiManager langsung menyimpan WiFi yang diketik di portal walau gagal tersambung. Karena itu gateway
menyalin WiFi lama sebelum portal dibuka dan memasangnya lagi kalau portal ditutup tanpa tersambung
(`wifiNeedsRestore`, dites di PC). Terbukti di alat 2026-10-02 (firmware 0.2.1): password salah lalu
portal ditinggal, gateway kembali ke WiFi lama. Di firmware 0.2.0 WiFi lama hilang.

Perilaku saat menyala: WiFi tersimpan dicoba 3 kali masing-masing 20 detik. Kalau gagal, portal
dibuka, lalu WiFi tersimpan dicoba lagi, bergantian, sampai tersambung (misalnya router menyala lebih
lambat setelah listrik padam). Portal ditutup setelah 5 menit tanpa HP tersambung ke hotspot; selama
masih ada HP tersambung, portal tetap terbuka. Jam NTP ditunggu tanpa menghentikan gateway. MQTT baru
disambungkan setelah jam sinkron. Halaman bawaan WiFiManager lain (menu, unggah firmware, hapus, info,
restart, keluar) ditutup. Perintah Serial yang masuk selama portal berjalan dibuang saat WiFi
tersambung, supaya tidak dijalankan belakangan.

WiFi putus saat gateway berjalan (router mati, sinyal hilang): portal tidak dibuka. Gateway memaksa
sambung ulang tiap 30 detik selama 10 menit (juga untuk penyebab putus yang tidak dicoba ulang sendiri
oleh driver WiFi): radio WiFi dimatikan lalu dinyalakan dari nol, dan alasan gagalnya ditulis di Serial
(mis. `NO_AP_FOUND` = WiFi tidak terlihat, `AUTH_FAIL` = ditolak). Uji alat 2026-10-02: di firmware 0.2.0
(`WiFi.reconnect()`) gateway tidak tersambung lagi selama 10 menit setelah router restart; di 0.2.1
tersambung sekitar 1 menit setelah router menyala. Router ZTE yang baru menyala sempat menolak dengan
`AUTH_FAIL` walau password benar. Kalau tetap gagal, radio WiFi dimatikan 5 menit (gateway memakai adaptor, jadi tidak perlu lama), lalu dicoba lagi
10 menit, bergantian, sampai tersambung. Begitu tersambung, MQTT menyambung dalam 5 detik. Angkanya di
`config.h` (`WIFI_RECONNECT_*`, `WIFI_REST_MS`), jadwalnya di `WifiRecovery` (`lib/lorafield`, dites di
PC). Kalau password router diganti, gateway tidak akan tersambung sendiri: pakai RST dua kali.

Lampu status (sejak firmware 0.2.3), LED **hijau** bawaan (GPIO 25, bukan lampu merah pengisian baterai):

| Lampu | Keadaan |
|-------|---------|
| Menyala terus | Tersambung ke server |
| Kedip ganda lalu jeda, tiap 2 detik | WiFi tersambung, server belum terjangkau |
| Kedip lambat (1 detik nyala, 1 detik mati) | WiFi belum tersambung (router mati, sinyal hilang, password router diganti) |
| Kedip cepat, 4 kali per detik | Portal WiFi terbuka |
| Kedip singkat tiap 2 detik | Mode pengaturan (alat belum diisi pabrik) |

Pola dihitung `statusLedOn` (`lib/lorafield`, dites di PC) dan dijalankan pewaktu `esp_timer`, jadi tetap
berkedip saat portal terbuka atau saat menyambung. Lampu tidak membuktikan program hidup; gateway yang macet
ditangani watchdog. Uji alat 2026-10-02: pola tersambung, portal, WiFi putus (router mati), dan server
putus (Mosquitto dihentikan) sesuai; mode pengaturan baru dites di PC.

Heartbeat (sejak firmware 0.2.4) dikirim juga tepat setelah tersambung ke broker, dan `uptime_s` memakai
pencacah 64-bit (`esp_timer_get_time`). Server memakai uptime itu untuk mencatat "Menyala ulang" di Riwayat
Koneksi dalam hitungan detik setelah gateway restart; heartbeat sendiri tidak dicatat. Sejak 0.2.6 heartbeat juga
membawa nama dan sinyal WiFi (`heartbeatJson`, dites di PC), yang tampil di kartu Gateway web. Prosesor gateway
berjalan di 160 MHz (`GATEWAY_CPU_MHZ`). Sejak 0.2.7 heartbeat membawa penyebab gateway menyala (`boot_reason`,
dari `esp_reset_reason` dan versi firmware yang disimpan di memori alat; `bootReasonCode`, dites di PC), yang
tampil di entri "Menyala ulang" di Riwayat Koneksi. Sejak 0.2.8 heartbeat juga membawa nomor nyala (`boot_id`,
acak dari `esp_random` saat heartbeat pertama), sehingga server tahu pasti gateway sempat restart walau jaraknya
kurang dari 1 menit (uji alat 2026-10-02: RST 52 detik setelah upload terlewat dengan cara jam menyala saja).

Watchdog (sejak firmware 0.2.2): kalau `loop()` gateway tidak berputar selama 2 menit
(`GATEWAY_WATCHDOG_S`), gateway restart sendiri dan Serial menulis "Restart sebelumnya karena gateway
macet (watchdog)" saat menyala lagi. Masa menyala, termasuk portal WiFi yang boleh terbuka lama, tidak
diawasi. Restart karena watchdog tidak dihitung sebagai tekan RST. Uji alat 2026-10-02: loop yang
sengaja dibuat macet di-restart tepat 2 menit kemudian, lalu tersambung lagi ke MQTT dalam 14 detik.

## Perintah

Butuh PlatformIO (ekstensi VS Code, atau `pip install platformio`). Jalankan dari folder ini:

```bat
pio test -e native
pio run -e gateway -e node
pio run -e gateway -t upload
pio run -e node -t upload
pio device monitor
```

## Sebelum dipasang di alat

- Cocokkan pin di `config.h` dengan wiring dan versi board.
- Kalibrasi soil moisture per sensor: catat angka ADC di udara (`SOIL_ADC_DRY`) dan di air
  (`SOIL_ADC_WET`).
- Cek level relay (`VALVE_ACTIVE_LEVEL`) dan pembagi tegangan baterai.
- Frekuensi, spreading factor, dan sync word gateway dan node wajib sama.
- Daya pancar (`LORA_TX_POWER_DBM`) mengikuti batas Indonesia (lihat komentar di `config.h`). Antena
  yang lebih besar dari 3 dBi wajib diimbangi dengan menurunkan angka itu.
- Belum ada: enkripsi paket LoRa, TLS ke broker, update firmware lewat udara (OTA), deep sleep,
  kunci memori alat (flash encryption). Lihat [docs/rencana-produk.md](../docs/rencana-produk.md).
