# LoraField Backend

Backend basic untuk dashboard LoraField. API ini memakai FastAPI dan SQLite
sebagai fondasi awal sebelum integrasi MQTT dan hardware LoRa.

Data cuaca diambil dari API publik BMKG:
`https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4={kode_wilayah}`.

## Menjalankan

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API tersedia di `http://127.0.0.1:8000`.

Dokumentasi otomatis FastAPI tersedia di `http://127.0.0.1:8000/docs`.

## Endpoint Awal

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| GET | `/health` | Cek status backend |
| GET | `/api/summary?adm4={kode_wilayah}` | Ringkasan node, sensor terbaru, cuaca BMKG, dan keputusan |
| GET | `/api/nodes` | Daftar node |
| PATCH | `/api/nodes/{node_id}/location` | Simpan lokasi dan koordinat node |
| GET | `/api/nodes/{node_id}/readings` | Riwayat pembacaan sensor |
| POST | `/api/nodes/{node_id}/readings` | Simpan pembacaan sensor baru |
| GET | `/api/weather?adm4={kode_wilayah}` | Data cuaca aktif dari BMKG |
| GET | `/api/decision` | Simulasi keputusan irigasi |
| GET | `/api/logs` | Log keputusan |

## Contoh Ambil Cuaca BMKG

```bash
curl "http://127.0.0.1:8000/api/weather?adm4=31.71.01.1001"
```

## Contoh Payload Sensor

```json
{
  "soil_moisture": 38,
  "soil_temp": 27.5,
  "air_temp": 30.2,
  "air_humidity": 78
}
```

Database SQLite akan dibuat otomatis di `backend/data/lorafield.db` saat API
pertama kali berjalan.
