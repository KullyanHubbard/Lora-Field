#include "lorafield.h"

#include <ArduinoJson.h>
#include <math.h>

#include <algorithm>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

namespace lorafield {

namespace {

constexpr uint8_t kMagic = 0x4C;  // 'L'
constexpr uint8_t kTypeReading = 1;
constexpr uint8_t kTypeValve = 2;
constexpr uint8_t kBatteryUnknown = 0xFF;

void put16(uint8_t* p, int16_t value) {
  p[0] = static_cast<uint8_t>(value & 0xFF);
  p[1] = static_cast<uint8_t>((value >> 8) & 0xFF);
}

int16_t get16(const uint8_t* p) { return static_cast<int16_t>(p[0] | (p[1] << 8)); }

void put32(uint8_t* p, uint32_t value) {
  for (int i = 0; i < 4; i++) p[i] = static_cast<uint8_t>(value >> (8 * i));
}

uint32_t get32(const uint8_t* p) {
  uint32_t value = 0;
  for (int i = 0; i < 4; i++) value |= static_cast<uint32_t>(p[i]) << (8 * i);
  return value;
}

bool hasHeader(const uint8_t* buf, size_t len, size_t expected, uint8_t type) {
  return len == expected && buf[0] == kMagic && buf[1] == type;
}

int hexValue(char c) {
  if (c >= '0' && c <= '9') return c - '0';
  if (c >= 'A' && c <= 'F') return c - 'A' + 10;
  if (c >= 'a' && c <= 'f') return c - 'a' + 10;
  return -1;
}

}  // namespace

size_t encodeReading(const Reading& reading, uint8_t* buf, size_t len) {
  if (len < kReadingPacketSize) return 0;
  buf[0] = kMagic;
  buf[1] = kTypeReading;
  memcpy(buf + 2, reading.node_mac, 6);
  put16(buf + 8, reading.soil_moisture_x10);
  put16(buf + 10, reading.soil_temp_x10);
  put16(buf + 12, reading.air_temp_x10);
  put16(buf + 14, reading.air_humidity_x10);
  buf[16] = reading.battery < 0 ? kBatteryUnknown : static_cast<uint8_t>(reading.battery);
  buf[17] = reading.valve_open ? 1 : 0;
  return kReadingPacketSize;
}

bool decodeReading(const uint8_t* buf, size_t len, Reading& out) {
  if (!hasHeader(buf, len, kReadingPacketSize, kTypeReading)) return false;
  memcpy(out.node_mac, buf + 2, 6);
  out.soil_moisture_x10 = get16(buf + 8);
  out.soil_temp_x10 = get16(buf + 10);
  out.air_temp_x10 = get16(buf + 12);
  out.air_humidity_x10 = get16(buf + 14);
  out.battery = buf[16] == kBatteryUnknown ? -1 : static_cast<int8_t>(buf[16]);
  out.valve_open = buf[17] != 0;
  return true;
}

size_t encodeValve(const ValveCommand& command, uint8_t* buf, size_t len) {
  if (len < kValvePacketSize) return 0;
  buf[0] = kMagic;
  buf[1] = kTypeValve;
  memcpy(buf + 2, command.node_mac, 6);
  buf[8] = command.open ? 1 : 0;
  put32(buf + 9, command.duration_s);
  return kValvePacketSize;
}

bool decodeValve(const uint8_t* buf, size_t len, ValveCommand& out) {
  if (!hasHeader(buf, len, kValvePacketSize, kTypeValve)) return false;
  memcpy(out.node_mac, buf + 2, 6);
  out.open = buf[8] != 0;
  out.duration_s = get32(buf + 9);
  return true;
}

void deviceId(const char* prefix, const uint8_t mac[6], char* out, size_t len) {
  snprintf(out, len, "%s-%02X%02X%02X%02X%02X%02X", prefix, mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
}

bool macFromDeviceId(const char* id, uint8_t mac[6]) {
  // "XX-" lalu tepat 12 digit hex.
  if (strlen(id) != 15 || id[2] != '-') return false;
  for (int i = 0; i < 6; i++) {
    int high = hexValue(id[3 + 2 * i]);
    int low = hexValue(id[4 + 2 * i]);
    if (high < 0 || low < 0) return false;
    mac[i] = static_cast<uint8_t>(high << 4 | low);
  }
  return true;
}

size_t readingJson(const Reading& reading, int rssi, char* out, size_t len) {
  JsonDocument doc;
  doc["soil_moisture"] = reading.soil_moisture_x10 / 10.0;
  doc["soil_temp"] = reading.soil_temp_x10 / 10.0;
  doc["air_temp"] = reading.air_temp_x10 / 10.0;
  doc["air_humidity"] = reading.air_humidity_x10 / 10.0;
  if (reading.battery >= 0) doc["battery"] = reading.battery;
  // Rentang validasi server. Sinyal sangat kuat (alat berdekatan) bisa terbaca di atas 0 dBm,
  // dan satu nilai di luar rentang membuat seluruh reading ditolak.
  doc["rssi"] = rssi < -150 ? -150 : (rssi > 0 ? 0 : rssi);
  doc["valve"] = reading.valve_open ? "open" : "closed";
  if (measureJson(doc) >= len) return 0;
  return serializeJson(doc, out, len);
}

const char* bootReasonCode(ResetReason reason, bool firmware_changed) {
  if (firmware_changed) return "firmware_update";
  switch (reason) {
    case ResetReason::PowerOn:
    case ResetReason::External:
      return "power_on";
    case ResetReason::Brownout:
      return "brownout";
    case ResetReason::InterruptWatchdog:
    case ResetReason::TaskWatchdog:
    case ResetReason::OtherWatchdog:
      return "watchdog";
    case ResetReason::Panic:
      return "crash";
    case ResetReason::Software:
      return "planned";
    default:
      return "other";
  }
}

size_t heartbeatJson(uint64_t uptime_s, int nodes_heard, const char* wifi_ssid, int wifi_rssi,
                     const char* boot_reason, uint32_t boot_id, char* out, size_t len) {
  JsonDocument doc;
  doc["uptime_s"] = uptime_s;
  doc["nodes_heard"] = nodes_heard;
  if (wifi_ssid != nullptr && wifi_ssid[0] != '\0') {
    doc["wifi_ssid"] = wifi_ssid;
    doc["wifi_rssi"] = wifi_rssi < -120 ? -120 : (wifi_rssi > 0 ? 0 : wifi_rssi);  // rentang validasi server
  }
  if (boot_reason != nullptr && boot_reason[0] != '\0') doc["boot_reason"] = boot_reason;
  if (boot_id != 0) doc["boot_id"] = boot_id;
  if (measureJson(doc) >= len) return 0;
  return serializeJson(doc, out, len);
}

bool parseValveCommand(const uint8_t* payload, size_t len, bool& open, uint32_t& until) {
  open = false;
  until = 0;
  if (len == 0) return true;  // retain dihapus server: tidak ada perintah, valve tutup
  JsonDocument doc;
  if (deserializeJson(doc, reinterpret_cast<const char*>(payload), len)) return false;
  const char* state = doc["state"];
  if (state == nullptr) return false;
  if (strcmp(state, "closed") == 0) return true;
  if (strcmp(state, "open") != 0) return false;
  // Perintah buka tanpa jam tutup ditolak: valve tidak boleh terbuka tanpa batas waktu.
  until = doc["until"].as<uint32_t>();
  open = until > 0;
  return open;
}

bool nodeIdFromValveTopic(const char* topic, char* out, size_t len) {
  static const char kPrefix[] = "lorafield/gw/";
  static const char kSuffix[] = "/valve/set";
  if (strncmp(topic, kPrefix, sizeof(kPrefix) - 1) != 0) return false;
  const char* node = strstr(topic + sizeof(kPrefix) - 1, "/node/");
  if (node == nullptr) return false;
  node += strlen("/node/");
  const char* end = strchr(node, '/');
  if (end == nullptr || end == node || strcmp(end, kSuffix) != 0) return false;
  size_t n = static_cast<size_t>(end - node);
  if (n >= len) return false;
  memcpy(out, node, n);
  out[n] = '\0';
  return true;
}

uint32_t remainingOpenSeconds(uint32_t until, uint32_t now) {
  if (until <= now) return 0;
  uint32_t remaining = until - now;
  return remaining < kMaxOpenSeconds ? remaining : kMaxOpenSeconds;
}

bool valveMismatch(bool desired_open, uint32_t until, uint32_t now, bool reported_open) {
  bool should_open = desired_open && remainingOpenSeconds(until, now) > 0;
  return should_open != reported_open;
}

float soilPercent(int raw, int adc_dry, int adc_wet) {
  if (adc_dry == adc_wet) return 0;
  float percent = (adc_dry - raw) * 100.0f / (adc_dry - adc_wet);
  return percent < 0 ? 0 : (percent > 100 ? 100 : percent);
}

int batteryPercent(float volts, float empty_v, float full_v) {
  float percent = (volts - empty_v) * 100.0f / (full_v - empty_v);
  return static_cast<int>(percent < 0 ? 0 : (percent > 100 ? 100 : lroundf(percent)));
}

// Rentang sama dengan validasi server. DS18B20 memberi -127 kalau sensor lepas.
bool validTemperature(float celsius) { return !isnan(celsius) && celsius >= -20 && celsius <= 80; }

bool validHumidity(float percent) { return !isnan(percent) && percent >= 0 && percent <= 100; }

int16_t tenths(float value) { return static_cast<int16_t>(lroundf(value * 10)); }

void ValveTimer::apply(bool open, uint32_t duration_s, uint32_t now_ms) {
  if (duration_s > kMaxOpenSeconds) duration_s = kMaxOpenSeconds;
  open_ = open && duration_s > 0;
  opened_at_ms_ = now_ms;
  duration_ms_ = duration_s * 1000;
}

void ValveTimer::tick(uint32_t now_ms) {
  // Selisih bertanda: tetap benar saat millis() kembali ke 0 (sekitar 49 hari), dan now yang diambil
  // sesaat sebelum perintah diterapkan (selisih -1) tidak terbaca sebagai waktu raksasa yang menutup valve.
  int32_t elapsed_ms = static_cast<int32_t>(now_ms - opened_at_ms_);
  if (open_ && elapsed_ms >= 0 && static_cast<uint32_t>(elapsed_ms) >= duration_ms_) open_ = false;
}

namespace {

struct SettingRule {
  const char* name;
  SettingKey key;
  size_t min_len;
  size_t max_len;
  const char* length_error;
};

constexpr SettingRule kSettingRules[] = {
    {"mqtt_host", SettingKey::MqttHost, 1, 63, "alamat server harus 1-63 karakter"},
    {"mqtt_port", SettingKey::MqttPort, 1, 5, "port harus angka 1-65535"},
    {"mqtt_pass", SettingKey::MqttPass, 8, 64, "password MQTT harus 8-64 karakter"},
    {"ap_pass", SettingKey::ApPass, 8, 63, "password hotspot harus 8-63 karakter"},  // batas WPA2
};

}  // namespace

const char* settingName(SettingKey key) {
  for (const SettingRule& rule : kSettingRules) {
    if (rule.key == key) return rule.name;
  }
  return "";
}

bool parseSetCommand(const char* line, SettingKey& key, char* value, size_t value_len, const char*& error) {
  error = "format: set <kunci> <nilai>";
  if (strncmp(line, "set ", 4) != 0) return false;
  const char* name = line + 4;
  const char* space = strchr(name, ' ');
  if (space == nullptr) return false;
  const SettingRule* rule = nullptr;
  for (const SettingRule& candidate : kSettingRules) {
    size_t name_len = static_cast<size_t>(space - name);
    if (strlen(candidate.name) == name_len && strncmp(candidate.name, name, name_len) == 0) rule = &candidate;
  }
  if (rule == nullptr) {
    error = "kunci tidak dikenal (mqtt_host, mqtt_port, mqtt_pass, ap_pass)";
    return false;
  }
  const char* text = space + 1;
  size_t len = strlen(text);
  error = rule->length_error;
  if (len < rule->min_len || len > rule->max_len || len >= value_len) return false;
  for (size_t i = 0; i < len; i++) {
    char c = text[i];
    if (c < 0x21 || c > 0x7E) {
      error = "nilai tidak boleh berisi spasi atau karakter khusus";
      return false;
    }
    bool host_char = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '.' || c == '-';
    if (rule->key == SettingKey::MqttHost && !host_char) {
      error = "alamat server hanya boleh huruf, angka, titik, dan tanda minus";
      return false;
    }
    if (rule->key == SettingKey::MqttPort && (c < '0' || c > '9')) return false;
  }
  if (rule->key == SettingKey::MqttPort && (atol(text) < 1 || atol(text) > 65535)) return false;
  memcpy(value, text, len + 1);
  key = rule->key;
  return true;
}

void portalName(const char* device_id, char* out, size_t len) {
  size_t id_len = strlen(device_id);
  snprintf(out, len, "LoraField-%s", id_len >= 4 ? device_id + id_len - 4 : device_id);
}

std::vector<ScannedNetwork> rankNetworks(const std::vector<ScannedNetwork>& scanned, size_t limit) {
  std::vector<ScannedNetwork> ranked;
  for (const ScannedNetwork& net : scanned) {
    if (net.ssid.empty()) continue;
    auto same = std::find_if(ranked.begin(), ranked.end(),
                             [&net](const ScannedNetwork& seen) { return seen.ssid == net.ssid; });
    if (same == ranked.end()) {
      ranked.push_back(net);
    } else if (net.rssi > same->rssi) {
      *same = net;
    }
  }
  std::stable_sort(ranked.begin(), ranked.end(),
                   [](const ScannedNetwork& a, const ScannedNetwork& b) { return a.rssi > b.rssi; });
  if (ranked.size() > limit) ranked.resize(limit);
  return ranked;
}

bool wifiNeedsRestore(const char* before_ssid, const char* before_pass, const char* now_ssid, const char* now_pass) {
  if (before_ssid[0] == '\0') return false;
  return strcmp(before_ssid, now_ssid) != 0 || strcmp(before_pass, now_pass) != 0;
}

bool statusLedOn(StatusLed state, uint32_t now_ms) {
  switch (state) {
    case StatusLed::Connected:
      return true;
    case StatusLed::ServerUnreachable: {
      uint32_t t = now_ms % 2000;
      return t < 150 || (t >= 300 && t < 450);
    }
    case StatusLed::WifiDown:
      return now_ms % 2000 < 1000;
    case StatusLed::Portal:
      return now_ms % 250 < 125;
    case StatusLed::Setup:
      return now_ms % 2000 < 100;
  }
  return false;
}

StatusLed runtimeStatusLed(bool wifi_connected, bool mqtt_connected) {
  if (!wifi_connected) return StatusLed::WifiDown;
  return mqtt_connected ? StatusLed::Connected : StatusLed::ServerUnreachable;
}

GatewayCommand parseGatewayCommand(const uint8_t* payload, size_t len) {
  JsonDocument doc;
  if (deserializeJson(doc, payload, len)) return GatewayCommand::Unknown;
  const char* action = doc["action"] | "";
  return strcmp(action, "wifi_portal") == 0 ? GatewayCommand::WifiPortal : GatewayCommand::Unknown;
}

// Selisih tanpa tanda di bawah tetap benar saat millis() kembali ke 0.
WifiRecovery::Action WifiRecovery::update(bool connected, uint32_t now_ms) {
  switch (state_) {
    case State::Connected:
      if (connected) return Action::None;
      state_ = State::Trying;
      phase_start_ms_ = now_ms;
      last_retry_ms_ = now_ms;  // percobaan pertama dilakukan otomatis oleh driver WiFi
      return Action::Lost;
    case State::Trying:
      if (connected) {
        state_ = State::Connected;
        return Action::None;
      }
      if (now_ms - phase_start_ms_ >= window_ms_) {
        state_ = State::Resting;
        phase_start_ms_ = now_ms;
        return Action::RadioOff;
      }
      if (now_ms - last_retry_ms_ >= retry_every_ms_) {
        last_retry_ms_ = now_ms;
        return Action::Reconnect;
      }
      return Action::None;
    case State::Resting:
      if (now_ms - phase_start_ms_ < rest_ms_) return Action::None;
      state_ = State::Trying;
      phase_start_ms_ = now_ms;
      last_retry_ms_ = now_ms;
      return Action::RadioOn;
  }
  return Action::None;
}

}  // namespace lorafield
