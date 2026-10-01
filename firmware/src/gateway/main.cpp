// Firmware gateway LoraField: terima paket LoRa dari node, teruskan ke MQTT (docs/kontrak-mqtt.md),
// dan teruskan perintah valve dari server ke node.
//
// Pengaturan per alat tidak ditanam di kode. Alamat server, password MQTT, dan password hotspot ada di
// memori alat (diisi lewat Serial saat produksi, lihat tools/provision.py). WiFi diisi pembeli lewat
// portal di HP: hotspot LoraField-XXXX, password di stiker.
#include <Arduino.h>
#include <ArduinoJson.h>
#include <LoRa.h>
#include <Preferences.h>
#include <PubSubClient.h>
#include <SPI.h>
#include <WiFi.h>
#include <WiFiManager.h>
#include <esp_mac.h>
#include <esp_system.h>
#include <lorafield.h>
#include <soc/rtc_cntl_reg.h>
#include <time.h>

#include "config.h"

using namespace lorafield;

namespace {

// File portal yang tertanam di firmware (platformio.ini: board_build.embed_txtfiles/embed_files).
extern const char portal_page[] asm("_binary_portal_index_html_start");
extern const uint8_t portal_font_start[] asm("_binary_portal_geist_latin_wght_normal_woff2_start");
extern const uint8_t portal_font_end[] asm("_binary_portal_geist_latin_wght_normal_woff2_end");

constexpr const char* kPrefsNamespace = "lorafield";
constexpr time_t kClockValidEpoch = 1700000000;  // jam di bawah ini berarti NTP belum sinkron

struct Settings {
  char mqtt_host[64];
  uint16_t mqtt_port;
  char mqtt_pass[65];
  char ap_pass[64];
};

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
Preferences prefs;
Settings settings;  // PubSubClient menyimpan pointer mqtt_host, jadi harus tetap hidup (global)
char gateway_id[16];
char portal_ssid[24];
char serial_line[160];
size_t serial_pos = 0;
NodeEntry nodes[GATEWAY_MAX_NODES];
int node_count = 0;
unsigned long last_heartbeat_ms = 0;
unsigned long last_mqtt_attempt_ms = 0;
unsigned long last_clock_log_ms = 0;
bool clock_ready = false;
uint32_t brownout_config = 0;  // isi register pendeteksi brownout saat menyala, untuk dipasang lagi
bool brownout_detector_off = false;
bool wifi_portal_requested = false;  // perintah "Ganti WiFi" dari web, dijalankan di loop()
// Status percobaan sambung dari halaman portal. Selama WiFiManager mencoba terhubung, web server-nya
// diam; jadi permintaan status yang terlayani saat masih Connecting berarti percobaan itu gagal.
enum class PortalLink { Idle, Connecting, Connected };
PortalLink portal_link = PortalLink::Idle;
WifiRecovery wifi_recovery(WIFI_RECONNECT_WINDOW_MS, WIFI_RECONNECT_EVERY_MS, WIFI_REST_MS);

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
  char cmd_topic[64];
  topicFor(cmd_topic, sizeof cmd_topic, "cmd");
  if (strcmp(topic, cmd_topic) == 0) {
    if (parseGatewayCommand(payload, length) == GatewayCommand::WifiPortal) {
      wifi_portal_requested = true;
    } else {
      Serial.println("Perintah server tidak dikenal, diabaikan");
    }
    return;
  }
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

void loadSettings() {
  memset(&settings, 0, sizeof settings);
  settings.mqtt_port = 1883;
  // Mode tulis: pada alat baru namespace dibuat kosong, bukan gagal dengan pesan error di Serial.
  if (!prefs.begin(kPrefsNamespace, false)) return;
  if (prefs.isKey("mqtt_host")) prefs.getString("mqtt_host", settings.mqtt_host, sizeof settings.mqtt_host);
  if (prefs.isKey("mqtt_pass")) prefs.getString("mqtt_pass", settings.mqtt_pass, sizeof settings.mqtt_pass);
  if (prefs.isKey("ap_pass")) prefs.getString("ap_pass", settings.ap_pass, sizeof settings.ap_pass);
  settings.mqtt_port = prefs.getUShort("mqtt_port", 1883);
  prefs.end();
}

bool settingsComplete() {
  return settings.mqtt_host[0] != '\0' && settings.mqtt_pass[0] != '\0' && settings.ap_pass[0] != '\0';
}

void saveSetting(SettingKey key, const char* value) {
  prefs.begin(kPrefsNamespace, false);
  if (key == SettingKey::MqttPort) {
    prefs.putUShort("mqtt_port", static_cast<uint16_t>(atoi(value)));
  } else {
    prefs.putString(settingName(key), value);  // nama kunci NVS = nama pengaturan
  }
  prefs.end();
  loadSettings();
}

// Tombol RST ditekan dua kali dalam CONFIG_WINDOW_MS: minta portal, tanpa menghapus WiFi lama. Reset
// pertama memasang penanda di memori, penanda dilepas setelah jeda itu. Restart karena brownout atau dari
// program tidak dihitung sebagai tekan RST. Permintaan portal disimpan sampai portal benar-benar dibuka,
// jadi tidak hilang kalau board sempat restart karena brownout saat radio WiFi menyala.
bool portalRequested() {
  esp_reset_reason_t reason = esp_reset_reason();
  bool pressed = reason == ESP_RST_POWERON || reason == ESP_RST_EXT;
  prefs.begin(kPrefsNamespace, false);
  bool armed = prefs.getBool("rst_armed", false);
  bool requested = prefs.getBool("portal_req", false) || (pressed && armed);
  prefs.putBool("rst_armed", pressed && !armed);
  prefs.putBool("portal_req", requested);
  prefs.end();
  return requested;
}

void disarmDoubleReset() {
  prefs.begin(kPrefsNamespace, false);
  prefs.putBool("rst_armed", false);
  prefs.end();
}

void setPortalRequest(bool requested) {
  prefs.begin(kPrefsNamespace, false);
  prefs.putBool("portal_req", requested);
  prefs.end();
}

void printMissingSettings() {
  Serial.print("Pengaturan belum lengkap:");
  if (settings.mqtt_host[0] == '\0') Serial.print(" mqtt_host");
  if (settings.mqtt_pass[0] == '\0') Serial.print(" mqtt_pass");
  if (settings.ap_pass[0] == '\0') Serial.print(" ap_pass");
  Serial.println();
}

// Password tidak pernah dicetak, hanya keterangan terisi atau kosong.
void printSettings() {
  Serial.printf("ID gateway: %s\n", gateway_id);
  Serial.printf("mqtt_host: %s\n", settings.mqtt_host[0] ? settings.mqtt_host : "(kosong)");
  Serial.printf("mqtt_port: %u\n", settings.mqtt_port);
  Serial.printf("mqtt_pass: %s\n", settings.mqtt_pass[0] ? "(terisi)" : "(kosong)");
  Serial.printf("ap_pass: %s\n", settings.ap_pass[0] ? "(terisi)" : "(kosong)");
  Serial.printf("hotspot portal: %s\n", portal_ssid);
  Serial.printf("WiFi: %s\n", WiFi.status() == WL_CONNECTED ? WiFi.SSID().c_str() : "(belum tersambung)");
}

// Restart terencana: kirim status offline sendiri (kontrak MQTT), karena DISCONNECT membuat broker tidak
// mengirim Last Will.
void announceOffline() {
  if (!mqtt.connected()) return;
  char status_topic[64];
  topicFor(status_topic, sizeof status_topic, "status");
  mqtt.publish(status_topic, "{\"state\":\"offline\"}", true);
  mqtt.disconnect();
}

[[noreturn]] void restartGateway() {
  announceOffline();
  Serial.flush();
  delay(200);
  ESP.restart();
  for (;;) {
  }
}

[[noreturn]] void forgetWifiAndRestart() {
  Serial.println("WiFi tersimpan dihapus. Gateway mulai ulang lalu membuka portal WiFi.");
  announceOffline();
  WiFiManager wm;
  wm.resetSettings();
  restartGateway();
}

void handleCommand(char* line) {
  size_t len = strlen(line);
  while (len > 0 && line[len - 1] == ' ') line[--len] = '\0';
  if (len == 0) return;
  if (strcmp(line, "show") == 0) {
    printSettings();
  } else if (strcmp(line, "config") == 0) {
    Serial.println("OK config");
  } else if (strcmp(line, "restart") == 0) {
    Serial.println("OK restart");
    restartGateway();
  } else if (strcmp(line, "forget wifi") == 0) {
    Serial.println("OK forget wifi");
    forgetWifiAndRestart();
  } else if (strcmp(line, "portal") == 0) {
    Serial.println("OK portal");
    setPortalRequest(true);
    restartGateway();
  } else if (strncmp(line, "set ", 4) == 0) {
    SettingKey key;
    char value[65];
    const char* error = nullptr;
    if (!parseSetCommand(line, key, value, sizeof value, error)) {
      Serial.printf("ERROR %s\n", error);
      return;
    }
    saveSetting(key, value);
    memset(value, 0, sizeof value);  // password tidak dibiarkan tertinggal di memori
    Serial.printf("OK %s\n", settingName(key));
    if (settingsComplete()) Serial.println("Pengaturan lengkap. Ketik restart supaya berlaku.");
  } else {
    Serial.println("ERROR perintah tidak dikenal. Perintah: show, set <kunci> <nilai>, portal, forget wifi, restart");
  }
}

bool readSerialLine() {
  while (Serial.available() > 0) {
    char c = static_cast<char>(Serial.read());
    if (c == '\r') continue;
    if (c == '\n') {
      serial_line[serial_pos] = '\0';
      serial_pos = 0;
      return true;
    }
    if (serial_pos < sizeof serial_line - 1) serial_line[serial_pos++] = c;
  }
  return false;
}

void pollSerial() {
  if (!readSerialLine()) return;
  handleCommand(serial_line);
  memset(serial_line, 0, sizeof serial_line);
}

// Jeda singkat setelah menyala: perintah "config" lewat Serial masuk mode pengaturan (tools/provision.py).
bool configRequested() {
  unsigned long start = millis();
  while (millis() - start < CONFIG_WINDOW_MS) {
    if (readSerialLine()) {
      bool requested = strcmp(serial_line, "config") == 0;
      memset(serial_line, 0, sizeof serial_line);
      if (requested) return true;
    }
    delay(10);
  }
  return false;
}

// Hanya melayani perintah Serial sampai "restart". Alat baru dari pabrik selalu masuk sini, jadi gateway
// tidak pernah membuka hotspot tanpa password.
[[noreturn]] void provisioningMode() {
  Serial.println(
      "MODE PENGATURAN. Perintah: show | set mqtt_host <alamat> | set mqtt_port <port> | "
      "set mqtt_pass <password> | set ap_pass <password hotspot, 8-63 karakter> | portal | forget wifi | restart");
  unsigned long last_reminder_ms = 0;
  bool reminded = false;
  for (;;) {
    pollSerial();
    if (!settingsComplete() && (!reminded || millis() - last_reminder_ms >= 15000)) {
      printMissingSettings();
      last_reminder_ms = millis();
      reminded = true;
    }
    delay(10);
  }
}

// Lonjakan arus saat radio WiFi menyala dan selama hotspot portal aktif membuat tegangan turun sesaat di
// board tanpa baterai (uji 2026-10-02: port USB komputer dan charger 5V 1,2A). Pendeteksi brownout lalu
// me-restart board berulang-ulang, dan hotspot hanya sempat muncul sekilas tanpa nama. Pendeteksi
// dimatikan hanya selama connectWifi(), lalu dipasang lagi begitu WiFi tersambung: saat beroperasi normal
// board tetap di-restart kalau tegangan benar-benar turun. Perbaikan utamanya tetap di sumber daya (H2).
void setBrownoutDetector(bool enabled) {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, enabled ? brownout_config : 0);
  brownout_detector_off = !enabled;
}

void redirectToWifiPage(WiFiManager& wm) {
  wm.server->sendHeader("Location", "http://" + WiFi.softAPIP().toString() + "/wifi", true);
  wm.server->send(302, "text/plain", "");
}

// Halaman portal sendiri (portal/index.html, tertanam lewat board_build.embed_txtfiles) menggantikan
// halaman /wifi bawaan WiFiManager. Penyimpanan WiFi tetap lewat /wifisave bawaan WiFiManager.
void sendPortalPage(WiFiManager& wm) {
  String html(portal_page);
  html.replace("{{GATEWAY_ID}}", gateway_id);
  wm.server->sendHeader("Cache-Control", "no-store");
  wm.server->send(200, "text/html; charset=utf-8", html);
}

void sendPortalFont(WiFiManager& wm) {
  wm.server->sendHeader("Cache-Control", "public, max-age=31536000, immutable");
  wm.server->send_P(200, "font/woff2", reinterpret_cast<const char*>(portal_font_start),
                    portal_font_end - portal_font_start);
}

// Status untuk halaman portal: {"state": "idle" | "connected" | "failed"}.
void sendPortalStatus(WiFiManager& wm) {
  const char* state = "idle";
  if (portal_link == PortalLink::Connected) {
    state = "connected";
  } else if (portal_link == PortalLink::Connecting) {
    state = "failed";
    portal_link = PortalLink::Idle;
  }
  wm.server->sendHeader("Cache-Control", "no-store");
  wm.server->send(200, "application/json", String("{\"state\":\"") + state + "\"}");
}

// Daftar WiFi untuk halaman portal: [{ssid, rssi, secure}], diurutkan rankNetworks (lib/lorafield).
void sendScanResults(WiFiManager& wm) {
  int count = WiFi.scanNetworks();
  std::vector<ScannedNetwork> scanned;
  for (int i = 0; i < count; i++) {
    scanned.push_back({WiFi.SSID(i).c_str(), WiFi.RSSI(i), WiFi.encryptionType(i) != WIFI_AUTH_OPEN});
  }
  WiFi.scanDelete();
  JsonDocument doc;
  JsonArray list = doc.to<JsonArray>();
  for (const ScannedNetwork& net : rankNetworks(scanned, 20)) {
    JsonObject item = list.add<JsonObject>();
    item["ssid"] = net.ssid;
    item["rssi"] = net.rssi;
    item["secure"] = net.secure;
  }
  String body;
  serializeJson(doc, body);
  wm.server->sendHeader("Cache-Control", "no-store");
  wm.server->send(count < 0 ? 503 : 200, "application/json", body);
}

// Coba WiFi tersimpan; kalau gagal atau belum ada, buka portal. Portal tutup sendiri setelah
// WIFI_PORTAL_TIMEOUT_S tanpa HP tersambung, lalu WiFi tersimpan dicoba lagi, bergantian, sampai
// tersambung. Contoh: listrik padam dan router menyala lebih lambat dari gateway. open_portal: portal
// dibuka dulu (RST dua kali).
void connectWifi(bool open_portal) {
  setBrownoutDetector(false);
  portal_link = PortalLink::Idle;
  WiFi.mode(WIFI_STA);
  WiFiManager wm;
  wm.setDebugOutput(false);
  wm.setTitle("LoraField");
  const char* menu[] = {"wifi"};
  wm.setMenu(menu, 1);
  wm.setShowInfoUpdate(false);
  wm.setShowInfoErase(false);
  // Handler yang didaftarkan di sini dipakai lebih dulu daripada bawaan WiFiManager.
  wm.setWebServerCallback([&wm]() {
    // HP yang tersambung ke hotspot langsung mendapat daftar WiFi: halaman utama dan alamat cek internet
    // iPhone, Android, dan Windows dialihkan ke /wifi. Pengalihan inilah yang membuat HP membuka halaman
    // pengaturan sendiri; tanpa menu, pembeli tidak perlu menekan "Atur WiFi" dulu.
    for (const char* path : {"/", "/0wifi", "/hotspot-detect.html", "/library/test/success.html",
                             "/generate_204", "/gen_204", "/connecttest.txt", "/ncsi.txt", "/redirect",
                             "/canonical.html", "/success.txt"}) {
      wm.server->on(path, HTTP_ANY, [&wm]() { redirectToWifiPage(wm); });
    }
    wm.server->on("/wifi", HTTP_GET, [&wm]() { sendPortalPage(wm); });
    wm.server->on("/geist.woff2", HTTP_GET, [&wm]() { sendPortalFont(wm); });
    wm.server->on("/scan.json", HTTP_GET, [&wm]() { sendScanResults(wm); });
    wm.server->on("/status.json", HTTP_GET, [&wm]() { sendPortalStatus(wm); });
    // Halaman bawaan lain tetap terdaftar walau tidak ada di menu: unggah firmware, hapus WiFi, info,
    // restart, dan keluar portal ditutup.
    for (const char* path : {"/update", "/u", "/erase", "/info", "/param", "/paramsave", "/restart", "/exit"}) {
      wm.server->on(path, HTTP_ANY, [&wm]() { wm.server->send(404, "text/plain", "Tidak tersedia"); });
    }
  });
  wm.setAPCallback([](WiFiManager*) {
    Serial.printf("Portal WiFi dibuka: sambungkan HP ke hotspot %s (password di stiker), lalu pilih WiFi.\n",
                  portal_ssid);
  });
  wm.setPreSaveConfigCallback([]() { portal_link = PortalLink::Connecting; });
  // Dipanggil WiFiManager setelah berhasil terhubung, sebelum hotspot dimatikan: hotspot ditahan
  // PORTAL_SUCCESS_NOTICE_MS supaya halaman di HP sempat menerima status "connected".
  wm.setSaveConfigCallback([&wm]() {
    Serial.println("WiFi baru disimpan dari portal");
    portal_link = PortalLink::Connected;
    unsigned long started = millis();
    while (millis() - started < PORTAL_SUCCESS_NOTICE_MS) {
      wm.server->handleClient();
      delay(5);
    }
  });
  wm.setConnectTimeout(WIFI_CONNECT_TIMEOUT_S);
  wm.setConnectRetries(WIFI_CONNECT_RETRIES);
  wm.setConfigPortalTimeout(WIFI_PORTAL_TIMEOUT_S);
  wm.setAPClientCheck(true);  // portal tidak ditutup selama masih ada HP tersambung ke hotspot
  bool connected = false;
  if (open_portal) {
    Serial.println("Portal diminta (RST dua kali atau Ganti WiFi dari web): kalau WiFi tidak diganti, WiFi lama tetap dipakai.");
    connected = wm.startConfigPortal(portal_ssid, settings.ap_pass);
    setPortalRequest(false);
  }
  if (!connected) Serial.println("Menyambung WiFi...");
  while (!connected && !wm.autoConnect(portal_ssid, settings.ap_pass)) {
    Serial.println("Portal ditutup tanpa WiFi baru, mencoba WiFi tersimpan lagi");
  }
  Serial.printf("WiFi tersambung: %s, IP %s\n", WiFi.SSID().c_str(), WiFi.localIP().toString().c_str());
  setBrownoutDetector(true);
  // Perintah Serial yang masuk selama portal berjalan tidak dilayani saat itu. Dibuang di sini supaya
  // tidak dijalankan belakangan, mis. "portal" yang membuka portal lagi tepat setelah WiFi tersambung.
  while (Serial.available() > 0) Serial.read();
  serial_pos = 0;
}

bool connectMqtt() {
  char status_topic[64], valve_topic[64], online[64];
  topicFor(status_topic, sizeof status_topic, "status");
  topicFor(valve_topic, sizeof valve_topic, "node/+/valve/set");
  // Kontrak MQTT: username = ID gateway, password per alat dari memori.
  if (!mqtt.connect(gateway_id, gateway_id, settings.mqtt_pass, status_topic, 1, true,
                    "{\"state\":\"offline\"}")) {
    Serial.printf("MQTT gagal (state %d), coba lagi\n", mqtt.state());
    return false;
  }
  snprintf(online, sizeof online, "{\"state\":\"online\",\"fw\":\"%s\"}", FIRMWARE_VERSION);
  mqtt.publish(status_topic, online, true);
  publishNodes();
  mqtt.subscribe(valve_topic, 1);
  char cmd_topic[64];
  topicFor(cmd_topic, sizeof cmd_topic, "cmd");
  mqtt.subscribe(cmd_topic, 1);
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
  brownout_config = READ_PERI_REG(RTC_CNTL_BROWN_OUT_REG);
  Serial.begin(115200);
  uint8_t mac[6];
  esp_read_mac(mac, ESP_MAC_WIFI_STA);
  deviceId("GW", mac, gateway_id, sizeof gateway_id);
  portalName(gateway_id, portal_ssid, sizeof portal_ssid);
  // Baris ini dibaca tools/provision.py, jangan ubah formatnya.
  Serial.printf("\nLoraField gateway %s, firmware %s\n", gateway_id, FIRMWARE_VERSION);
  Serial.println("Daftarkan kebun di web memakai ID gateway ini.");

  if (esp_reset_reason() == ESP_RST_BROWNOUT) {
    Serial.println("Restart sebelumnya karena tegangan turun (brownout). Cek adaptor dan kabel, atau pasang baterai.");
  }
  loadSettings();
  bool open_portal = portalRequested();
  Serial.printf("Ketik \"config\" dalam %lu detik untuk masuk mode pengaturan.\n", CONFIG_WINDOW_MS / 1000);
  bool config = configRequested();
  disarmDoubleReset();
  if (config || !settingsComplete()) provisioningMode();

  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_SS);
  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);
  while (!LoRa.begin(LORA_FREQUENCY)) {
    Serial.println("Radio LoRa tidak terdeteksi, cek pin di config.h");
    delay(2000);
  }
  LoRa.setSpreadingFactor(LORA_SPREADING_FACTOR);
  LoRa.setSyncWord(LORA_SYNC_WORD);
  LoRa.enableCrc();

  connectWifi(open_portal);
  configTime(0, 0, "pool.ntp.org", "time.google.com");
  mqtt.setServer(settings.mqtt_host, settings.mqtt_port);
  mqtt.setBufferSize(1024);
  mqtt.setKeepAlive(60);
  mqtt.setCallback(onMqttMessage);
}

// WiFi putus saat berjalan: portal tidak dibuka (router yang restart tidak boleh membuat gateway pindah ke
// mode portal). Jadwal sambung ulang dan istirahat radio ada di WifiRecovery (lib/lorafield).
void handleWifiRecovery(unsigned long now) {
  switch (wifi_recovery.update(WiFi.status() == WL_CONNECTED, now)) {
    case WifiRecovery::Action::Lost:
      Serial.println("WiFi putus, menyambung ulang otomatis");
      break;
    case WifiRecovery::Action::Reconnect:
      // Driver WiFi berhenti mencoba sendiri untuk sebagian penyebab putus (mis. ditolak router saat
      // router baru menyala), jadi sambung ulang dipaksa berkala.
      WiFi.reconnect();
      break;
    case WifiRecovery::Action::RadioOff:
      Serial.printf("WiFi belum kembali setelah %lu menit: radio WiFi istirahat %lu menit\n",
                    WIFI_RECONNECT_WINDOW_MS / 60000, WIFI_REST_MS / 60000);
      WiFi.mode(WIFI_OFF);
      setBrownoutDetector(true);
      break;
    case WifiRecovery::Action::RadioOn:
      Serial.println("Mencoba WiFi lagi setelah istirahat");
      setBrownoutDetector(false);  // radio menyala lagi: lonjakan arus yang sama seperti saat boot
      WiFi.mode(WIFI_STA);
      WiFi.begin();  // WiFi tersimpan dari portal
      break;
    case WifiRecovery::Action::None:
      break;
  }
  if (brownout_detector_off && WiFi.status() == WL_CONNECTED) setBrownoutDetector(true);
}

void loop() {
  unsigned long now = millis();
  pollSerial();
  handleWifiRecovery(now);

  // Jam NTP wajib sebelum MQTT: perintah valve memakai jam tutup mutlak (epoch UTC). Ditunggu tanpa
  // menghentikan loop, supaya Serial dan tombol tetap dilayani.
  if (!clock_ready) {
    if (time(nullptr) >= kClockValidEpoch) {
      clock_ready = true;
      Serial.println("Jam NTP sinkron");
    } else if (now - last_clock_log_ms >= CLOCK_LOG_MS) {
      last_clock_log_ms = now;
      Serial.println("Menunggu jam NTP (butuh internet)...");
    }
  }
  if (clock_ready && !mqtt.connected() && WiFi.status() == WL_CONNECTED &&
      now - last_mqtt_attempt_ms >= MQTT_RETRY_MS) {
    last_mqtt_attempt_ms = now;
    connectMqtt();
  }
  mqtt.loop();
  if (wifi_portal_requested) {
    Serial.println("Ganti WiFi diminta dari web: portal dibuka, WiFi lama tetap jadi cadangan.");
    setPortalRequest(true);
    restartGateway();
  }

  int size = LoRa.parsePacket();
  if (size > 0) onLoRaPacket(size);

  if (mqtt.connected() && now - last_heartbeat_ms >= GATEWAY_HEARTBEAT_MS) {
    last_heartbeat_ms = now;
    heartbeat();
  }
}
