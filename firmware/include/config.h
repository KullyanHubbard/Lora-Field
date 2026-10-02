// Pengaturan perangkat keras. Selain pin radio LoRa, pin dan angka kalibrasi di sini BELUM diverifikasi
// dengan alat: sesuaikan dengan wiring dan hasil kalibrasi tim IoT sebelum di-flash.
#pragma once

#define FIRMWARE_VERSION "0.2.8"

// Radio LoRa, board LilyGO T3 v1.6.1 (PlatformIO: ttgo-lora32-v21). Versi board lain beda pin.
// Uji alat 2026-10-01, LoRa32 V2.1 915 MHz: radio terdeteksi (SCK, MISO, MOSI, SS benar). RST dan DIO0
// sama dengan pin resmi board, terbukti penuh setelah gateway menerima paket dari node.
#define LORA_SCK 5
#define LORA_MISO 19
#define LORA_MOSI 27
#define LORA_SS 18
#define LORA_RST 23
#define LORA_DIO0 26
// Pita AS923 Indonesia: 920–923 MHz. Gateway dan node wajib sama persis.
#define LORA_FREQUENCY 922E6
#define LORA_SPREADING_FACTOR 9
#define LORA_SYNC_WORD 0x4C
// Daya pancar chip (dBm, pin PA_BOOST), dipakai gateway dan node. Batas Indonesia pita 920–923 MHz: Kepmen
// Kominfo No. 5 Tahun 2024 (Standar Teknis LPWAN Nonseluler), Tabel 1: node ≤ 100 mW EIRP (20 dBm),
// gateway ≤ 400 mW EIRP (26 dBm), bandwidth ≤ 250 kHz, duty cycle ≤ 1%. Angka dibaca dari rancangan
// konsultasi publik Kominfo (November 2023); naskah final belum dicocokkan langsung. EIRP = daya chip +
// penguatan antena: 17 dBm + antena bawaan sekitar 3 dBi (belum diukur) = sekitar 20 dBm, pas di batas
// node. Antena lebih dari 3 dBi: turunkan angka ini. Bandwidth memakai bawaan chip (125 kHz).
#define LORA_TX_POWER_DBM 17
// Waktu pancar satu paket data node (18 byte, SF9, 125 kHz, CR 4/5, preamble 8, CRC): sekitar 185 ms.
#define NODE_PACKET_AIRTIME_MS 185UL

// Node: pin sensor dan relay valve.
#define SOIL_PIN 34          // Capacitive Soil Moisture Sensor, ADC1 (ADC2 tidak bisa dipakai bersama radio)
#define DS18B20_PIN 14       // suhu tanah, butuh resistor pull-up 4.7k
#define DHT22_PIN 4          // suhu dan kelembapan udara
#define VALVE_PIN 13         // relay solenoid valve
#define VALVE_ACTIVE_LEVEL HIGH  // banyak modul relay aktif LOW, ganti kalau begitu
#define BATTERY_PIN 35       // pembagi tegangan baterai bawaan board

// Kalibrasi soil moisture: angka ADC mentah saat sensor di udara kering dan di air. Beda tiap sensor.
#define SOIL_ADC_DRY 3200
#define SOIL_ADC_WET 1300
#define SOIL_SAMPLES 16

// Baterai Li-ion 1 sel. Pembagi tegangan board membagi 2.
#define BATTERY_DIVIDER 2.0f
#define BATTERY_EMPTY_V 3.3f
#define BATTERY_FULL_V 4.2f

// Node kirim data tiap interval ini, ditambah jeda acak supaya node tidak bertabrakan.
// Harus di bawah 15 menit (batas offline server).
#define NODE_SEND_INTERVAL_MS 60000UL
#define NODE_SEND_JITTER_MS 5000UL
// Duty cycle ≤ 1% (Kepmen Kominfo 5/2024): jarak kirim minimal 100 kali waktu pancar satu paket.
static_assert(NODE_SEND_INTERVAL_MS >= 100 * NODE_PACKET_AIRTIME_MS,
              "NODE_SEND_INTERVAL_MS terlalu pendek: duty cycle node melewati 1%");

// Gateway. Heartbeat 10 menit (keputusan user, 2026-10-02), harus di bawah 15 menit (batas offline server).
#define GATEWAY_HEARTBEAT_MS 600000UL
#define GATEWAY_MAX_NODES 16
#define MQTT_RETRY_MS 5000UL
#define CLOCK_LOG_MS 10000UL  // pesan "menunggu jam NTP" di Serial
// Watchdog (rencana produk F7): loop() yang tidak berputar selama ini membuat gateway restart sendiri.
// Satu putaran normal paling lama kira-kira 1 menit saat broker tidak menjawab (cari alamat domain 15
// detik, sambung TCP 3 detik, tunggu balasan PubSubClient 15 detik, ditambah kiriman yang tersendat),
// jadi batasnya 2 menit. Masa menyala (termasuk portal WiFi, yang boleh terbuka lama) tidak diawasi.
#define GATEWAY_WATCHDOG_S 120
// Lampu status gateway (rencana produk F3): LED hijau bawaan board (LED_BUILTIN = 25 di definisi board
// ttgo-lora32-v21). Polanya di statusLedOn (lib/lorafield), dihitung ulang tiap STATUS_LED_TICK_MS oleh
// pewaktu esp_timer, jadi tetap berkedip saat loop() sibuk (portal WiFi, menyambung).
#define GATEWAY_LED_PIN 25
#define STATUS_LED_TICK_MS 25

// Portal WiFi gateway (docs/rencana-produk.md F2). WiFi tersimpan dicoba WIFI_CONNECT_RETRIES kali,
// masing-masing WIFI_CONNECT_TIMEOUT_S detik. Gagal atau belum ada WiFi: hotspot LoraField-XXXX dibuka
// WIFI_PORTAL_TIMEOUT_S detik, lalu WiFi tersimpan dicoba lagi, bergantian.
#define WIFI_CONNECT_TIMEOUT_S 20
#define WIFI_CONNECT_RETRIES 3
// 5 menit (keputusan user, 2026-10-02), dihitung hanya saat tidak ada HP tersambung ke hotspot.
#define WIFI_PORTAL_TIMEOUT_S 300
// Setelah berhasil terhubung lewat portal, hotspot ditahan selama ini supaya halaman di HP sempat
// menampilkan "Terhubung ke Wi-Fi" sebelum hotspot dimatikan.
#define PORTAL_SUCCESS_NOTICE_MS 8000UL
// WiFi putus saat gateway berjalan (keputusan user, 2026-10-02): sambung ulang dipaksa tiap 30 detik
// selama 10 menit; kalau tetap gagal, radio WiFi istirahat 5 menit, lalu coba lagi. Istirahat awalnya 30 menit
// (hemat daya); jadi 5 menit (keputusan user, 2026-10-02) karena gateway memakai adaptor, bukan baterai.
// Uji alat 2026-10-02 (router ZTE dimatikan 2 menit): firmware 0.2.1 tersambung lagi sekitar 1 menit
// setelah router menyala; masa istirahat 30 menit lalu coba lagi juga terbukti (tersambung dalam 5 detik).
#define WIFI_RECONNECT_WINDOW_MS 600000UL
#define WIFI_RECONNECT_EVERY_MS 30000UL
#define WIFI_REST_MS 300000UL
// Jeda setelah menyala: perintah "config" lewat Serial (tools/provision.py), dan batas tekan RST kedua
// untuk membuka portal (RST dua kali; board LoRa32 V2.1 uji tidak punya tombol BOOT).
// Catatan uji 2026-10-02: board tanpa baterai sering brownout saat radio WiFi baru menyala dan selama
// hotspot portal aktif (port USB komputer dan charger 5V 1,2A). Menurunkan daya pancar tidak menolong.
// Firmware mematikan pendeteksi brownout hanya selama menyambung WiFi (lihat setBrownoutDetector di
// src/gateway/main.cpp); perbaikan utamanya di sumber daya (rencana produk H2).
// Uji alat 2026-10-02 sore: dari port USB komputer, setiap menyala gateway 1-2 kali brownout sekitar 5 detik
// setelah WiFi tersambung (sekitar 35 detik sampai tersambung). Dari kepala charger HP USB-A (5V sampai 3A),
// dua kali menyala (colok dan RST) masing-masing tersambung dalam 13 detik tanpa brownout.
#define CONFIG_WINDOW_MS 3000UL
// Kecepatan prosesor gateway (keputusan user, 2026-10-02): 160 MHz, bawaan 240 MHz. Gateway tidak butuh
// prosesor cepat; arus dasar turun sedikit (perkiraan 10-20 mA). Bukan obat brownout: lonjakan arus berasal
// dari radio WiFi (rencana produk H2). Dengan WiFi aktif ESP32 hanya mendukung 240, 160, atau 80 MHz.
#define GATEWAY_CPU_MHZ 160
