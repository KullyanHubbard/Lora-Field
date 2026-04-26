# LoraField: Sistem Pertanian Presisi Berbasis LoRa

Dashboard web frontend untuk sistem monitoring dan otomasi irigasi lahan pertanian berbasis LoRa P2P.

## Deskripsi

LoraField adalah sistem pertanian presisi yang menggunakan node sensor berbasis LILYGO LoRa32 untuk membaca kelembapan tanah, suhu tanah, suhu udara, dan kelembapan udara. Data dikirim melalui LoRa P2P ke gateway, lalu ditampilkan ke dashboard web secara real-time. Sistem juga menggunakan prakiraan cuaca BMKG untuk menunda irigasi jika hujan diprediksi turun dalam 3 jam ke depan.

> **Catatan:** Saat ini hanya frontend. Backend belum dibuat. Semua data menggunakan dummy dan simulasi JavaScript.

## Struktur Folder

```
├── index.html          # Dashboard utama
├── monitoring.html     # Monitoring detail sensor
├── irrigation.html     # Kontrol dan pengaturan irigasi
├── weather.html        # Prakiraan cuaca BMKG
├── logs.html           # Log keputusan sistem
├── about.html          # Tentang proyek
├── css/
│   ├── style.css       # Style utama dan design system
│   ├── dashboard.css   # Style khusus dashboard
│   └── responsive.css  # Responsive breakpoints
├── js/
│   ├── dummy-data.js   # Data dummy (node, cuaca, log)
│   ├── main.js         # Logic utama (threshold, clock, sidebar)
│   ├── charts.js       # Chart.js helper functions
│   └── simulation.js   # Simulasi data sensor real-time
├── assets/
│   ├── icons/
│   └── images/
└── README.md
```

## Cara Menjalankan

1. Clone atau download repository ini.
2. Buka `index.html` langsung di browser (tidak perlu server).
3. Navigasi antar halaman menggunakan sidebar.

```bash
# Atau gunakan live server
npx serve .
```

## Fitur Frontend

- **Dashboard** — Ringkasan sistem, sensor, irigasi, grafik, cuaca, dan log
- **Monitoring** — Detail node sensor, progress bar, grafik riwayat, tabel data
- **Irigasi** — Pengaturan threshold fleksibel (localStorage), logika kendali, simulasi kondisi
- **Cuaca** — Data BMKG, forecast 3 jam, weather code, pengaruh ke irigasi
- **Log Sistem** — Filter, search, tabel keputusan lengkap dengan badge warna
- **Tentang** — Deskripsi proyek, teknologi, topologi, sensor, aktuator

## Catatan Threshold

Nilai threshold kelembapan tanah **tidak permanen**:

- **Default bawah:** 40% VWC
- **Default atas:** 70% VWC

Threshold dapat diubah dari halaman Irigasi dan disimpan di `localStorage`. Nilai perlu dikalibrasi berdasarkan:
- Jenis tanaman (padi, salak, dll.)
- Karakteristik tanah
- Hasil pengujian lapangan

## Rencana Integrasi Backend

| Komponen | Teknologi | Status |
|----------|-----------|--------|
| Backend API | FastAPI | Belum dibuat |
| Database | SQLite | Belum dibuat |
| Message Broker | Mosquitto MQTT | Belum diintegrasikan |
| Real-time Update | WebSocket | Belum diintegrasikan |
| Data Cuaca | API BMKG | Masih dummy |
| Node Sensor | LILYGO LoRa32 | Hardware terpisah |

## Teknologi Frontend

- HTML5
- CSS3 (Vanilla, tanpa framework)
- JavaScript (Vanilla, tanpa framework)
- Chart.js v4 (via CDN)
- Font Awesome 6 (via CDN)
- Google Fonts (Inter)

## Capstone Design Project

Proyek ini merupakan bagian dari Capstone Design Project untuk pengembangan sistem pertanian presisi di D.I. Yogyakarta.
