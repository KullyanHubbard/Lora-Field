# Rencana Menuju Produk LoraField

Status: rencana, sebagian sudah dikerjakan (F1, F2, F3, F7 gateway, L1). Dibuat 2026-10-01 (Sesi 5),
diperbarui 2026-10-03.

Tujuan: LoraField siap dijual, bukan hanya demo. Setiap jalan pintas yang hanya cocok untuk uji
dicatat di sini beserta versi produknya.

## Keputusan yang sudah diambil (user, Sesi 5)

- Gateway ke server tetap memakai MQTT, bukan HTTPS: perintah valve sampai langsung, gateway mati
  langsung ketahuan (Last Will), dan sudah terbukti di alat asli.
- Server produksi: satu VPS dan domain, berisi web, backend, Mosquitto, dan SQLite. Vercel dan Turso
  tidak dipakai dulu, karena Vercel tidak bisa menjalankan broker dan pendengar MQTT yang menyala
  terus.
- Expo di kampus memakai VPS itu juga. Komputer rumah tidak dibuka ke internet.
- Anggapan sementara: gateway dipasang di rumah petani yang punya WiFi. Kebun tanpa WiFi (modem 4G,
  board dengan SIM) belum diputuskan.

## Status 2026-10-03

- Gateway asli (LoRa32 V2.1 915 MHz, firmware 0.2.8) tersambung lewat WiFi ke Mosquitto di komputer
  rumah, memakai password per alat dan aturan topik per gateway, lalu tampil di web (Kebun Sawit Kaur).
- Terbukti di alat: pengaturan dari memori, portal WiFi dan tombol Ganti WiFi, lampu status, watchdog,
  riwayat menyala ulang beserta penyebabnya.
- Node dan valve belum diuji di alat asli.

## Jalan pintas uji dan penggantinya

| Sekarang (uji) | Produk |
|----------------|--------|
| WiFi dan password MQTT tertanam lewat `include/secrets.h` (firmware 0.1.0) | Selesai sejak firmware 0.2.0: disimpan di memori alat, WiFi diisi petani lewat portal di HP (F1, F2). Terbukti di alat 2026-10-02 |
| Server di komputer rumah, `MQTT_HOST` berupa IP lokal | VPS dan domain, TLS port 8883 (S1, S2, F4) |
| Password MQTT dibuat manual dengan `mosquitto_passwd`, sama untuk semua alat, pernah tertulis di chat | Password acak unik per alat, dibuat saat produksi dan didaftarkan otomatis (S3, P1). Password uji diganti |
| Mosquitto sebagai layanan Windows (file `passwd` harus diberi izin baca untuk SYSTEM setiap kali diubah) | Layanan systemd di Linux |
| Gateway diberi daya dari port USB komputer (sempat restart terus karena tegangan turun) | Adaptor dengan spesifikasi tertentu (H2) |

## Server (S)

- **S1. Pindah ke VPS.** Backend, Mosquitto, dan web menyala otomatis. Firewall hanya membuka port
  yang dipakai (SSH, HTTP, HTTPS, MQTT TLS).
- **S2. HTTPS untuk web, TLS untuk MQTT (8883).** Mengubah alamat dan port di
  `docs/kontrak-mqtt.md`, jadi perlu persetujuan tim IoT.
- **S3. Pendaftaran password alat otomatis.** Tidak lagi lewat perintah manual per alat. Kandidat:
  plugin dynamic-security bawaan Mosquitto yang dikelola backend. Butuh desain bersama P1.
- **S4. Keamanan sebelum publik.** Tindak lanjut `docs/SECURITY_AUDIT_AUTH.md`, rahasia baru (JWT,
  password), cadangan database terjadwal, pemantauan server mati.
- **S5. Satu worker backend.** Batas percobaan login masih disimpan di memori proses, jadi backend
  wajib satu worker sampai dipindah ke database.

## Firmware gateway dan node (F)

- **F1. Pengaturan di memori alat.** Dikerjakan 2026-10-02 (firmware 0.2.0), terbukti di alat 2026-10-02.
  Alamat dan port broker, password MQTT, dan password hotspot disimpan dengan `Preferences`; diisi
  lewat USB dengan `firmware/tools/provision.py` (password tidak pernah dicetak balik). `secrets.h`
  dihapus. Alat tanpa pengaturan lengkap hanya menunggu perintah Serial.
- **F2. Portal WiFi.** Dikerjakan 2026-10-02 (firmware 0.2.0). WiFiManager 2.0.17, hotspot
  `LoraField-XXXX` dengan password per alat (WPA2), teks Indonesia, menu hanya Atur WiFi dan Keluar,
  halaman unggah firmware dan halaman bawaan lain ditutup. WiFi tersimpan dicoba 3 x 20 detik, portal
  5 menit (tidak ditutup selama ada HP tersambung), bergantian. HP langsung dibawa ke daftar WiFi
  saat tersambung ke hotspot. RST dua kali: portal dibuka tanpa menghapus WiFi lama (board uji tidak
  punya tombol BOOT). Jam NTP tidak lagi ditunggu selamanya. **Terbukti di alat 2026-10-02:** WiFi
  diisi dari iPhone lewat portal, gateway tersambung ke server. Hotspot tanpa nama yang sempat muncul
  ternyata akibat brownout, diatasi dengan mematikan pendeteksi brownout hanya selama menyambung WiFi.
  Tambahan (2026-10-02, keputusan user): WiFi putus saat berjalan dicoba ulang 10 menit lalu radio
  istirahat 5 menit (semula 30 menit), bergantian; tombol "Ganti WiFi" di halaman Gateway web (topik MQTT `cmd`,
  endpoint `POST /api/farms/{id}/gateway/wifi-portal`).
- **F3. Penanda status.** Dikerjakan 2026-10-02 (firmware 0.2.3, gateway), terbukti di alat. LED hijau
  bawaan (GPIO 25): menyala terus = tersambung, kedip ganda = WiFi tersambung tapi server belum, kedip
  lambat = WiFi belum tersambung, kedip cepat = portal WiFi, kedip singkat = mode pengaturan. Belum: jendela
  lampu di wadah (H2) dan arti lampu di stiker atau buku panduan (P1). OLED bawaan opsional (butuh library baru).
- **F4. TLS ke broker** (`WiFiClientSecure`, bawaan ESP32).
- **F5. Pengaman paket LoRa.** Sekarang paket tidak diamankan: siapa pun yang punya radio LoRa bisa
  memalsukan data sensor atau menyuruh valve membuka. Paket diberi tanda tangan dengan kunci per node
  dan nomor urut, supaya paket palsu dan paket lama yang diputar ulang ditolak.
- **F6. Update firmware lewat udara (OTA).** Wajib sebelum dijual banyak. Tanpa OTA, setiap perbaikan
  berarti mencolok USB ke tiap alat di lokasi petani.
- **F7. Watchdog.** Alat restart sendiri kalau macet. Dikerjakan 2026-10-02 (firmware 0.2.2, gateway):
  watchdog bawaan ESP32 mengawasi loop(), batas 2 menit. Terbukti di alat: loop yang sengaja dibuat
  macet di-restart tepat 2 menit kemudian dan tersambung lagi. Masa menyala (portal WiFi) tidak
  diawasi. Node belum.
- **F8. Kunci memori alat (flash encryption ESP32).** Tanpa ini, password MQTT dan password hotspot
  bisa dibaca dari memori gateway yang dibongkar. Sifatnya permanen (eFuse), jadi dipasang di tahap
  produksi setelah firmware stabil, bersama OTA.

## Perangkat keras dan produksi (H, P)

- **H1. Uji alat asli.** Pin sensor, kalibrasi soil moisture, level relay (Sesi 5 tahap D dan E).
- **H2. Daya dan wadah.** Spesifikasi adaptor gateway (minimal 5V 1A, perlu diukur), baterai dan
  panel surya node, wadah tahan cuaca. Temuan 2026-10-02: LoRa32 V2.1 tanpa baterai sering brownout
  saat radio WiFi menyala, di port USB komputer maupun charger 5V 1,2A, terutama setelah tombol RST.
  Menurunkan daya pancar WiFi tidak menolong. Kandidat solusi: baterai Li-ion di colokan baterai
  board, kapasitor besar di jalur 5V, adaptor dan kabel yang lebih baik. Uji 2026-10-02 sore: kepala
  charger HP USB-A yang sanggup 5V 3A (label: 5V=3A, 5V=4,5A, 4,5V=5A, 9V=2A, 12V=1,5A) membuat gateway
  menyala sekali dan tersambung dalam 13 detik, dua kali berturut-turut (colok dan RST), tanpa brownout;
  dari port USB komputer brownout 1-2 kali tiap menyala. Calon spesifikasi produk: adaptor 5V minimal 2A
  (perlu diukur arus puncaknya). Belum: uji portal WiFi dari charger ini, dan putusan apakah pendeteksi
  brownout boleh dinyalakan penuh lagi (setelah uji lebih lama dengan adaptor produk).
- **P1. Alur produksi per alat.** Flash firmware (hapus memori dulu supaya tidak membawa WiFi dari
  uji), buat password acak, simpan di alat dan server, cetak stiker (ID gateway, password hotspot,
  QR code WiFi, 4 karakter terakhir ID node). Awal alatnya sudah ada: `firmware/tools/provision.py`
  mengisi alat dan mencetak isi stiker. Yang belum: password MQTT acak dan pendaftaran otomatis ke
  broker (S3).

## Aturan dan izin (L), perlu dicek ahli

- **L1. Daya pancar LoRa.** Dikerjakan 2026-10-02 (firmware 0.2.5). Aturan: Kepmen Kominfo No. 5 Tahun
  2024 (Standar Teknis LPWAN Nonseluler), pita 920–923 MHz: node ≤ 100 mW EIRP (20 dBm), gateway ≤ 400 mW
  EIRP (26 dBm), bandwidth ≤ 250 kHz, duty cycle ≤ 1%. Angka dibaca dari rancangan konsultasi publik
  (November 2023); naskah final belum dicocokkan langsung, cek ulang saat L2. Firmware: 17 dBm tertulis di
  `config.h` (`LORA_TX_POWER_DBM`), dengan antena bawaan sekitar 3 dBi = sekitar 20 dBm EIRP, pas di batas
  node. Duty cycle node sekitar 0,3% (compile gagal kalau jarak kirim melewati 1%). Belum: ukur penguatan
  antena yang dipakai produk.
- **L2. Sertifikasi perangkat telekomunikasi (Komdigi) dan aturan TKDN** sebelum alat dijual. Temuan L1:
  gateway 920–923 MHz wajib punya filter dengan redaman lebih dari 50 dB di 915 dan 925 MHz (Kepmen 5/2024
  bagian Persyaratan Filter). Board LoRa32 tidak punya filter itu, jadi perlu filter SAW tambahan atau
  modul lain. Aturan yang sama meminta frekuensi dikunci dari pabrik; firmware sudah memenuhinya karena
  frekuensi hanya di `config.h`, tidak bisa diubah pengguna.

## Urutan saran

1. Selesaikan uji alat lokal: node (D) dan valve (E). Layanan Mosquitto sudah menyala sendiri.
2. VPS, domain, TLS, dan keamanan (S1, S2, S4, F4). Ini juga dipakai untuk expo.
3. Watchdog node (sisa F7). F1, F2, F3, dan watchdog gateway sudah terbukti di alat 2026-10-02.
4. F5, F6, lalu S3 dan P1.
5. Cocokkan L1 dengan naskah final Kepmen 5/2024, lalu L2 sebelum penjualan.

## Keputusan yang dibutuhkan dari user

1. OLED dipakai atau cukup LED.
2. Tanggal expo, untuk menentukan urutan.

Sudah diputuskan (2026-10-02): portal memakai WiFiManager, hotspot memakai password unik per alat
yang dicetak di stiker beserta QR code, heartbeat gateway 10 menit.
