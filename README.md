# LoraField: Sistem Pertanian Presisi Berbasis LoRa

Dashboard web frontend untuk monitoring sensor dan otomasi irigasi lahan pertanian berbasis LoRa P2P.

## Deskripsi

LoraField memakai node sensor berbasis LILYGO LoRa32 untuk membaca kelembapan tanah, suhu tanah, suhu udara, dan kelembapan udara. Data dikirim lewat LoRa P2P ke gateway, lalu ditampilkan di dashboard web secara real-time. Sistem juga memakai prakiraan cuaca BMKG untuk menunda irigasi jika hujan diprediksi turun dalam 3 jam ke depan.

> Catatan: saat ini proyek masih frontend statis. Backend belum dibuat, sehingga data memakai dummy dan simulasi JavaScript.

## Struktur Folder

```text
.
|-- index.html          # Dashboard utama
|-- monitoring.html     # Monitoring detail sensor
|-- irrigation.html     # Kontrol dan pengaturan irigasi
|-- weather.html        # Prakiraan cuaca BMKG
|-- logs.html           # Log keputusan sistem
|-- css/
|   |-- style.css       # Design system dan komponen UI
|   |-- dashboard.css   # Style khusus halaman
|   `-- responsive.css  # Breakpoint responsif
|-- js/
|   |-- dummy-data.js   # Data dummy node, cuaca, dan log
|   |-- main.js         # Logic utama, threshold, clock, sidebar
|   |-- charts.js       # Helper Chart.js
|   `-- simulation.js   # Simulasi data sensor real-time
`-- README.md
```

## Cara Menjalankan

1. Clone atau download repository ini.
2. Buka `index.html` langsung di browser.
3. Navigasi antar halaman memakai sidebar.

```bash
# Alternatif memakai local server
npx serve .
```

## Fitur Frontend

- **Dashboard** - Ringkasan sistem, sensor, irigasi, grafik, cuaca, dan log
- **Monitoring** - Detail node sensor, progress bar, grafik riwayat, dan tabel data
- **Irigasi** - Pengaturan threshold fleksibel, logika kendali, dan simulasi kondisi
- **Cuaca** - Data BMKG, forecast 3 jam, weather code, dan pengaruh ke irigasi
- **Log Sistem** - Filter, pencarian, dan tabel keputusan lengkap

## Catatan Threshold

Nilai threshold kelembapan tanah tidak permanen:

- Default bawah: 40% VWC
- Default atas: 70% VWC

Threshold dapat diubah dari halaman Irigasi dan disimpan di `localStorage`. Nilai perlu dikalibrasi berdasarkan:

- Jenis tanaman
- Karakteristik tanah
- Hasil pengujian lapangan

## Rencana Integrasi Backend

| Komponen | Teknologi | Status |
| --- | --- | --- |
| Backend API | FastAPI | Belum dibuat |
| Database | SQLite | Belum dibuat |
| Message Broker | Mosquitto MQTT | Belum diintegrasikan |
| Real-time Update | WebSocket | Belum diintegrasikan |
| Data Cuaca | API BMKG | Masih dummy |
| Node Sensor | LILYGO LoRa32 | Hardware terpisah |

## Teknologi Frontend

- HTML5
- CSS3
- JavaScript vanilla
- Chart.js v4 via CDN
- Font Awesome 6 via CDN

## Capstone Design Project

Proyek ini merupakan bagian dari Capstone Design Project untuk pengembangan sistem pertanian presisi di D.I. Yogyakarta.
