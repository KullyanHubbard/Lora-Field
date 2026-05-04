# CODEX.md

Panduan kerja untuk Codex saat membantu pengembangan LoraField.

## Tujuan Proyek

LoraField adalah dashboard web untuk monitoring kebun berbasis LoRa. User login dengan akun pribadi, melihat ringkasan semua kebun miliknya di Dashboard Utama, lalu memilih salah satu kebun dari Peta Kebun Interaktif atau card kebun untuk masuk ke Detail Kebun.

Revisi aktif: struktur web dashboard LoraField revisi 1.3 dengan fitur map pemilihan kebun.

## Konteks Repo

- `frontend/`: scaffold React/Vite
- `frontend/public/static/`: halaman statis lama berbasis HTML/CSS/JS
- `backend/`: backend basic FastAPI + SQLite
- `AGENTS.md`: aturan proyek singkat
- Root repo hanya untuk dokumentasi dan metadata proyek

Jika membuat perubahan, baca file terkait terlebih dahulu dan ikuti pola lokal yang sudah ada.

## Alur Produk

```text
Login
-> Dashboard Utama
-> Ringkasan seluruh kebun user
-> Peta Kebun Interaktif
-> Pilih kebun dari marker map atau card
-> Detail Kebun
-> Monitoring lengkap kebun terpilih
```

Dashboard Utama tidak boleh langsung menjadi halaman monitoring detail. Dashboard hanya berisi ringkasan seluruh kebun dan pintu masuk ke detail per kebun.

## Modul Web

Modul utama:

- Login Page
- Dashboard Utama
- Peta Kebun Interaktif
- Daftar Kebun / Kebun Saya
- Detail Kebun
- Monitoring Sensor
- Grafik Monitoring
- Irigasi
- Gateway
- Node Sensor
- Cuaca BMKG
- Riwayat / Laporan
- Settings

Menu sidebar:

```text
Dashboard
Kebun Saya
Monitoring
Irigasi
Gateway
Node Sensor
Cuaca
Riwayat
Settings
```

Jangan mengubah urutan atau konsep sidebar kecuali user meminta.

## Dashboard Utama

Dashboard Utama harus menampilkan:

- Sapaan user
- Total kebun
- Gateway online
- Gateway offline
- Node aktif
- Node bermasalah
- Rata-rata kelembapan tanah seluruh kebun
- Status irigasi keseluruhan
- Peringatan penting
- Peta Kebun Interaktif
- Card/daftar kebun

Card kebun harus berisi:

- Nama kebun
- Lokasi
- Jenis tanaman
- Status gateway
- Rata-rata kelembapan tanah
- Status valve
- Status irigasi
- Prediksi hujan singkat
- Last update
- Tombol `Lihat Detail`

## Peta Kebun Interaktif

Map adalah fitur revisi 1.3 dan wajib dipertahankan pada Dashboard Utama.

Perilaku map:

- Tampilkan marker hanya untuk kebun milik user yang login
- Klik marker membuka popup ringkasan kebun
- Popup memiliki tombol `Lihat Detail`
- Klik `Lihat Detail` membuka Detail Kebun untuk farm yang dipilih
- Card dan marker harus menuju data detail yang sama
- Kebun yang dipilih boleh diberi highlight

Data minimal untuk kebun:

```text
id
name
location
crop_type
area
latitude
longitude
bmkg_region_code
gateway_status
node_count
average_soil_moisture
valve_status
irrigation_status
weather_summary
last_update
```

## Detail Kebun

Detail Kebun hanya menampilkan data untuk satu kebun terpilih.

Isi utama:

- Informasi kebun
- Status utama kebun
- Gateway
- Node sensor
- Monitoring sensor
- Grafik historis
- Irigasi
- Cuaca BMKG
- Riwayat sistem

Status utama kebun:

- Gateway online/offline
- Jumlah node aktif
- Jumlah node bermasalah
- Rata-rata kelembapan tanah
- Status valve
- Status irigasi
- Prediksi hujan BMKG
- Peringatan penting

## Data dan Akses

Model akses:

```text
User -> Farm -> Gateway -> Node -> Sensor Data -> Irrigation Log -> Dashboard
```

Aturan penting:

- User biasa hanya melihat farm/kebun miliknya
- Jangan mencampur data kebun lintas user
- Admin pusat boleh memiliki akses semua kebun hanya jika fitur admin sedang dibuat
- Setiap kebun diasumsikan memiliki satu gateway
- Satu gateway menerima data dari beberapa node sensor

## Logika Irigasi

Keputusan sistem:

- Buka valve jika kelembapan tanah di bawah threshold dan tidak ada prediksi hujan
- Tutup valve jika kelembapan tanah sudah cukup
- Tunda irigasi jika BMKG memprediksi hujan
- Tunggu data terbaru jika gateway offline

Data irigasi:

- Status valve
- Mode otomatis/manual
- Threshold bawah kelembapan tanah
- Threshold atas kelembapan tanah
- Keputusan sistem
- Alasan keputusan
- Durasi irigasi
- Riwayat buka/tutup/tunda valve

## UI dan Copywriting

- UI label memakai Bahasa Indonesia
- Pertahankan istilah teknis: LoRa, VWC, MQTT, Gateway, Node, BMKG, RSSI
- Tema gelap proyek: `#0d1117`
- Aksen utama: `#00e676`
- Badge status konsisten: hijau untuk normal/online, kuning untuk peringatan, merah untuk masalah/offline
- Hindari inline style, gunakan CSS class
- Dashboard operasional harus ringkas, rapi, dan mudah discan
- Jangan membuat hero/landing page kecuali user meminta eksplisit

## Cara Kerja Codex

- Baca struktur dan file terkait sebelum mengubah kode
- Gunakan perubahan kecil yang langsung menjawab kebutuhan user
- Jangan refactor luas tanpa alasan
- Jangan menghapus perubahan user
- Jika menyentuh frontend, pastikan tampilan responsive dan tidak ada teks saling tumpang tindih
- Jika menyentuh backend, pertahankan struktur FastAPI yang sudah ada
- Jika menjalankan test/build gagal karena dependency belum terpasang, laporkan dengan jelas

## Referensi File

- Static dashboard lama: `frontend/public/static/index.html`
- CSS utama static: `frontend/public/static/css/style.css`
- Logic static utama: `frontend/public/static/js/main.js`
- Dummy data static: `frontend/public/static/js/dummy-data.js`
- React entry: `frontend/src/App.jsx`
- Backend API: `backend/app/main.py`
- Backend schema: `backend/app/schemas.py`
