# Simulator Perangkat IoT

Berperan sebagai gateway dan node sensor LoraField selama perangkat asli belum ada. Simulator
bicara ke server hanya lewat MQTT dengan format yang sama dengan firmware
([docs/kontrak-mqtt.md](../docs/kontrak-mqtt.md)): tanpa akun LoraField dan tanpa HTTP. Kode web
tidak berisi data dummy apa pun.

Penanda simulasi: ID gateway dan node diawali `SIM-` (terlihat di kartu Gateway).

## Cara kerja

Bagian alat (mengikuti kontrak MQTT):

- Gateway menyambung ke broker dengan ID sendiri dan Last Will, lalu mengirim status online,
  daftar node, dan heartbeat (langsung saat tersambung, lalu berkala).
- Tombol "Ganti WiFi" di web (topik `cmd`): seperti firmware, gateway mengirim status offline
  sendiri dan membuka portal selama `gateway_portal_minutes` (bawaan 5 menit). Simulator tidak
  punya WiFi baru, jadi setelah itu gateway kembali ke WiFi lama dan web mencatat "Menyala ulang"
  (tanpa penyebab, karena heartbeat simulator tidak membawa `boot_reason`).
- Node mengirim data sensor lewat LoRa; gateway menambahkan kuat sinyal (RSSI) lalu
  meneruskannya ke MQTT bersama posisi valve yang sebenarnya.
- Perintah valve dari server diteruskan gateway ke node. Node menutup valve sendiri saat batas
  waktu buka habis, walau perintah tutup tidak sampai. Node yang mati atau gangguan menerima
  perintahnya setelah terjangkau lagi.
- Kalau DHT22 gagal dibaca, node mengirim bacaan valid terakhir.
- Tiap node mengirim di waktunya sendiri (interval ditambah jeda acak), seperti firmware, jadi
  node tidak pernah serempak. Setelah simulator berhenti atau laptop sleep, node tidak mengejar
  kiriman yang terlewat.
- Sesekali paket naik atau turun hilang, atau node gangguan beberapa menit, seperti sinyal LoRa
  asli. Saat broker putus, data dibuang (tidak ditumpuk), sesuai kontrak.
- Sesekali WiFi gateway putus beberapa menit tanpa pamit, jadi broker mengirim Last Will dan web
  mencatat gateway terputus, lalu gateway menyambung lagi sendiri.
- Sensor bisa rusak (jarang, pulih sendiri setelah beberapa jam): sensor tanah lepas sehingga
  terbaca hampir 0%, atau DHT22 mati sehingga angka udara macet di bacaan terakhir. Node yang
  menyala ulang kehilangan bacaan DHT22 terakhir, jadi tidak mengirim sampai DHT22 terbaca lagi.

Bagian dunia (bukan alat, hanya supaya angkanya wajar):

- Suhu, kelembapan udara, tutupan awan, dan curah hujan (mm) mengikuti prakiraan BMKG untuk
  `bmkg_adm4_code` di config, diambil langsung dari BMKG. Kalau BMKG tidak tersedia atau
  prakiraannya sudah habis, dipakai kurva harian dari `fallback_climate`.
- Air dari valve dan hujan menggenang dulu lalu merembes ke sensor (sekitar 20 menit), jadi angka
  kelembapan tanah masih naik beberapa saat setelah valve ditutup. Air di atas kapasitas lapang
  (85%) turun ke lapisan bawah dalam beberapa jam.
- Penguapan mengikuti matahari: besar di siang hari, hampir nol di malam hari, dan lebih kecil saat
  mendung, udara lembap, atau tanah sudah kering.
- Hujan membasahi tanah sesuai penutup tanah kebun (`ground_cover` di config): tanah terbuka
  penuh, mulsa plastik sebagian kecil, beratap tidak sama sekali.
- Suhu tanah mengikuti suhu udara dengan jeda.
- Baterai dihitung dari arus sesuai firmware: ESP32 dan radio LoRa selalu menyala (sekitar 60 mA),
  relay menyala selama valve terbuka, dan panel surya mengisi sesuai matahari dan tutupan awan.
  Jadi baterai turun semalaman lalu terisi di siang cerah, dan pelan-pelan habis kalau mendung
  berhari-hari. Node mati sendiri kalau baterai habis, dan valve-nya ikut menutup.

Semua laju, batas, dan jarak kirim diatur di config. Tidak ada nilai sensor yang ditulis di kode.

## Menjalankan

Butuh broker Mosquitto yang jalan dan backend dengan `MQTT_HOST` terisi di `backend/.env`.
Library Python: `pip install paho-mqtt`.

Kalau broker memakai password, isi `mqtt.password` di `config.json`. Sama seperti gateway asli,
username = ID gateway simulasi, jadi tiap ID `SIM-GW-...` perlu didaftarkan di file password broker.

```bat
python simulator/lorafield_sim.py run
```

Saat pertama jalan, simulator membuat ID gateway (disimpan di `.state.json`) dan mencetaknya.
Daftarkan kebun di web (Registrasi Kebun) memakai ID gateway itu, dengan lokasi (`location`) dan
penutup tanah (`ground_cover`) yang sama dengan config, supaya cuaca dan hujan di web dan simulasi
cocok. Sebelum terdaftar, data dari gateway
diabaikan server, sama seperti alat asli. Hentikan dengan Ctrl+C. Opsi `--once` mengirim satu
putaran saja.

Untuk mengubah pengaturan, salin `config.example.json` menjadi `config.json` lalu edit.

Untuk menguji pengaman server saat sensor rusak, paksa node pertama tiap kebun rusak selama
simulator berjalan (tidak disimpan, hilang saat simulator dihentikan):

```bat
python simulator/lorafield_sim.py run --fault soil-dry
python simulator/lorafield_sim.py run --fault dht22-dead
```

Grafik 6 dan 12 jam terisi seiring simulator berjalan, karena server mencatat waktu data saat
data diterima (data lama tidak bisa dikirim mundur).

Cek cepat logika simulator tanpa broker: `python simulator/test_sim.py`.

## Mulai dari awal

```bat
python simulator/lorafield_sim.py reset
```

Melupakan ID perangkat dan menghapus pesan retain-nya di broker. Kebunnya hapus sendiri di web
(Kebun Saya). Putaran `run` berikutnya membuat ID gateway baru.
