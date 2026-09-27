# Simulator Perangkat IoT

Berperan sebagai gateway dan node sensor LoraField selama perangkat asli belum ada. Data
dikirim lewat endpoint yang sama dengan firmware, jadi web menampilkan data yang benar-benar
masuk ke backend. Kode web tidak berisi data dummy apa pun.

Penanda simulasi: ID gateway dan node diawali `SIM-` (terlihat di kartu Gateway).

## Cara kerja

- Suhu dan kelembapan udara mengikuti prakiraan BMKG kebun (diinterpolasi antar slot 3 jam),
  ditambah iklim mikro per node dan derau sensor. Kalau BMKG tidak tersedia, dipakai kurva
  harian dari `fallback_climate`.
- Kelembapan tanah turun karena penguapan (lebih cepat saat panas dan kering), naik saat
  valve terbuka atau hujan. Posisi valve mengikuti keputusan backend, termasuk mode Manual.
- Suhu tanah mengikuti suhu udara dengan jeda.
- Baterai berkurang tiap kiriman, terisi panel surya saat siang (lebih lambat saat berawan),
  dan node mati sendiri kalau baterai habis.
- Tiap node punya kuat sinyal (RSSI) tetap sesuai jaraknya ke gateway, dengan naik-turun kecil
  per paket. Nilainya dikirim bersama reading, seperti gateway asli yang mengukur RSSI saat
  menerima paket.
- Sesekali paket hilang atau node mengalami gangguan beberapa menit, seperti sinyal LoRa asli.
- Gateway melapor berkala (heartbeat) dan mencatat log koneksi.

Semua laju, batas, dan jarak kirim diatur di config. Tidak ada nilai sensor yang ditulis di kode.

## Menjalankan

Backend harus sudah jalan. Pakai akun LoraField Anda (kebun demo dibuat di akun itu).

```bat
set LORAFIELD_SIM_EMAIL=email@anda.com
set LORAFIELD_SIM_PASSWORD=password-anda
python simulator/lorafield_sim.py setup
python simulator/lorafield_sim.py run
```

`run` otomatis menjalankan `setup` kalau kebun demo belum ada. Hentikan dengan Ctrl+C.
Opsi `--once` mengirim satu putaran saja.

Untuk mengubah pengaturan, salin `config.example.json` menjadi `config.json` lalu edit.
Alamat backend bisa juga diganti lewat `LORAFIELD_API_URL`.

Grafik 6 dan 12 jam terisi seiring simulator berjalan, karena backend mencatat waktu data saat
data diterima (data lama tidak bisa dikirim mundur).

## Menghapus

```bat
python simulator/lorafield_sim.py cleanup
```

Menghapus kebun demo beserta node, data sensor, dan riwayatnya. Kebun Anda yang lain tidak
tersentuh.
