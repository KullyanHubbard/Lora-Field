// Firmware gateway LoraField: terima paket LoRa dari node, teruskan ke MQTT (docs/kontrak-mqtt.md),
// dan teruskan perintah valve dari server ke node.
#include <Arduino.h>
#include <LoRa.h>
#include <PubSubClient.h>
#include <SPI.h>
#include <WiFi.h>
#include <esp_mac.h>
#include <lorafield.h>
#include <time.h>

#include "config.h"
#if __has_include("secrets.h")
#include "secrets.h"
#else
#warning "include/secrets.h belum ada, memakai secrets.example.h"
#include "secrets.example.h"
#endif

using namespace lorafield;

namespace {

// Node yang pernah terdengar atau pernah diberi perintah, beserta perintah valve terakhirnya.
struct NodeEntry {
  uint8_t mac[6];
  char id[16];
  bool heard;  // terdengar sejak heartbeat terakhir
  bool has_command;
  bool desired_open;
  uint32_t until;
  bool reported_open;
};

WiFiClient wifi;
PubSubClient mqtt(wifi);
char gateway_id[16];
NodeEntry nodes[GATEWAY_MAX_NODES];
int node_count = 0;
unsigned long last_heartbeat_ms = 0;
unsigned long last_mqtt_attempt_ms = 0;

void topicFor(char* out, size_t len, const char* suffix) {
  snprintf(out, len, "lorafield/gw/%s/%s", gateway_id, suffix);
}

NodeEntry* findNode(const uint8_t mac[6]) {
  for (int i = 0; i < node_count; i++) {
    if (memcmp(nodes[i].mac, mac, 6) == 0) return &nodes[i];
  }
  if (node_count == GATEWAY_MAX_NODES) return nullptr;
  NodeEntry& entry = nodes[node_count++];
  memset(&entry, 0, sizeof entry);
  memcpy(entry.mac, mac, 6);
  deviceId("ND", mac, entry.id, sizeof entry.id);
  return &entry;
}

void sendValve(const NodeEntry& node) {
  ValveCommand command;
  memcpy(command.node_mac, node.mac, 6);
  command.duration_s = node.desired_open ? remainingOpenSeconds(node.until, time(nullptr)) : 0;
  command.open = command.duration_s > 0;
  uint8_t packet[kValvePacketSize];
  LoRa.beginPacket();
  LoRa.write(packet, encodeValve(command, packet, sizeof packet));
  LoRa.endPacket();
  Serial.printf("%s: perintah valve %s (%lu detik)\n", node.id, command.open ? "buka" : "tutup",
                (unsigned long)command.duration_s);
}

void publishNodes() {
  // Tanpa nama: nama node diberi server, gateway hanya tahu ID-nya.
  String body = "{\"nodes\":[";
  for (int i = 0; i < node_count; i++) {
    if (i > 0) body += ",";
    body += "{\"node_id\":\"";
    body += nodes[i].id;
    body += "\"}";
  }
  body += "]}";
  char topic[64];
  topicFor(topic, sizeof topic, "nodes");
  mqtt.publish(topic, body.c_str());
}

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  char node_id[33];
  uint8_t mac[6];
  bool open;
  uint32_t until;
  if (!nodeIdFromValveTopic(topic, node_id, sizeof node_id) || !macFromDeviceId(node_id, mac)) return;
  if (!parseValveCommand(payload, length, open, until)) {
    Serial.printf("%s: perintah valve rusak, diabaikan\n", node_id);
    return;
  }
  NodeEntry* node = findNode(mac);
  if (node == nullptr) return;
  node->has_command = true;
  node->desired_open = open;
  node->until = until;
  // Node selalu mendengarkan di antara kiriman datanya, jadi perintah langsung dikirim.
  sendValve(*node);
}

void onLoRaPacket(int size) {
  uint8_t packet[32];
  size_t len = 0;
  while (LoRa.available() && len < sizeof packet) packet[len++] = LoRa.read();
  Reading reading;
  if (size != (int)len || !decodeReading(packet, len, reading)) return;
  NodeEntry* node = findNode(reading.node_mac);
  if (node == nullptr) {
    Serial.println("Tabel node penuh, paket diabaikan");
    return;
  }
  node->heard = true;
  node->reported_open = reading.valve_open;

  char json[256], topic[96], suffix[48];
  readingJson(reading, LoRa.packetRssi(), json, sizeof json);
  snprintf(suffix, sizeof suffix, "node/%s/reading", node->id);
  topicFor(topic, sizeof topic, suffix);
  // Broker putus: data dibuang, tidak ditumpuk (kontrak: jangan kirim data lama).
  bool sent = mqtt.connected() && mqtt.publish(topic, json);
  Serial.printf("%s: %s %s\n", node->id, json, sent ? "terkirim" : "tidak terkirim");

  // Node baru saja kirim dan sedang mendengar: ulangi perintah yang belum dijalankannya.
  if (node->has_command && valveMismatch(node->desired_open, node->until, time(nullptr), node->reported_open)) {
    sendValve(*node);
  }
}

void connectWifiAndClock() {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Menyambung WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  // Jam NTP wajib sebelum MQTT: perintah valve memakai jam tutup mutlak (epoch UTC).
  configTime(0, 0, "pool.ntp.org", "time.google.com");
  Serial.print("\nSinkron jam NTP");
  while (time(nullptr) < 1700000000) {
    delay(500);
    Serial.print(".");
  }
  Serial.println(" selesai");
}

bool connectMqtt() {
  char status_topic[64], valve_topic[64], online[64];
  topicFor(status_topic, sizeof status_topic, "status");
  topicFor(valve_topic, sizeof valve_topic, "node/+/valve/set");
  const char* password = strlen(MQTT_PASSWORD) > 0 ? MQTT_PASSWORD : nullptr;
  const char* user = password != nullptr ? gateway_id : nullptr;
  if (!mqtt.connect(gateway_id, user, password, status_topic, 1, true, "{\"state\":\"offline\"}")) {
    Serial.printf("MQTT gagal (state %d), coba lagi\n", mqtt.state());
    return false;
  }
  snprintf(online, sizeof online, "{\"state\":\"online\",\"fw\":\"%s\"}", FIRMWARE_VERSION);
  mqtt.publish(status_topic, online, true);
  publishNodes();
  mqtt.subscribe(valve_topic, 1);
  Serial.println("Tersambung ke broker MQTT");
  return true;
}

void heartbeat() {
  int heard = 0;
  for (int i = 0; i < node_count; i++) {
    heard += nodes[i].heard ? 1 : 0;
    nodes[i].heard = false;
  }
  char body[64], topic[64];
  snprintf(body, sizeof body, "{\"uptime_s\":%lu,\"nodes_heard\":%d}", millis() / 1000, heard);
  topicFor(topic, sizeof topic, "heartbeat");
  mqtt.publish(topic, body);
  // Daftar node ikut tiap heartbeat, untuk kebun yang didaftarkan setelah gateway menyala.
  publishNodes();
}

}  // namespace

void setup() {
  Serial.begin(115200);
  uint8_t mac[6];
  esp_read_mac(mac, ESP_MAC_WIFI_STA);
  deviceId("GW", mac, gateway_id, sizeof gateway_id);
  Serial.printf("\nLoraField gateway %s, firmware %s\n", gateway_id, FIRMWARE_VERSION);
  Serial.println("Daftarkan kebun di web memakai ID gateway ini.");

  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_SS);
  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);
  while (!LoRa.begin(LORA_FREQUENCY)) {
    Serial.println("Radio LoRa tidak terdeteksi, cek pin di config.h");
    delay(2000);
  }
  LoRa.setSpreadingFactor(LORA_SPREADING_FACTOR);
  LoRa.setSyncWord(LORA_SYNC_WORD);
  LoRa.enableCrc();

  connectWifiAndClock();
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setBufferSize(1024);
  mqtt.setKeepAlive(60);
  mqtt.setCallback(onMqttMessage);
}

void loop() {
  unsigned long now = millis();
  if (!mqtt.connected() && WiFi.status() == WL_CONNECTED && now - last_mqtt_attempt_ms >= MQTT_RETRY_MS) {
    last_mqtt_attempt_ms = now;
    connectMqtt();
  }
  mqtt.loop();

  int size = LoRa.parsePacket();
  if (size > 0) onLoRaPacket(size);

  if (mqtt.connected() && now - last_heartbeat_ms >= GATEWAY_HEARTBEAT_MS) {
    last_heartbeat_ms = now;
    heartbeat();
  }
}
