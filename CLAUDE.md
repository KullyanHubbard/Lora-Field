# CLAUDE.md

Panduan kerja untuk Claude saat membantu pengembangan LoraField.

## Ringkasan Proyek

LoraField adalah web dashboard monitoring pertanian presisi berbasis LoRa. Sistem digunakan user untuk memantau satu atau beberapa kebun miliknya, melihat data node sensor, status gateway, status valve, keputusan irigasi, prakiraan cuaca BMKG, grafik historis, dan riwayat sistem.

Alur utama revisi 1.3:

```text
User membuka Web LoraField
-> Login menggunakan akun dan password
-> Sistem memverifikasi akun
-> User masuk ke Dashboard Utama
-> Dashboard menampilkan ringkasan semua kebun user
-> Dashboard menampilkan Peta Kebun Interaktif
-> User memilih kebun dari marker map atau card kebun
-> User masuk ke Detail Kebun
-> Sistem menampilkan monitoring lengkap kebun terpilih
```

## Stack dan Struktur Repo

- Frontend scaffold: React/Vite di `frontend/`
- Halaman statis lama: HTML/CSS/JS vanilla di `frontend/public/static/`
- Backend basic: FastAPI + SQLite di `backend/`
- Root repo hanya untuk metadata proyek, dokumentasi, dan instruksi agent
- Label UI memakai Bahasa Indonesia
- Istilah teknis tetap dipertahankan: LoRa, VWC, MQTT, Gateway, Node, BMKG, RSSI

## Struktur Web Revisi 1.3

Struktur utama web:

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

Sidebar utama:

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

Jangan mengubah struktur sidebar kecuali user meminta eksplisit.

## Dashboard Utama

Dashboard Utama adalah halaman pertama setelah login. Tujuannya adalah memberi ringkasan cepat seluruh kebun milik user, bukan menampilkan semua data detail.

Isi Dashboard Utama:

- Sapaan user
- Jumlah kebun milik user
- Jumlah gateway online
- Jumlah gateway offline
- Jumlah node aktif
- Jumlah node bermasalah
- Rata-rata kelembapan tanah seluruh kebun
- Status irigasi keseluruhan
- Peringatan penting
- Peta Kebun Interaktif
- Daftar/card kebun

## Peta Kebun Interaktif

Peta Kebun Interaktif adalah fitur utama revisi 1.3. Map tampil di Dashboard Utama dan menampilkan semua kebun milik user sebagai marker.

Fungsi map:

- Menampilkan posisi semua kebun milik user
- Memudahkan pemilihan kebun berdasarkan lokasi
- Menampilkan popup ringkasan saat marker diklik
- Menyediakan tombol `Lihat Detail` dari popup
- Menampilkan highlight kebun yang sedang dipilih
- Mendukung filter lokasi atau nama kebun jika diperlukan

Popup marker kebun berisi:

- Nama kebun
- Lokasi kebun
- Jenis tanaman
- Status gateway
- Rata-rata kelembapan tanah
- Status valve
- Status irigasi
- Prediksi hujan singkat
- Tombol `Lihat Detail`

Data kebun untuk map minimal perlu memiliki:

```text
farm.id
farm.name
farm.location
farm.crop_type
farm.latitude
farm.longitude
farm.gateway_status
farm.average_soil_moisture
farm.valve_status
farm.irrigation_status
farm.weather_summary
farm.last_update
```

## Detail Kebun

Detail Kebun muncul setelah user memilih kebun dari map atau card. Semua data di halaman ini harus dibatasi hanya untuk kebun yang sedang dipilih.

Isi Detail Kebun:

- Informasi kebun
- Status utama kebun
- Status gateway
- Daftar node sensor
- Monitoring sensor
- Grafik historis
- Status irigasi
- Cuaca BMKG
- Riwayat sistem

Informasi kebun:

- Nama kebun
- Pemilik kebun
- Lokasi
- Jenis tanaman
- Luas lahan
- Kode wilayah BMKG
- Jumlah node
- Status kebun
- Last update

## Monitoring dan Irigasi

Monitoring sensor menampilkan data per node:

- Kelembapan tanah
- Suhu tanah
- Suhu udara
- Kelembapan udara
- Baterai node
- RSSI LoRa
- Status valve per node
- Last update

Grafik monitoring perlu mendukung filter:

- 1 jam terakhir
- Hari ini
- 7 hari terakhir
- 30 hari terakhir
- Filter node

Logika irigasi:

- Valve dibuka jika kelembapan tanah di bawah threshold dan tidak ada prediksi hujan
- Valve ditutup jika kelembapan tanah sudah cukup
- Irigasi ditunda jika BMKG memprediksi hujan
- Sistem menunggu data sensor terbaru jika gateway offline

## Akses User

Setiap user hanya boleh melihat kebun yang terhubung dengan akun miliknya. Jangan membuat fitur yang menampilkan semua kebun lintas user kecuali sedang membuat mode admin pusat.

Model akses:

```text
User -> Farm -> Gateway -> Node -> Sensor Data -> Irrigation Log -> Dashboard
```

Contoh:

```text
Akun Pak Budi
-> Kebun Salak Bantul
-> Kebun Cabai Sleman
-> Kebun Padi Kulon Progo

Akun Bu Sari
-> Kebun Melon Bantul
-> Kebun Padi Sleman
```

Pak Budi hanya melihat kebun Pak Budi. Bu Sari hanya melihat kebun Bu Sari.

## Alur Data Sistem

```text
Node sensor membaca data
-> Node mengirim data ke gateway melalui LoRa
-> Gateway mengirim data ke server melalui internet
-> Backend menerima dan menyimpan data
-> Backend mengecek threshold kelembapan tanah
-> Backend mengecek prakiraan cuaca BMKG
-> Backend menentukan keputusan irigasi
-> Dashboard menampilkan status terbaru ke user
```

## Aturan UI

- Gunakan dark theme proyek: background `#0d1117`, accent `#00e676`
- Gunakan badge status dengan warna konsisten: green/yellow/red
- Jangan menampilkan raw code jika label manusiawi sudah tersedia
- Progress bar selalu sertakan label range `0%` dan `100%`
- Hindari inline style; gunakan CSS class
- Jangan membuat landing page marketing; dashboard adalah pengalaman utama
- Untuk dashboard operasional, prioritaskan layout padat, rapi, mudah discan, dan tidak dekoratif berlebihan
- Card kebun harus menjadi jalur alternatif selain map untuk masuk ke Detail Kebun

## Catatan Implementasi

- Jika mengubah halaman statis lama, cek file di `frontend/public/static/`
- Jika mengubah React app, gunakan struktur `frontend/src/`
- Jika menambah API, cek `backend/app/main.py`, `backend/app/schemas.py`, dan `backend/app/database.py`
- Pertahankan naming convention yang sudah ada
- Jangan melakukan refactor besar tanpa alasan langsung dari kebutuhan user
