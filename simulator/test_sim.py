"""Cek cepat logika simulator tanpa broker: python simulator/test_sim.py"""

import io
import json
import random
from contextlib import redirect_stdout
from datetime import datetime, timedelta
from pathlib import Path

from environment import Ambient, ambient_at
from lorafield_sim import Site, new_entry
from node_model import advance, build_reading, new_node_state

config = json.loads((Path(__file__).with_name("config.example.json")).read_text(encoding="utf-8"))
config["downlink_loss_rate"] = 0
config["packet_loss_rate"] = 0
config["outage"]["chance_per_reading"] = 0
farm = config["farms"][0]
site = Site(farm, new_entry(farm, config, random.Random(1)), config, random.Random(1))
site.ambient = Ambient(air_temp=30, humidity=70, raining=False, source="test")
node = site.nodes[0]
now = 1_000_000.0

site.link.pending[node.node_id] = {"state": "open", "until": now + 600}
site.service(now)
assert node.valve_open and node.valve_until == now + 600, "perintah buka diteruskan ke node"

site.link.pending[node.node_id] = {"state": "open", "until": now + 600}
site.service(now + 300)
assert node.valve_until == now + 600, "perintah yang diterima ulang tidak memperpanjang waktu siram"

site.service(now + 601)
assert not node.valve_open, "node menutup valve sendiri saat batas waktu habis"

site.link.pending[node.node_id] = {"state": "open", "until": now + 500}
site.service(now + 700)
assert not node.valve_open, "perintah buka yang sudah kedaluwarsa diperlakukan sebagai tutup"

node.powered = False
site.link.pending[node.node_id] = {"state": "open", "until": now + 2000}
site.service(now + 800)
assert not node.valve_open and node.node_id in site.link.pending, "node mati: perintah ditahan gateway"
node.powered = True
site.service(now + 801)
assert node.valve_open, "node hidup lagi: perintah yang ditahan sampai"

# Node mati kehabisan baterai saat menyiram, lalu hidup lagi: setelah node kirim data, gateway
# mengulang perintah buka yang masih berlaku (seperti firmware gateway).
node.battery = 1.0
advance(node, site.ambient, datetime.fromtimestamp(now + 900), config)
assert not node.powered and not node.valve_open, "baterai habis: node mati, valve menutup"
node.battery = 50.0
advance(node, site.ambient, datetime.fromtimestamp(now + 1000), config)
site._transmit(node, now + 1000)
assert node.valve_open, "node hidup lagi: gateway mengulang perintah buka yang masih berlaku"

# Perintah buka datang tepat saat baterai node habis: node mati, valve tidak ikut terbuka.
dying = site.nodes[1]
dying.battery = 2.0
site.link.pending[dying.node_id] = {"state": "open", "until": now + 4000}
site.service(now + 1100)
assert not dying.powered and not dying.valve_open, "node yang mati tidak membuka valve"

# Prakiraan BMKG yang sudah habis diganti kurva harian, bukan ditahan di angka slot terakhir.
old = {"forecast": [
    {"local_datetime": "2026-01-01 12:00:00", "t": 25, "hu": 85, "weather_desc": "Cerah"},
    {"local_datetime": "2026-01-01 15:00:00", "t": 25, "hu": 85, "weather_desc": "Cerah"},
]}
night, noon = (ambient_at(datetime(2026, 1, 5, hour), old, config) for hour in (3, 14))
assert night.source == noon.source == "fallback" and noon.air_temp > night.air_temp, "prakiraan habis: kurva harian"
assert ambient_at(datetime(2026, 1, 1, 13, 30), old, config).source == "BMKG", "prakiraan masih berlaku: BMKG"

# Model tanah. Malam hari dipakai untuk cek air supaya penguapan hampir nol.
clear_sky = Ambient(air_temp=30, humidity=60, raining=False, source="test", cloud_cover=0.2)
night = datetime(2026, 9, 29, 22, 0)


def soil(moisture: float) -> object:
    state = new_node_state("T", "Tes", config, random.Random(2))
    state.moisture = moisture
    return state


pulse = soil(60.0)
advance(pulse, clear_sky, night, config)
pulse.valve_open = True
advance(pulse, clear_sky, night + timedelta(minutes=10), config)
at_close = pulse.moisture
pulse.valve_open = False
advance(pulse, clear_sky, night + timedelta(minutes=70), config)
assert at_close < 63 < pulse.moisture, "air pulsa baru terbaca sensor setelah merembes"


def dried_in_one_hour(hour: int) -> float:
    state = soil(70.0)
    start = datetime(2026, 9, 29, hour, 0)
    advance(state, clear_sky, start, config)
    advance(state, clear_sky, start + timedelta(hours=1), config)
    return 70.0 - state.moisture


assert dried_in_one_hour(12) > 10 * dried_in_one_hour(2), "siang mengering jauh lebih cepat dari malam"


def after_rain(mm_per_hour: float, exposure: float) -> float:
    state = soil(50.0)
    rain = Ambient(air_temp=24, humidity=95, raining=True, source="test", cloud_cover=1.0,
                   rain_mm_per_hour=mm_per_hour * exposure)
    advance(state, rain, night, config)
    advance(state, rain, night + timedelta(hours=3), config)
    return state.moisture


assert after_rain(10, 0.0) < 50.1, "kebun beratap tidak kena hujan"
assert after_rain(0.7, 1.0) + 5 < after_rain(10, 1.0), "hujan deras membasahi jauh lebih banyak dari hujan ringan"

soaked = soil(95.0)
for hour in range(9):  # satu langkah dibatasi max_step_hours, jadi maju per jam
    advance(soaked, clear_sky, night + timedelta(hours=hour), config)
assert soaked.moisture < 90, "air di atas kapasitas lapang turun ke lapisan bawah"

# Jadwal kirim: tiap node punya waktunya sendiri, dan setelah laptop sleep tidak mengejar kiriman.
scheduled = Site(farm, new_entry(farm, config, random.Random(5)), config, random.Random(5))
scheduled.weather_at = float("inf")  # tanpa BMKG, pakai kurva cadangan
log = []
scheduled._transmit = lambda state, when: log.append((when, state.node_id)) or "terkirim"
base = 2_000_000_000.0
with redirect_stdout(io.StringIO()):
    for second in range(200):
        scheduled.step(base + second)
first_send = {}
for when, node_id in log:
    first_send.setdefault(node_id, when)
assert len(set(first_send.values())) == len(scheduled.nodes), "node tidak mengirim serempak"
for node_id in first_send:
    times = [when for when, sender in log if sender == node_id]
    assert all(b - a >= config["interval_seconds"] for a, b in zip(times, times[1:])), "jarak kirim minimal satu interval"
log.clear()
with redirect_stdout(io.StringIO()):
    for second in range(60):
        scheduled.step(base + 200 + 3600 + second)
assert len(log) <= len(scheduled.nodes), "setelah sleep, tiap node kirim sekali dulu, tidak beruntun"

# Baterai sesuai firmware: turun semalaman karena ESP32 dan radio selalu menyala, terisi di siang cerah.
def battery_after(start_pct: float, start: datetime, hours: int, cloud_cover: float) -> float:
    state = soil(60.0)
    state.battery = start_pct
    sky = Ambient(air_temp=28, humidity=70, raining=False, source="test", cloud_cover=cloud_cover)
    for hour in range(hours + 1):
        advance(state, sky, start + timedelta(hours=hour), config)
    return state.battery


dusk = datetime(2026, 9, 29, 18, 0)
assert 50 < battery_after(80, dusk, 12, 0.2) < 60, "semalam turun sekitar 24%"
dawn = datetime(2026, 9, 30, 6, 0)
assert battery_after(50, dawn, 12, 0.2) > 95, "siang cerah mengisi penuh"
assert battery_after(50, dawn, 12, 1.0) < 55, "siang mendung hampir tidak mengisi"

# Node mati lalu menyala ulang: bacaan DHT22 terakhir di RAM firmware ikut hilang.
reboot = soil(60.0)
reboot.last_air_temp, reboot.last_air_humidity, reboot.battery = 29.0, 70.0, 1.0
advance(reboot, clear_sky, night, config)
reboot.battery = 50.0
advance(reboot, clear_sky, night + timedelta(minutes=1), config)
assert reboot.powered and reboot.last_air_temp is None, "menyala ulang: RAM firmware kosong"

# Sensor rusak.
broken = soil(60.0)
advance(broken, clear_sky, night, config)
assert build_reading(broken, clear_sky, config, random.Random(1), "dht22-dead") is None, "DHT22 mati sejak menyala: tidak kirim"
assert build_reading(broken, clear_sky, config, random.Random(1), "soil-dry")["soil_moisture"] <= 2, "sensor tanah lepas terbaca kering"
broken.last_air_temp, broken.last_air_humidity = 29.0, 70.0
stuck = build_reading(broken, clear_sky, config, random.Random(1), "dht22-dead")
assert (stuck["air_temp"], stuck["air_humidity"]) == (29.0, 70.0), "DHT22 mati: angka udara macet di bacaan terakhir"

print("Semua cek simulator lolos.")
