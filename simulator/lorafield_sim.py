"""Simulator perangkat IoT LoraField: berperan sebagai gateway dan node sensor.

Data dikirim lewat endpoint yang sama dengan firmware (registrasi node gateway, POST
readings, log gateway), jadi web membaca data yang benar-benar masuk ke backend.
Semua ID perangkat diawali "SIM-" sebagai penanda data simulasi.

Pemakaian (dari root project, backend harus sudah jalan):
    set LORAFIELD_SIM_EMAIL=... & set LORAFIELD_SIM_PASSWORD=...
    python simulator/lorafield_sim.py setup     # buat kebun demo dan daftarkan node
    python simulator/lorafield_sim.py run       # kirim data terus, Ctrl+C untuk berhenti
    python simulator/lorafield_sim.py cleanup   # hapus kebun demo beserta datanya
"""

from __future__ import annotations

import argparse
import json
import os
import random
import secrets
import sys
import time
from datetime import datetime
from pathlib import Path

import httpx

from api_client import ApiError, LoraFieldClient
from environment import Ambient, ambient_at
from node_model import NodeState, advance, build_reading, new_node_state, spend_transmission

SIM_DIR = Path(__file__).resolve().parent
STATE_PATH = SIM_DIR / ".state.json"
DEVICE_PREFIX = "SIM-"


def load_config(path_arg: str | None) -> dict:
    if path_arg:
        path = Path(path_arg)
    elif (SIM_DIR / "config.json").exists():
        path = SIM_DIR / "config.json"
    else:
        path = SIM_DIR / "config.example.json"
    print(f"Config: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def load_state() -> dict:
    if not STATE_PATH.exists():
        return {"farms": {}}
    return json.loads(STATE_PATH.read_text(encoding="utf-8"))


def save_state(state: dict) -> None:
    tmp_path = STATE_PATH.with_suffix(".tmp")
    tmp_path.write_text(json.dumps(state, indent=2), encoding="utf-8")
    tmp_path.replace(STATE_PATH)


def make_client(config: dict) -> LoraFieldClient:
    email = os.environ.get("LORAFIELD_SIM_EMAIL")
    password = os.environ.get("LORAFIELD_SIM_PASSWORD")
    if not email or not password:
        sys.exit("Isi LORAFIELD_SIM_EMAIL dan LORAFIELD_SIM_PASSWORD (akun LoraField Anda).")
    base_url = os.environ.get("LORAFIELD_API_URL", config["api_base_url"])
    return LoraFieldClient(base_url, email, password, config["http_timeout_seconds"])


def setup_farm(client: LoraFieldClient, farm_config: dict, config: dict, rng: random.Random) -> dict:
    device_suffix = secrets.token_hex(3)
    gateway_device_id = f"{DEVICE_PREFIX}GW-{device_suffix}"
    created = client.create_farm(
        {
            "name": farm_config["name"],
            "owner": farm_config.get("owner", ""),
            "location": farm_config["location"],
            "crop_type": farm_config["crop_type"],
            "area_ha": farm_config.get("area_ha"),
            "bmkg_adm4_code": farm_config.get("bmkg_adm4_code", ""),
            "latitude": farm_config["latitude"],
            "longitude": farm_config["longitude"],
            "gateway_device_id": gateway_device_id,
            "gateway_display_name": f"Gateway {farm_config['name']}",
        }
    )
    farm = created["farm"]
    if not farm.get("bmkg_adm4_code"):
        client.delete_farm(farm["id"])
        raise ApiError(
            f"Kode BMKG untuk '{farm_config['name']}' tidak ketemu. Isi bmkg_adm4_code di config."
        )

    nodes = [
        new_node_state(f"{DEVICE_PREFIX}{device_suffix}-N{index}", name, config, rng)
        for index, name in enumerate(farm_config["nodes"], start=1)
    ]
    client.register_nodes(
        gateway_device_id, farm["id"], [{"node_id": n.node_id, "name": n.name} for n in nodes]
    )
    print(f"Kebun '{farm['name']}' dibuat ({farm['id']}), gateway {gateway_device_id}, {len(nodes)} node.")
    return {
        "farm_id": farm["id"],
        "name": farm["name"],
        "adm4": farm["bmkg_adm4_code"],
        "gateway_device_id": gateway_device_id,
        "last_heartbeat_at": None,
        "nodes": [node.to_dict() for node in nodes],
    }


def ensure_setup(client: LoraFieldClient, config: dict, state: dict, rng: random.Random) -> None:
    for farm_config in config["farms"]:
        entry = state["farms"].get(farm_config["key"])
        if entry and client.get_farm(entry["farm_id"]) is not None:
            continue
        state["farms"][farm_config["key"]] = setup_farm(client, farm_config, config, rng)
        save_state(state)


def transmit(
    client: LoraFieldClient,
    entry: dict,
    node: NodeState,
    ambient: Ambient,
    now: datetime,
    config: dict,
    rng: random.Random,
) -> str:
    """Satu kali kirim data node. Kembalikan status singkat untuk log terminal."""
    if not node.powered:
        return "baterai habis"
    if node.outage_until and now.timestamp() < node.outage_until:
        return "gangguan"
    node.outage_until = None
    outage = config["outage"]
    if rng.random() < outage["chance_per_reading"]:
        minutes = rng.uniform(outage["minutes_min"], outage["minutes_max"])
        node.outage_until = now.timestamp() + minutes * 60
        return "gangguan"

    spend_transmission(node, config)
    if rng.random() < config["packet_loss_rate"]:
        return "paket hilang"
    try:
        result = client.post_reading(node.node_id, entry["adm4"], build_reading(node, ambient, config, rng))
    except (ApiError, httpx.HTTPError) as exc:
        return f"gagal: {exc}"
    # Valve fisik mengikuti keputusan backend, termasuk perintah mode manual.
    node.valve_open = result["decision"]["valve_state"] == "open"
    return "terkirim"


def heartbeat_due(entry: dict, now: datetime, config: dict) -> bool:
    last = entry.get("last_heartbeat_at")
    return last is None or now.timestamp() - last >= config["gateway_heartbeat_minutes"] * 60


def run_tick(client: LoraFieldClient, config: dict, state: dict, rng: random.Random) -> None:
    now = datetime.now()
    for entry in state["farms"].values():
        try:
            weather = client.get_farm_weather(entry["farm_id"])
        except (ApiError, httpx.HTTPError):
            weather = None
        ambient = ambient_at(now, weather, config)
        nodes = [NodeState.from_dict(data) for data in entry["nodes"]]
        heard = []
        print(
            f"\n[{now:%H:%M:%S}] {entry['name']}  udara {ambient.air_temp:.1f} C "
            f"{ambient.humidity:.0f}% ({ambient.source}{', hujan' if ambient.raining else ''})"
        )
        for node in nodes:
            advance(node, ambient, now, config)
            status = transmit(client, entry, node, ambient, now, config, rng)
            if status == "terkirim":
                heard.append(node)
            print(
                f"  {node.name:14} tanah {node.moisture:5.1f}%  valve {'buka ' if node.valve_open else 'tutup'}"
                f"  baterai {node.battery:5.1f}%  {status}"
            )
        entry["nodes"] = [node.to_dict() for node in nodes]

        if heartbeat_due(entry, now, config):
            # Gateway hanya melaporkan node yang benar-benar terdengar di putaran ini.
            try:
                client.register_nodes(
                    entry["gateway_device_id"],
                    entry["farm_id"],
                    [{"node_id": n.node_id, "name": n.name} for n in heard],
                )
                client.post_gateway_log(entry["farm_id"], "heartbeat", f"{len(heard)}/{len(nodes)} node")
                entry["last_heartbeat_at"] = now.timestamp()
            except (ApiError, httpx.HTTPError) as exc:
                print(f"  heartbeat gateway gagal: {exc}")
    save_state(state)


def log_gateway_event(client: LoraFieldClient, state: dict, event: str) -> None:
    for entry in state["farms"].values():
        try:
            client.post_gateway_log(entry["farm_id"], event, f"{len(entry['nodes'])} node")
        except (ApiError, httpx.HTTPError) as exc:
            print(f"Log gateway '{event}' gagal untuk {entry['name']}: {exc}")


def command_run(client: LoraFieldClient, config: dict, state: dict, once: bool) -> None:
    rng = random.Random()
    ensure_setup(client, config, state, rng)
    log_gateway_event(client, state, "connected")
    interval = config["interval_seconds"]
    try:
        while True:
            started = time.monotonic()
            run_tick(client, config, state, rng)
            if once:
                break
            time.sleep(max(interval - (time.monotonic() - started), 0))
    except KeyboardInterrupt:
        print("\nSimulator dihentikan.")
    finally:
        log_gateway_event(client, state, "disconnected")
        save_state(state)


def command_cleanup(client: LoraFieldClient, state: dict) -> None:
    if not state["farms"]:
        print("Tidak ada kebun simulasi yang tercatat.")
        return
    for key, entry in list(state["farms"].items()):
        deleted = client.delete_farm(entry["farm_id"])
        print(f"Kebun '{entry['name']}' {'dihapus' if deleted else 'sudah tidak ada'}.")
        del state["farms"][key]
        save_state(state)


def main() -> None:
    parser = argparse.ArgumentParser(description="Simulator perangkat IoT LoraField.")
    parser.add_argument("command", choices=["setup", "run", "cleanup"])
    parser.add_argument("--config", help="Path config JSON (default config.json, lalu config.example.json)")
    parser.add_argument("--once", action="store_true", help="run: kirim satu putaran saja lalu berhenti")
    args = parser.parse_args()

    config = load_config(args.config)
    state = load_state()
    client = make_client(config)
    try:
        if args.command == "setup":
            ensure_setup(client, config, state, random.Random())
        elif args.command == "run":
            command_run(client, config, state, args.once)
        else:
            command_cleanup(client, state)
    except ApiError as exc:
        sys.exit(f"Error: {exc}")
    finally:
        client.close()


if __name__ == "__main__":
    main()
