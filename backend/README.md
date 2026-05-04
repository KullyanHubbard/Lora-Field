# LoraField Backend

Backend basic untuk dashboard LoraField. API ini memakai FastAPI dan SQLite
sebagai fondasi awal sebelum integrasi MQTT, BMKG live API, dan hardware LoRa.

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
| GET | `/api/summary` | Ringkasan node, sensor terbaru, cuaca, dan keputusan |
| GET | `/api/nodes` | Daftar node |
| PATCH | `/api/nodes/{node_id}/location` | Simpan lokasi dan koordinat node |
| GET | `/api/nodes/{node_id}/readings` | Riwayat pembacaan sensor |
| POST | `/api/nodes/{node_id}/readings` | Simpan pembacaan sensor baru |
| GET | `/api/weather` | Data cuaca aktif |
| PUT | `/api/weather` | Update data cuaca dummy |
| GET | `/api/decision` | Simulasi keputusan irigasi |
| GET | `/api/logs` | Log keputusan |

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
