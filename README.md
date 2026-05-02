# LoraField: Sistem Pertanian Presisi Berbasis LoRa

Dashboard web frontend untuk monitoring sensor dan otomasi irigasi lahan pertanian berbasis LoRa P2P.

## Deskripsi

LoraField memakai node sensor berbasis LILYGO LoRa32 untuk membaca kelembapan tanah, suhu tanah, suhu udara, dan kelembapan udara. Data dikirim lewat LoRa P2P ke gateway, lalu ditampilkan di dashboard web secara real-time. Sistem juga memakai prakiraan cuaca BMKG untuk menunda irigasi jika hujan diprediksi turun dalam 3 jam ke depan.

> Catatan: saat ini proyek masih frontend statis. Backend belum dibuat, sehingga data memakai dummy dan simulasi JavaScript.

## Struktur Folder

```text
.
|-- frontend/
|   |-- public/
|   |   `-- static/
|   |       |-- index.html          # Dashboard statis lama
|   |       |-- monitoring.html     # Monitoring detail sensor
|   |       |-- irrigation.html     # Kontrol dan pengaturan irigasi
|   |       |-- weather.html        # Prakiraan cuaca BMKG
|   |       |-- logs.html           # Log keputusan sistem
|   |       |-- image.png
|   |       |-- css/
|   |       |   |-- style.css       # Design system dan komponen UI
|   |       |   |-- dashboard.css   # Style khusus halaman
|   |       |   |-- premium.css
|   |       |   `-- responsive.css  # Breakpoint responsif
|   |       `-- js/
|   |           |-- dummy-data.js   # Data dummy node, cuaca, dan log
|   |           |-- main.js         # Logic utama, threshold, clock, sidebar
|   |           |-- charts.js       # Helper Chart.js
|   |           `-- simulation.js   # Simulasi data sensor real-time
|   |-- src/
|   |   |-- assets/
|   |   |-- components/
|   |   |-- layout/
|   |   |-- pages/
|   |   |-- features/
|   |   |-- hooks/
|   |   |-- context/
|   |   |-- redux/
|   |   |-- services/
|   |   |-- utils/
|   |   |-- App.jsx
|   |   |-- index.css
|   |   `-- main.jsx
|   |-- index.html
|   |-- package.json
|   |-- README.md
|   `-- vite.config.js
`-- README.md
```

## Cara Menjalankan

1. Clone atau download repository ini.
2. Masuk ke folder `frontend`.
3. Jalankan frontend React/Vite.

```bash
cd frontend
npm install
npm run dev
```

Versi halaman statis lama berada di `frontend/public/static/index.html`.

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

## Alur Data dan Logika Saat Ini

Proyek masih memakai data dummy dan simulasi frontend.

- `frontend/public/static/js/dummy-data.js` berisi data awal node, cuaca, log keputusan, dan riwayat sensor.
- `frontend/public/static/js/main.js` berisi logic bersama: threshold, status valve, badge, clock, sidebar, dan keputusan irigasi.
- `frontend/public/static/js/simulation.js` mengubah data dummy secara berkala, menambah riwayat sensor, dan menulis log baru saat keputusan berubah.
- `frontend/public/static/js/charts.js` hanya bertugas menampilkan data riwayat ke grafik Chart.js.

Aturan keputusan irigasi:

| Kondisi | Cuaca | Keputusan |
| --- | --- | --- |
| Kelembapan < threshold bawah | Tidak ada hujan | Valve terbuka |
| Kelembapan < threshold bawah | Ada prediksi hujan | Irigasi ditunda |
| Kelembapan > threshold atas | Apapun | Valve tertutup |
| Kelembapan dalam rentang threshold | Apapun | Mengikuti status valve sebelumnya |

Jika ada data yang terlihat tidak sesuai, cek urutannya dari `frontend/public/static/js/dummy-data.js`, lalu `makeIrrigationDecision()` di `frontend/public/static/js/main.js`, lalu `recordDecisionSnapshot()` di `frontend/public/static/js/simulation.js`.

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
- React/Vite scaffold
- Chart.js v4 via CDN
- Font Awesome 6 via CDN

## Capstone Design Project

Proyek ini merupakan bagian dari Capstone Design Project untuk pengembangan sistem pertanian presisi di D.I. Yogyakarta.
