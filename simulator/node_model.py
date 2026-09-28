"""Model fisik sederhana satu node sensor: kelembapan tanah, suhu tanah, dan baterai.

Air tanah: air dari valve dan hujan menggenang dulu lalu meresap ke zona sensor dengan jeda,
kelebihan di atas kapasitas lapang turun ke lapisan bawah, dan penguapan mengikuti matahari.

Semua laju dan batas diambil dari config. State disimpan antar-run supaya nilai
berlanjut mulus saat simulator dijalankan ulang.
"""

from __future__ import annotations

import math
import random
from dataclasses import asdict, dataclass
from datetime import datetime

from environment import Ambient

# Kerusakan sensor yang bisa terjadi (acak, atau dipaksa lewat --fault untuk uji pengaman server).
SENSOR_FAULTS = {
    "soil-dry": "sensor tanah lepas, terbaca kering",
    "dht22-dead": "DHT22 mati, angka udara macet",
}


@dataclass
class NodeState:
    node_id: str
    name: str
    moisture: float
    battery: float
    air_offset_temp: float
    air_offset_humidity: float
    soil_temp: float | None = None
    valve_open: bool = False
    # Jam tutup valve (epoch). Node menutup valve sendiri saat lewat, walau perintah tutup tidak sampai.
    valve_until: float | None = None
    powered: bool = True
    outage_until: float | None = None
    last_step_at: float | None = None
    # Kuat sinyal rata-rata node ini di gateway (jarak dan halangan tetap). None untuk
    # state lama sebelum RSSI disimulasikan, diisi saat reading pertama.
    rssi_base_dbm: float | None = None
    # Bacaan DHT22 valid terakhir, dikirim ulang kalau sensor gagal dibaca (aturan firmware).
    last_air_temp: float | None = None
    last_air_humidity: float | None = None
    # Air yang sudah diberikan tapi belum meresap sampai ke sensor (satuan % kelembapan).
    surface_water: float = 0.0
    # Jadwal kiriman berikutnya (epoch). Tiap node punya jadwal sendiri, seperti firmware.
    next_send_at: float | None = None
    # Kerusakan sensor acak yang sedang terjadi (kunci SENSOR_FAULTS) dan kapan pulih (epoch).
    fault: str | None = None
    fault_until: float | None = None

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "NodeState":
        return cls(**data)


def new_node_state(node_id: str, name: str, config: dict, rng: random.Random) -> NodeState:
    soil, air, battery = config["soil"], config["air"], config["battery"]
    return NodeState(
        node_id=node_id,
        name=name,
        moisture=rng.uniform(soil["initial_moisture_min_pct"], soil["initial_moisture_max_pct"]),
        battery=rng.uniform(battery["initial_min_pct"], battery["initial_max_pct"]),
        # Tiap titik di kebun punya iklim mikro sedikit berbeda (naungan, arah angin).
        air_offset_temp=rng.uniform(-air["node_offset_temp_max_c"], air["node_offset_temp_max_c"]),
        air_offset_humidity=rng.uniform(
            -air["node_offset_humidity_max_pct"], air["node_offset_humidity_max_pct"]
        ),
        rssi_base_dbm=_random_rssi_base(config, rng),
    )


def _random_rssi_base(config: dict, rng: random.Random) -> float:
    radio = config["radio"]
    return rng.uniform(radio["rssi_base_min_dbm"], radio["rssi_base_max_dbm"])


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _sunlight(now: datetime, daylight: dict) -> float:
    """0 di malam hari, naik ke 1 di tengah hari."""
    start, end = daylight["start_hour"], daylight["end_hour"]
    hour = now.hour + now.minute / 60
    if not start <= hour <= end:
        return 0.0
    return math.sin(math.pi * (hour - start) / (end - start))


def advance(state: NodeState, ambient: Ambient, now: datetime, config: dict) -> None:
    """Majukan state fisik dari langkah terakhir sampai `now`."""
    now_epoch = now.timestamp()
    if state.last_step_at is None:
        state.last_step_at = now_epoch
    # Dibatasi supaya jeda panjang (simulator dimatikan semalam) tidak membuat lompatan ekstrem.
    hours = min(max(now_epoch - state.last_step_at, 0) / 3600, config["max_step_hours"])
    state.last_step_at = now_epoch

    soil = config["soil"]
    air_temp = ambient.air_temp + state.air_offset_temp
    humidity = _clamp(ambient.humidity + state.air_offset_humidity, 0, 100)

    # Air dari valve dan hujan menggenang dulu, lalu meresap ke zona sensor dengan jeda: angka
    # sensor masih naik beberapa menit setelah valve ditutup, seperti tanah asli.
    inflow = soil["irrigation_gain_pct_per_hour"] if state.valve_open else 0.0
    inflow += ambient.rain_mm_per_hour * config["rain"]["pct_per_mm"]
    # Rumus eksak genangan dengan aliran masuk tetap, jadi hasilnya sama untuk langkah waktu berapa pun.
    tau = soil["infiltration_minutes"] / 60
    decay = math.exp(-hours / tau)
    surface = state.surface_water * decay + inflow * tau * (1 - decay)
    state.moisture += state.surface_water + inflow * hours - surface
    state.surface_water = surface

    # Di atas kapasitas lapang, kelebihan air turun ke lapisan bawah dalam beberapa jam.
    excess = state.moisture - soil["field_capacity_pct"]
    if excess > 0:
        state.moisture -= excess * (1 - math.exp(-hours / soil["drainage_hours"]))

    # Penguapan: besar di siang hari dan hampir nol di malam hari, berkurang saat berawan, udara
    # lembap, atau tanah yang sudah kering.
    night = soil["night_drying_factor"]
    light = night + (1 - night) * _sunlight(now, config["daylight"])
    clouds = 1 - soil["cloud_drying_reduction"] * ambient.cloud_cover
    heat = _clamp((air_temp - 10) / 15, 0.2, 2.0)
    air_dryness = _clamp(1.3 - humidity / 100, 0.3, 1.2)
    low, slows = soil["min_moisture_pct"], soil["drying_slows_below_pct"]
    soil_wetness = _clamp((state.moisture - low) / (slows - low), 0, 1)
    evaporation = soil["drying_peak_pct_per_hour"] * light * clouds * heat * air_dryness * soil_wetness
    # Lewat batas jenuh, air sisa mengalir di permukaan (hilang).
    state.moisture = _clamp(state.moisture - evaporation * hours, low, soil["max_moisture_pct"])

    # Suhu tanah mengikuti suhu udara dengan jeda, lebih dingin beberapa derajat.
    target_soil_temp = air_temp - soil["temp_offset_c"]
    if state.soil_temp is None:
        state.soil_temp = target_soil_temp
    else:
        lag = min(hours / soil["temp_lag_hours"], 1.0)
        state.soil_temp += (target_soil_temp - state.soil_temp) * lag

    # Baterai dihitung dari arus, sesuai firmware: ESP32 dan radio LoRa selalu menyala (tidak tidur),
    # relay menyala selama valve terbuka, panel surya mengisi sesuai matahari dan tutupan awan.
    battery = config["battery"]
    sun = _sunlight(now, config["daylight"]) * (1 - battery["cloud_charge_reduction"] * ambient.cloud_cover)
    current_ma = battery["solar_peak_ma"] * sun
    if state.powered:
        current_ma -= battery["idle_current_ma"] + (battery["valve_current_ma"] if state.valve_open else 0)
    state.battery = _clamp(state.battery + current_ma * hours / battery["capacity_mah"] * 100, 0, 100)
    if state.powered and state.battery <= battery["shutdown_pct"]:
        state.powered = False
        # Solenoid normally closed: valve menutup sendiri saat node kehabisan daya.
        state.valve_open, state.valve_until = False, None
    elif not state.powered and state.battery >= battery["wake_pct"]:
        state.powered = True
        # Node menyala ulang: isi RAM firmware (bacaan DHT22 terakhir) hilang.
        state.last_air_temp = state.last_air_humidity = None


def build_reading(
    state: NodeState, ambient: Ambient, config: dict, rng: random.Random, fault: str | None = None
) -> dict | None:
    """Isi pesan reading (docs/kontrak-mqtt.md): state fisik ditambah derau pengukuran.

    rssi bukan dari sensor node: gateway mengukurnya saat paket diterima, lalu
    menyertakannya ketika meneruskan reading ke server. None kalau DHT22 belum pernah terbaca
    sejak node menyala: firmware tidak mengirim apa pun, karena server menolak reading tanpa suhu.
    """
    soil, air, radio = config["soil"], config["air"], config["radio"]
    if state.rssi_base_dbm is None:
        state.rssi_base_dbm = _random_rssi_base(config, rng)
    air_temp, air_humidity = _read_dht22(state, ambient, config, rng, dead=fault == "dht22-dead")
    if air_temp is None:
        return None
    # Sensor tanah lepas dari tanah (di udara) terbaca hampir 0%.
    moisture = rng.uniform(0, 2) if fault == "soil-dry" else state.moisture + rng.gauss(0, soil["sensor_noise_pct"])
    return {
        "soil_moisture": round(_clamp(moisture, 0, 100), 1),
        "soil_temp": round(state.soil_temp + rng.gauss(0, soil["sensor_noise_temp_c"]), 1),
        "air_temp": air_temp,
        "air_humidity": air_humidity,
        "battery": round(state.battery, 1),
        "rssi": round(
            _clamp(
                state.rssi_base_dbm + rng.gauss(0, radio["rssi_noise_db"]),
                radio["rssi_min_dbm"],
                radio["rssi_max_dbm"],
            )
        ),
        "valve": "open" if state.valve_open else "closed",
    }


def _read_dht22(
    state: NodeState, ambient: Ambient, config: dict, rng: random.Random, dead: bool = False
) -> tuple[float | None, float | None]:
    """Suhu dan kelembapan udara dari DHT22. Gagal baca (sesekali, atau mati total) = bacaan valid terakhir."""
    air = config["air"]
    if dead or (state.last_air_temp is not None and rng.random() < air["dht22_fail_rate"]):
        return state.last_air_temp, state.last_air_humidity
    state.last_air_temp = round(
        ambient.air_temp + state.air_offset_temp + rng.gauss(0, air["sensor_noise_temp_c"]), 1
    )
    state.last_air_humidity = round(
        _clamp(
            ambient.humidity + state.air_offset_humidity + rng.gauss(0, air["sensor_noise_humidity_pct"]),
            0,
            100,
        ),
        1,
    )
    return state.last_air_temp, state.last_air_humidity

