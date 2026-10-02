"""Simulator perangkat IoT LoraField: berperan sebagai gateway dan node sensor.

Bicara ke server hanya lewat MQTT sesuai docs/kontrak-mqtt.md, persis seperti firmware
gateway asli: tanpa akun LoraField, tanpa HTTP. Kebunnya didaftarkan pengguna di web memakai
ID gateway yang dicetak simulator. Semua ID perangkat diawali "SIM-" sebagai penanda simulasi.

Pemakaian (dari root project, broker MQTT dan backend harus sudah jalan):
    python simulator/lorafield_sim.py run      # nyalakan gateway dan node, Ctrl+C untuk berhenti
    python simulator/lorafield_sim.py reset    # lupakan ID perangkat dan hapus pesan retain-nya
"""

from __future__ import annotations

import argparse
import json
import random
import secrets
import time
from datetime import datetime
from pathlib import Path

from environment import Ambient, ambient_at, fetch_bmkg
from gateway_link import GatewayLink
from node_model import SENSOR_FAULTS, NodeState, advance, build_reading, new_node_state

SIM_DIR = Path(__file__).resolve().parent
STATE_PATH = SIM_DIR / ".state.json"
DEVICE_PREFIX = "SIM-"
# Label penutup tanah sama dengan pilihan di form Registrasi Kebun web.
GROUND_COVER_LABELS = {"open": "Tanah terbuka", "mulch": "Mulsa plastik", "roofed": "Beratap (rumah kaca)"}


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
        return {"gateways": {}}
    state = json.loads(STATE_PATH.read_text(encoding="utf-8"))
    if "farms" in state:
        # State versi HTTP: ID gateway dan node dipertahankan, jadi kebun demo lama yang sudah
        # memegang gateway itu langsung menerima data lewat MQTT.
        state = {
            "gateways": {
                key: {"gateway_id": entry["gateway_device_id"], "nodes": entry["nodes"]}
                for key, entry in state["farms"].items()
            }
        }
    return state


def save_state(state: dict) -> None:
    tmp_path = STATE_PATH.with_suffix(".tmp")
    tmp_path.write_text(json.dumps(state, indent=2), encoding="utf-8")
    tmp_path.replace(STATE_PATH)


class Site:
    """Satu kebun simulasi: satu gateway beserta node-nodenya, plus dunia fisiknya."""

    def __init__(
        self, farm_config: dict, entry: dict, config: dict, rng: random.Random, forced_fault: str | None = None
    ) -> None:
        self.name = farm_config["name"]
        self.adm4 = farm_config["bmkg_adm4_code"]
        # Bagian hujan yang sampai ke tanah: kebun beratap atau bermulsa tidak (banyak) kena hujan.
        self.rain_exposure = config["rain"]["exposure"][farm_config.get("ground_cover", "open")]
        self.config = config
        self.rng = rng
        self.gateway_id = entry["gateway_id"]
        self.nodes = [NodeState.from_dict(data) for data in entry["nodes"]]
        self.link = GatewayLink(
            self.gateway_id,
            [(node.node_id, node.name) for node in self.nodes],
            config["mqtt"],
            config["firmware_version"],
        )
        self.weather: dict | None = None
        self.weather_at = 0.0
        self.ambient: Ambient | None = None
        self.heard: set[str] = set()
        # Perintah terakhir yang sudah sampai ke tiap node, untuk dikirim ulang kalau node tidak menjalankannya.
        self.delivered: dict[str, dict] = {}
        self.last_heartbeat = 0.0
        self.started = time.monotonic()
        self.wifi_back_at = 0.0
        # Kerusakan sensor yang dipaksa lewat --fault untuk node pertama. Tidak disimpan ke state.
        self.forced_fault = forced_fault

    def to_entry(self) -> dict:
        return {"gateway_id": self.gateway_id, "nodes": [node.to_dict() for node in self.nodes]}

    def _reachable(self, node: NodeState, now: float) -> bool:
        return node.powered and not (node.outage_until and now < node.outage_until)

    def service(self, now: float) -> None:
        """Dipanggil tiap detik: teruskan perintah valve ke node dan jalankan pengaman waktu tutup."""
        for node in self.nodes:
            command = self.link.pending.pop(node.node_id, None)
            if command is not None:
                if self._reachable(node, now) and self.rng.random() >= self.config["downlink_loss_rate"]:
                    self.delivered[node.node_id] = command
                    self._apply_command(node, command, now)
                else:
                    # Node tidak terjangkau: gateway mencoba lagi nanti, kecuali sudah ada perintah lebih baru.
                    self.link.pending.setdefault(node.node_id, command)
            if node.valve_open and node.valve_until is not None and now >= node.valve_until:
                self._set_valve(node, False, None, now)
                print(f"  {node.name}: valve ditutup sendiri, batas waktu buka habis")

    def _apply_command(self, node: NodeState, command: dict, now: float, via: str = "perintah server") -> None:
        # Gateway mengubah jam tutup mutlak jadi sisa detik, karena node tidak punya jam.
        remaining = command.get("until", 0) - now if command["state"] == "open" else 0
        if (remaining > 0) != node.valve_open:
            self._set_valve(node, remaining > 0, now + remaining if remaining > 0 else None, now)
            if remaining > 0 and not node.valve_open:
                print(f"  {node.name}: valve tidak bisa dibuka, baterai node habis")
            else:
                print(f"  {node.name}: valve {'dibuka' if node.valve_open else 'ditutup'} ({via})")
        elif node.valve_open:
            node.valve_until = now + remaining

    def _resend_if_mismatch(self, node: NodeState, now: float) -> None:
        # Seperti firmware gateway: node baru saja kirim dan sedang mendengar, jadi perintah yang tidak
        # dijalankannya (mis. node sempat mati kehabisan baterai) diulang. Perintah yang lebih baru dan
        # masih tertunda dikirim service(), jangan didahului perintah lama.
        command = self.delivered.get(node.node_id)
        if command is None or node.node_id in self.link.pending:
            return
        should_open = command["state"] == "open" and command.get("until", 0) > now
        if should_open != node.valve_open and self.rng.random() >= self.config["downlink_loss_rate"]:
            self._apply_command(node, command, now, "perintah diulang gateway")

    def _set_valve(self, node: NodeState, open_valve: bool, until: float | None, now: float) -> None:
        # Fisika tanah dimajukan dulu dengan posisi valve lama sampai detik ini.
        if self.ambient is not None:
            advance(node, self.ambient, datetime.fromtimestamp(now), self.config)
        # Node yang kehabisan daya di langkah ini tidak bisa membuka valve.
        node.valve_open = open_valve and node.powered
        node.valve_until = until if node.valve_open else None

    def step(self, now: float, send_all: bool = False) -> bool:
        """Satu detik simulasi: cuaca, perintah valve, kiriman node yang jatuh tempo, dan heartbeat.

        Kembalikan True kalau ada node yang mengirim data (state perlu disimpan).
        """
        now_dt = datetime.fromtimestamp(now)
        if now - self.weather_at >= self.config["weather_refresh_minutes"] * 60:
            self.weather = fetch_bmkg(self.adm4, self.config["bmkg_timeout_seconds"]) or self.weather
            self.weather_at = now
        self.ambient = ambient_at(now_dt, self.weather, self.config, self.rain_exposure)
        self._gateway_wifi(now, now_dt)
        self.service(now)
        due = [node for node in self.nodes if send_all or self._send_due(node, now)]
        for node in due:
            self._send(node, now, now_dt)
        if self.heartbeat_due(now):
            self._heartbeat(now, now_dt)
        return bool(due)

    def heartbeat_due(self, now: float) -> bool:
        """Heartbeat begitu tersambung ke broker, lalu tiap gateway_heartbeat_minutes."""
        interval = self.config["gateway_heartbeat_minutes"] * 60
        return self.link.connected and (self.link.heartbeat_due or now - self.last_heartbeat >= interval)

    def _gateway_wifi(self, now: float, now_dt: datetime) -> None:
        """Sesekali WiFi gateway putus beberapa menit, seperti router mati atau sinyal hilang.

        Ganti WiFi dari web: seperti firmware, gateway restart lalu membuka portal; simulator tidak punya
        WiFi baru, jadi setelah portal habis gateway kembali ke WiFi lama.
        """
        if self.link.portal_requested:
            minutes = self.config.get("gateway_portal_minutes", 5)
            self.link.open_portal()
            self.wifi_back_at = now + minutes * 60
            self.started = time.monotonic()  # restart: uptime heartbeat mulai lagi dari 0
            print(f"[{now_dt:%H:%M:%S}] {self.name}: Ganti WiFi dari web, portal dibuka {minutes} menit")
            return
        outage = self.config["gateway_wifi_outage"]
        if self.link.wifi_down:
            if now >= self.wifi_back_at:
                self.link.restore_wifi()
                print(f"[{now_dt:%H:%M:%S}] {self.name}: WiFi gateway tersambung lagi")
        elif self.link.connected and self.rng.random() < outage["chance_per_day"] / 86400:
            minutes = self.rng.uniform(outage["minutes_min"], outage["minutes_max"])
            self.wifi_back_at = now + minutes * 60
            self.link.drop_wifi()
            print(f"[{now_dt:%H:%M:%S}] {self.name}: WiFi gateway putus, sekitar {minutes:.0f} menit")

    def _sensor_fault(self, node: NodeState, now: float) -> str | None:
        """Kerusakan sensor node saat ini: dipaksa (--fault), atau acak yang jarang dan pulih sendiri."""
        if self.forced_fault and node is self.nodes[0]:
            return self.forced_fault
        faults = self.config["sensor_faults"]
        if node.fault and now >= node.fault_until:
            print(f"  {node.name}: sensor pulih ({SENSOR_FAULTS[node.fault]})")
            node.fault = node.fault_until = None
        if node.fault is None and self.rng.random() < faults["chance_per_day"] * self.config["interval_seconds"] / 86400:
            hours = self.rng.uniform(faults["hours_min"], faults["hours_max"])
            node.fault, node.fault_until = self.rng.choice(sorted(SENSOR_FAULTS)), now + hours * 3600
            print(f"  {node.name}: sensor rusak ({SENSOR_FAULTS[node.fault]}), sekitar {hours:.0f} jam")
        return node.fault

    def _send_due(self, node: NodeState, now: float) -> bool:
        interval = self.config["interval_seconds"]
        # Pertama kali jalan, atau simulator sempat berhenti atau laptop sleep: mulai lagi di waktu
        # acak, supaya node tidak mengirim serempak dan tidak mengejar kiriman yang terlewat.
        if node.next_send_at is None or now - node.next_send_at > interval:
            node.next_send_at = now + self.rng.uniform(0, interval)
        return now >= node.next_send_at

    def _send(self, node: NodeState, now: float, now_dt: datetime) -> None:
        advance(node, self.ambient, now_dt, self.config)
        status = self._transmit(node, now)
        # Seperti firmware: jadwal berikutnya dihitung dari sekarang, ditambah jeda acak.
        jitter = self.rng.uniform(0, self.config["send_jitter_seconds"])
        node.next_send_at = now + self.config["interval_seconds"] + jitter
        print(
            f"[{now_dt:%H:%M:%S}] {node.name:14} tanah {node.moisture:5.1f}%  valve {'buka ' if node.valve_open else 'tutup'}"
            f"  baterai {node.battery:5.1f}%  {status}"
        )

    def _heartbeat(self, now: float, now_dt: datetime) -> None:
        weather = self.ambient
        print(
            f"\n[{now_dt:%H:%M:%S}] {self.name} ({self.gateway_id})  udara {weather.air_temp:.1f} C "
            f"{weather.humidity:.0f}%  awan {weather.cloud_cover * 100:.0f}%"
            f"{', hujan' if weather.raining else ''} ({weather.source})"
        )
        self.link.publish_heartbeat(int(time.monotonic() - self.started), len(self.heard))
        # Daftar node ikut tiap heartbeat, supaya nama node sampai walau kebun didaftarkan
        # di web setelah gateway menyala.
        self.link.publish_nodes()
        self.heard.clear()
        self.last_heartbeat = now
        self.link.heartbeat_due = False

    def _transmit(self, node: NodeState, now: float) -> str:
        """Satu kali node kirim data lewat LoRa, lalu gateway meneruskannya ke MQTT."""
        if not node.powered:
            return "baterai habis"
        if node.outage_until and now < node.outage_until:
            return "gangguan"
        node.outage_until = None
        outage = self.config["outage"]
        if self.rng.random() < outage["chance_per_reading"]:
            minutes = self.rng.uniform(outage["minutes_min"], outage["minutes_max"])
            node.outage_until = now + minutes * 60
            return "gangguan"

        fault = self._sensor_fault(node, now)
        # Firmware membaca sensor dulu. Tanpa bacaan DHT22 yang pernah valid, node tidak mengirim apa pun.
        reading = build_reading(node, self.ambient, self.config, self.rng, fault)
        if reading is None:
            return "tidak kirim, DHT22 belum pernah terbaca"
        if self.rng.random() < self.config["packet_loss_rate"]:
            return "paket hilang"
        self.heard.add(node.node_id)
        sent = self.link.publish_reading(node.node_id, reading)
        self._resend_if_mismatch(node, now)
        # Broker atau WiFi gateway putus: data dibuang, tidak ditumpuk (kontrak: jangan kirim data lama).
        status = "terkirim" if sent else "tidak terkirim, gateway offline"
        return f"{status} [{SENSOR_FAULTS[fault]}]" if fault else status


def new_entry(farm_config: dict, config: dict, rng: random.Random) -> dict:
    suffix = secrets.token_hex(3)
    return {
        "gateway_id": f"{DEVICE_PREFIX}GW-{suffix}",
        "nodes": [
            new_node_state(f"{DEVICE_PREFIX}{suffix}-N{index}", name, config, rng).to_dict()
            for index, name in enumerate(farm_config["nodes"], start=1)
        ],
    }


def command_run(config: dict, state: dict, once: bool, fault: str | None = None) -> None:
    rng = random.Random()
    sites = []
    for farm_config in config["farms"]:
        entry = state["gateways"].get(farm_config["key"])
        if entry is None:
            entry = state["gateways"][farm_config["key"]] = new_entry(farm_config, config, rng)
            save_state(state)
        sites.append(Site(farm_config, entry, config, rng, fault))

    print("\nDaftarkan kebun di web (Registrasi Kebun) memakai ID gateway, lokasi, dan penutup tanah di bawah.")
    print("Sebelum terdaftar, data dari gateway diabaikan server.")
    for site, farm_config in zip(sites, config["farms"]):
        cover = GROUND_COVER_LABELS[farm_config.get("ground_cover", "open")]
        print(f"  {site.name} ({farm_config['location']}, {cover}): ID gateway {site.gateway_id}")
        site.link.start()

    # Beri waktu menyambung ke broker sebelum putaran pertama.
    deadline = time.monotonic() + 10
    while not all(site.link.connected for site in sites) and time.monotonic() < deadline:
        time.sleep(0.2)

    def save_sites() -> None:
        state["gateways"].update({farm["key"]: site.to_entry() for farm, site in zip(config["farms"], sites)})
        save_state(state)

    try:
        while True:
            now = time.time()
            sent = False
            for site in sites:
                sent = site.step(now, send_all=once) or sent
            if sent:
                save_sites()
            if once:
                break
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nSimulator dihentikan.")
    finally:
        for site in sites:
            site.link.stop()
        save_sites()


def command_reset(config: dict, state: dict) -> None:
    if not state["gateways"]:
        print("Tidak ada perangkat simulasi yang tercatat.")
        return
    for key, entry in list(state["gateways"].items()):
        nodes = [(node["node_id"], node["name"]) for node in entry["nodes"]]
        GatewayLink(entry["gateway_id"], nodes, config["mqtt"], config["firmware_version"]).clear_retained()
        print(f"Gateway {entry['gateway_id']} dilupakan, pesan retain-nya dihapus dari broker.")
        del state["gateways"][key]
        save_state(state)
    print("Hapus kebunnya di web (Kebun Saya) kalau tidak dipakai lagi.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Simulator perangkat IoT LoraField (MQTT).")
    parser.add_argument("command", choices=["run", "reset"])
    parser.add_argument("--config", help="Path config JSON (default config.json, lalu config.example.json)")
    parser.add_argument("--once", action="store_true", help="run: kirim satu putaran saja lalu berhenti")
    parser.add_argument(
        "--fault",
        choices=sorted(SENSOR_FAULTS),
        help="run: paksa node pertama tiap kebun mengalami kerusakan sensor ini, untuk menguji pengaman server",
    )
    args = parser.parse_args()

    config = load_config(args.config)
    state = load_state()
    if args.command == "run":
        command_run(config, state, args.once, args.fault)
    else:
        command_reset(config, state)


if __name__ == "__main__":
    main()
