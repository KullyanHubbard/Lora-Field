"""Sisi MQTT gateway simulasi. Mengikuti docs/kontrak-mqtt.md persis seperti firmware gateway."""

from __future__ import annotations

import json

import paho.mqtt.client as mqtt

TOPIC_ROOT = "lorafield/gw"


class GatewayLink:
    def __init__(self, gateway_id: str, nodes: list[tuple[str, str]], mqtt_config: dict, firmware: str) -> None:
        """nodes = [(node_id, nama)] yang dikelola gateway ini."""
        self.gateway_id = gateway_id
        self.nodes = nodes
        self.firmware = firmware
        self.connected = False
        self.wifi_down = False
        # Perintah valve terakhir per node dari server, diisi thread paho, diambil loop utama.
        self.pending: dict[str, dict] = {}
        self._mqtt = mqtt_config
        self._client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=gateway_id)
        self._client.will_set(self._topic("status"), json.dumps({"state": "offline"}), qos=1, retain=True)
        self._client.on_connect = self._on_connect
        self._client.on_disconnect = self._on_disconnect
        self._client.on_message = self._on_message

    def _topic(self, suffix: str) -> str:
        return f"{TOPIC_ROOT}/{self.gateway_id}/{suffix}"

    def start(self) -> None:
        # connect_async: kalau broker belum jalan, paho terus mencoba menyambung sendiri.
        self._client.connect_async(self._mqtt["host"], self._mqtt["port"], self._mqtt["keepalive_seconds"])
        self._client.loop_start()

    def stop(self) -> None:
        if self.wifi_down:
            return  # koneksi sudah hilang bersama WiFi
        # Mati terencana: kirim status offline sendiri, bukan menunggu Last Will.
        if self.connected:
            info = self._publish("status", {"state": "offline"}, qos=1, retain=True)
            if info.rc == mqtt.MQTT_ERR_SUCCESS:
                info.wait_for_publish(5)
        self._client.disconnect()
        self._client.loop_stop()

    def _publish(self, suffix: str, data, qos: int = 0, retain: bool = False) -> mqtt.MQTTMessageInfo:
        body = b"" if data is None else json.dumps(data, separators=(",", ":"))
        return self._client.publish(self._topic(suffix), body, qos=qos, retain=retain)

    def publish_reading(self, node_id: str, reading: dict) -> bool:
        if self.wifi_down:
            return False
        return self._publish(f"node/{node_id}/reading", reading).rc == mqtt.MQTT_ERR_SUCCESS

    def drop_wifi(self) -> None:
        """WiFi gateway putus: koneksi hilang tanpa pamit (tanpa DISCONNECT), jadi broker mengirim Last Will."""
        self.wifi_down = True
        self.connected = False
        self._client.loop_stop()
        sock = self._client.socket()
        if sock is not None:
            sock.close()

    def restore_wifi(self) -> None:
        self.wifi_down = False
        self.start()

    def publish_heartbeat(self, uptime_s: int, nodes_heard: int) -> None:
        self._publish("heartbeat", {"uptime_s": uptime_s, "nodes_heard": nodes_heard})

    def publish_nodes(self) -> None:
        self._publish("nodes", {"nodes": [{"node_id": node_id, "name": name} for node_id, name in self.nodes]})

    def clear_retained(self) -> None:
        """Hapus pesan retain gateway ini di broker (status dan perintah valve tiap node)."""
        # Klien terpisah tanpa callback, supaya tidak ikut mengirim status online saat tersambung.
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=self.gateway_id)
        client.connect(self._mqtt["host"], self._mqtt["port"], self._mqtt["keepalive_seconds"])
        client.loop_start()
        topics = [self._topic("status")] + [self._topic(f"node/{node_id}/valve/set") for node_id, _ in self.nodes]
        for info in [client.publish(topic, b"", qos=1, retain=True) for topic in topics]:
            info.wait_for_publish(5)
        client.disconnect()
        client.loop_stop()

    def _on_connect(self, client, userdata, flags, reason_code, properties) -> None:
        if reason_code.is_failure:
            print(f"[{self.gateway_id}] broker menolak koneksi: {reason_code}")
            return
        self.connected = True
        print(f"[{self.gateway_id}] tersambung ke broker MQTT")
        self._publish("status", {"state": "online", "fw": self.firmware}, retain=True)
        self.publish_nodes()
        client.subscribe(self._topic("node/+/valve/set"), qos=1)

    def _on_disconnect(self, client, userdata, flags, reason_code, properties) -> None:
        if self.connected:
            print(f"[{self.gateway_id}] koneksi broker putus ({reason_code}), mencoba lagi...")
        self.connected = False

    def _on_message(self, client, userdata, message) -> None:
        # lorafield/gw/{gw}/node/{node}/valve/set
        node_id = message.topic.split("/")[4]
        if not message.payload:
            # Retain dihapus server: tidak ada perintah, valve tutup.
            self.pending[node_id] = {"state": "closed"}
            return
        try:
            command = json.loads(message.payload)
        except ValueError:
            print(f"[{self.gateway_id}] perintah valve rusak untuk {node_id}, diabaikan")
            return
        if isinstance(command, dict) and command.get("state") in ("open", "closed"):
            self.pending[node_id] = command
