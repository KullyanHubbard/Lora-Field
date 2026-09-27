"""Model fisik sederhana satu node sensor: kelembapan tanah, suhu tanah, dan baterai.

Semua laju dan batas diambil dari config. State disimpan antar-run supaya nilai
berlanjut mulus saat simulator dijalankan ulang.
"""

from __future__ import annotations

import math
import random
from dataclasses import asdict, dataclass
from datetime import datetime

from environment import Ambient


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
    powered: bool = True
    outage_until: float | None = None
    last_step_at: float | None = None
    # Kuat sinyal rata-rata node ini di gateway (jarak dan halangan tetap). None untuk
    # state lama sebelum RSSI disimulasikan, diisi saat reading pertama.
    rssi_base_dbm: float | None = None

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


def _solar_factor(now: datetime, ambient: Ambient, battery: dict) -> float:
    start, end = battery["daylight_start_hour"], battery["daylight_end_hour"]
    hour = now.hour + now.minute / 60
    if not start <= hour <= end:
        return 0.0
    factor = math.sin(math.pi * (hour - start) / (end - start))
    return factor * (battery["cloudy_charge_factor"] if ambient.cloudy else 1.0)


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

    # Penguapan naik saat panas dan turun saat udara lembap.
    evaporation = soil["drying_pct_per_hour"] * _clamp((air_temp - 10) / 15, 0.2, 2.0)
    evaporation *= _clamp(1.3 - humidity / 100, 0.3, 1.2)
    gain = soil["irrigation_gain_pct_per_hour"] if state.valve_open else 0.0
    gain += soil["rain_gain_pct_per_hour"] if ambient.raining else 0.0
    state.moisture = _clamp(
        state.moisture + (gain - evaporation) * hours,
        soil["min_moisture_pct"],
        soil["max_moisture_pct"],
    )

    # Suhu tanah mengikuti suhu udara dengan jeda, lebih dingin beberapa derajat.
    target_soil_temp = air_temp - soil["temp_offset_c"]
    if state.soil_temp is None:
        state.soil_temp = target_soil_temp
    else:
        lag = min(hours / soil["temp_lag_hours"], 1.0)
        state.soil_temp += (target_soil_temp - state.soil_temp) * lag

    battery = config["battery"]
    charge = battery["solar_charge_pct_per_hour"] * _solar_factor(now, ambient, battery) * hours
    state.battery = _clamp(state.battery + charge, 0, 100)
    if state.powered and state.battery <= battery["shutdown_pct"]:
        state.powered = False
    elif not state.powered and state.battery >= battery["wake_pct"]:
        state.powered = True


def build_reading(state: NodeState, ambient: Ambient, config: dict, rng: random.Random) -> dict:
    """Nilai yang dilaporkan sensor: state fisik ditambah derau pengukuran.

    rssi bukan dari sensor node: gateway mengukurnya saat paket diterima, lalu
    menyertakannya ketika meneruskan reading ke backend.
    """
    soil, air, radio = config["soil"], config["air"], config["radio"]
    if state.rssi_base_dbm is None:
        state.rssi_base_dbm = _random_rssi_base(config, rng)
    return {
        "soil_moisture": round(_clamp(state.moisture + rng.gauss(0, soil["sensor_noise_pct"]), 0, 100), 1),
        "soil_temp": round(state.soil_temp + rng.gauss(0, soil["sensor_noise_temp_c"]), 1),
        "air_temp": round(
            ambient.air_temp + state.air_offset_temp + rng.gauss(0, air["sensor_noise_temp_c"]), 1
        ),
        "air_humidity": round(
            _clamp(
                ambient.humidity
                + state.air_offset_humidity
                + rng.gauss(0, air["sensor_noise_humidity_pct"]),
                0,
                100,
            ),
            1,
        ),
        "battery": round(state.battery, 1),
        "rssi": round(
            _clamp(
                state.rssi_base_dbm + rng.gauss(0, radio["rssi_noise_db"]),
                radio["rssi_min_dbm"],
                radio["rssi_max_dbm"],
            )
        ),
    }


def spend_transmission(state: NodeState, config: dict) -> None:
    state.battery = _clamp(state.battery - config["battery"]["drain_pct_per_reading"], 0, 100)
