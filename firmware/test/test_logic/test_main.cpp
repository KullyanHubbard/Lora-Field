// Tes logika firmware di PC, tanpa alat: pio test -e native
#include <lorafield.h>
#include <string.h>
#include <unity.h>

using namespace lorafield;

static const uint8_t kMac[6] = {0xA1, 0xB2, 0xC3, 0xD4, 0xE5, 0xF6};

static Reading sampleReading() {
  Reading r;
  memcpy(r.node_mac, kMac, 6);
  r.soil_moisture_x10 = 542;
  r.soil_temp_x10 = 271;
  r.air_temp_x10 = -15;
  r.air_humidity_x10 = 710;
  r.battery = 86;
  r.valve_open = false;
  return r;
}

void setUp() {}
void tearDown() {}

void test_reading_packet_round_trip() {
  uint8_t buf[32];
  Reading in = sampleReading(), out;
  size_t n = encodeReading(in, buf, sizeof buf);
  TEST_ASSERT_EQUAL(kReadingPacketSize, n);
  TEST_ASSERT_TRUE(decodeReading(buf, n, out));
  TEST_ASSERT_EQUAL_UINT8_ARRAY(kMac, out.node_mac, 6);
  TEST_ASSERT_EQUAL(542, out.soil_moisture_x10);
  TEST_ASSERT_EQUAL(-15, out.air_temp_x10);
  TEST_ASSERT_EQUAL(86, out.battery);
  TEST_ASSERT_FALSE(out.valve_open);

  in.battery = -1;
  encodeReading(in, buf, sizeof buf);
  decodeReading(buf, n, out);
  TEST_ASSERT_EQUAL(-1, out.battery);
}

void test_packet_rejects_foreign_or_short() {
  uint8_t buf[32];
  Reading r = sampleReading(), out;
  size_t n = encodeReading(r, buf, sizeof buf);
  TEST_ASSERT_FALSE(decodeReading(buf, n - 1, out));
  buf[0] = 0x00;
  TEST_ASSERT_FALSE(decodeReading(buf, n, out));
  TEST_ASSERT_EQUAL(0, encodeReading(r, buf, kReadingPacketSize - 1));

  ValveCommand cmd;
  n = encodeReading(sampleReading(), buf, sizeof buf);
  TEST_ASSERT_FALSE(decodeValve(buf, n, cmd));  // paket reading bukan perintah valve
}

void test_valve_packet_round_trip() {
  uint8_t buf[16];
  ValveCommand in, out;
  memcpy(in.node_mac, kMac, 6);
  in.open = true;
  in.duration_s = 1800;
  size_t n = encodeValve(in, buf, sizeof buf);
  TEST_ASSERT_EQUAL(kValvePacketSize, n);
  TEST_ASSERT_TRUE(decodeValve(buf, n, out));
  TEST_ASSERT_TRUE(out.open);
  TEST_ASSERT_EQUAL_UINT32(1800, out.duration_s);
  TEST_ASSERT_EQUAL_UINT8_ARRAY(kMac, out.node_mac, 6);
}

void test_device_id() {
  char id[20];
  deviceId("ND", kMac, id, sizeof id);
  TEST_ASSERT_EQUAL_STRING("ND-A1B2C3D4E5F6", id);
  uint8_t mac[6];
  TEST_ASSERT_TRUE(macFromDeviceId(id, mac));
  TEST_ASSERT_EQUAL_UINT8_ARRAY(kMac, mac, 6);
  TEST_ASSERT_FALSE(macFromDeviceId("SIM-7585bd-N1", mac));
  TEST_ASSERT_FALSE(macFromDeviceId("ND-A1B2C3D4E5FZ", mac));
}

void test_reading_json_matches_contract() {
  char json[256];
  Reading r = sampleReading();
  TEST_ASSERT_TRUE(readingJson(r, -92, json, sizeof json) > 0);
  TEST_ASSERT_EQUAL_STRING(
      "{\"soil_moisture\":54.2,\"soil_temp\":27.1,\"air_temp\":-1.5,\"air_humidity\":71,"
      "\"battery\":86,\"rssi\":-92,\"valve\":\"closed\"}",
      json);

  r.battery = -1;
  r.valve_open = true;
  readingJson(r, -110, json, sizeof json);
  TEST_ASSERT_NULL(strstr(json, "battery"));
  TEST_ASSERT_NOT_NULL(strstr(json, "\"valve\":\"open\""));

  TEST_ASSERT_EQUAL(0, readingJson(r, -110, json, 20));  // buffer kurang

  // RSSI di luar rentang server dibatasi, supaya reading tidak ditolak seluruhnya.
  readingJson(r, 5, json, sizeof json);
  TEST_ASSERT_NOT_NULL(strstr(json, "\"rssi\":0,"));
  readingJson(r, -160, json, sizeof json);
  TEST_ASSERT_NOT_NULL(strstr(json, "\"rssi\":-150,"));
}

static bool parse(const char* text, bool& open, uint32_t& until) {
  return parseValveCommand(reinterpret_cast<const uint8_t*>(text), strlen(text), open, until);
}

void test_parse_valve_command() {
  bool open;
  uint32_t until;
  TEST_ASSERT_TRUE(parse("{\"state\":\"open\",\"until\":1790003600}", open, until));
  TEST_ASSERT_TRUE(open);
  TEST_ASSERT_EQUAL_UINT32(1790003600u, until);

  TEST_ASSERT_TRUE(parse("{\"state\":\"closed\"}", open, until));
  TEST_ASSERT_FALSE(open);

  TEST_ASSERT_TRUE(parse("", open, until));  // retain dihapus = tutup
  TEST_ASSERT_FALSE(open);

  TEST_ASSERT_FALSE(parse("{\"state\":\"open\"}", open, until));  // buka tanpa batas waktu ditolak
  TEST_ASSERT_FALSE(open);
  TEST_ASSERT_FALSE(parse("bukan json", open, until));
  TEST_ASSERT_FALSE(parse("{\"state\":\"setengah\"}", open, until));
}

void test_node_id_from_topic() {
  char node[33];
  TEST_ASSERT_TRUE(nodeIdFromValveTopic("lorafield/gw/GW-0011/node/ND-A1B2C3D4E5F6/valve/set", node, sizeof node));
  TEST_ASSERT_EQUAL_STRING("ND-A1B2C3D4E5F6", node);
  TEST_ASSERT_FALSE(nodeIdFromValveTopic("lorafield/gw/GW-0011/node/ND-1/reading", node, sizeof node));
  TEST_ASSERT_FALSE(nodeIdFromValveTopic("lain/gw/GW-0011/node/ND-1/valve/set", node, sizeof node));
  TEST_ASSERT_FALSE(nodeIdFromValveTopic("lorafield/gw/GW-0011/node//valve/set", node, sizeof node));
  TEST_ASSERT_FALSE(nodeIdFromValveTopic("lorafield/gw/GW-0011/node/ND-A1B2C3D4E5F6/valve/set", node, 5));
}

void test_remaining_and_mismatch() {
  TEST_ASSERT_EQUAL_UINT32(600, remainingOpenSeconds(1000600, 1000000));
  TEST_ASSERT_EQUAL_UINT32(0, remainingOpenSeconds(1000000, 1000600));
  TEST_ASSERT_EQUAL_UINT32(kMaxOpenSeconds, remainingOpenSeconds(9000000, 1000000));

  TEST_ASSERT_TRUE(valveMismatch(true, 1000600, 1000000, false));
  TEST_ASSERT_FALSE(valveMismatch(true, 1000600, 1000000, true));
  TEST_ASSERT_FALSE(valveMismatch(true, 1000000, 1000600, false));  // perintah buka sudah lewat
  TEST_ASSERT_TRUE(valveMismatch(false, 0, 1000000, true));
}

void test_sensor_conversions() {
  TEST_ASSERT_EQUAL_FLOAT(0, soilPercent(3200, 3200, 1300));
  TEST_ASSERT_EQUAL_FLOAT(100, soilPercent(1300, 3200, 1300));
  TEST_ASSERT_EQUAL_FLOAT(50, soilPercent(2250, 3200, 1300));
  TEST_ASSERT_EQUAL_FLOAT(0, soilPercent(4095, 3200, 1300));
  TEST_ASSERT_EQUAL_FLOAT(100, soilPercent(900, 3200, 1300));
  TEST_ASSERT_EQUAL_FLOAT(0, soilPercent(2000, 1500, 1500));

  TEST_ASSERT_EQUAL(0, batteryPercent(3.1f, 3.3f, 4.2f));
  TEST_ASSERT_EQUAL(50, batteryPercent(3.75f, 3.3f, 4.2f));
  TEST_ASSERT_EQUAL(100, batteryPercent(4.3f, 3.3f, 4.2f));

  TEST_ASSERT_FALSE(validTemperature(-127));
  TEST_ASSERT_FALSE(validTemperature(0.0f / 0.0f));
  TEST_ASSERT_TRUE(validTemperature(27.5f));
  TEST_ASSERT_FALSE(validHumidity(101));
  TEST_ASSERT_EQUAL(542, tenths(54.249f));
  TEST_ASSERT_EQUAL(-15, tenths(-1.5f));
}

void test_valve_timer_closes_itself() {
  ValveTimer valve;
  valve.apply(true, 600, 1000);
  valve.tick(1000 + 599999);
  TEST_ASSERT_TRUE(valve.isOpen());
  valve.tick(1000 + 600000);
  TEST_ASSERT_FALSE(valve.isOpen());

  // millis() kembali ke 0 saat valve terbuka.
  valve.apply(true, 60, 0xFFFFFFFFu - 10000);
  valve.tick(20000);
  TEST_ASSERT_TRUE(valve.isOpen());
  valve.tick(50000);
  TEST_ASSERT_FALSE(valve.isOpen());

  valve.apply(true, 999999, 0);  // dibatasi kMaxOpenSeconds
  valve.tick(kMaxOpenSeconds * 1000);
  TEST_ASSERT_FALSE(valve.isOpen());

  valve.apply(true, 600, 0);
  valve.apply(false, 0, 1);
  TEST_ASSERT_FALSE(valve.isOpen());

  // Urutan loop() node: now diambil dulu, perintah diterapkan dengan millis() yang sudah maju.
  valve.apply(true, 600, 1001);
  valve.tick(1000);
  TEST_ASSERT_TRUE(valve.isOpen());
}

void test_parse_set_command() {
  SettingKey key;
  char value[65];
  const char* error = nullptr;

  TEST_ASSERT_TRUE(parseSetCommand("set mqtt_host 192.168.1.4", key, value, sizeof value, error));
  TEST_ASSERT_TRUE(key == SettingKey::MqttHost);
  TEST_ASSERT_EQUAL_STRING("192.168.1.4", value);
  TEST_ASSERT_TRUE(parseSetCommand("set mqtt_host mqtt.lorafield.id", key, value, sizeof value, error));
  TEST_ASSERT_TRUE(parseSetCommand("set mqtt_port 8883", key, value, sizeof value, error));
  TEST_ASSERT_TRUE(key == SettingKey::MqttPort);
  TEST_ASSERT_TRUE(parseSetCommand("set mqtt_pass Rahasia#2026!", key, value, sizeof value, error));
  TEST_ASSERT_TRUE(key == SettingKey::MqttPass);
  TEST_ASSERT_TRUE(parseSetCommand("set ap_pass 12345678", key, value, sizeof value, error));
  TEST_ASSERT_TRUE(key == SettingKey::ApPass);
  TEST_ASSERT_EQUAL_STRING("ap_pass", settingName(SettingKey::ApPass));

  // Batas WPA2 untuk password hotspot: 8-63 karakter.
  TEST_ASSERT_FALSE(parseSetCommand("set ap_pass 1234567", key, value, sizeof value, error));
  TEST_ASSERT_FALSE(parseSetCommand(
      "set ap_pass 1234567890123456789012345678901234567890123456789012345678901234", key, value,
      sizeof value, error));
  TEST_ASSERT_FALSE(parseSetCommand("set mqtt_pass pendek", key, value, sizeof value, error));
  TEST_ASSERT_FALSE(parseSetCommand("set mqtt_pass dua kata panjang", key, value, sizeof value, error));
  TEST_ASSERT_FALSE(parseSetCommand("set mqtt_host 192.168.1.4/x", key, value, sizeof value, error));
  TEST_ASSERT_FALSE(parseSetCommand("set mqtt_port 0", key, value, sizeof value, error));
  TEST_ASSERT_FALSE(parseSetCommand("set mqtt_port 70000", key, value, sizeof value, error));
  TEST_ASSERT_FALSE(parseSetCommand("set mqtt_port 18a3", key, value, sizeof value, error));
  TEST_ASSERT_FALSE(parseSetCommand("set wifi_pass 12345678", key, value, sizeof value, error));
  TEST_ASSERT_FALSE(parseSetCommand("set mqtt_host", key, value, sizeof value, error));
  TEST_ASSERT_FALSE(parseSetCommand("show", key, value, sizeof value, error));
  TEST_ASSERT_NOT_NULL(error);

  char small[8];  // nilai lebih panjang dari buffer ditolak, bukan dipotong
  TEST_ASSERT_FALSE(parseSetCommand("set ap_pass 12345678", key, small, sizeof small, error));
}

void test_portal_name() {
  char name[24];
  portalName("GW-F024F9925898", name, sizeof name);
  TEST_ASSERT_EQUAL_STRING("LoraField-5898", name);
}

void test_rank_networks() {
  std::vector<ScannedNetwork> scanned = {
      {"Rumah", -70, true},  {"", -40, true},       {"Kebun", -50, false},
      {"Rumah", -55, true},  {"Tetangga", -80, true}, {"Masjid", -85, true},
  };
  std::vector<ScannedNetwork> ranked = rankNetworks(scanned, 3);
  TEST_ASSERT_EQUAL(3, ranked.size());  // nama kosong dilewati, nama ganda digabung, dipotong ke 3
  TEST_ASSERT_EQUAL_STRING("Kebun", ranked[0].ssid.c_str());
  TEST_ASSERT_FALSE(ranked[0].secure);
  TEST_ASSERT_EQUAL_STRING("Rumah", ranked[1].ssid.c_str());
  TEST_ASSERT_EQUAL(-55, ranked[1].rssi);  // sinyal terkuat dari dua titik akses bernama sama
  TEST_ASSERT_EQUAL_STRING("Tetangga", ranked[2].ssid.c_str());
  TEST_ASSERT_EQUAL(0, rankNetworks({}, 20).size());
}

void test_parse_gateway_command() {
  const char* portal = "{\"action\":\"wifi_portal\"}";
  TEST_ASSERT_TRUE(parseGatewayCommand(reinterpret_cast<const uint8_t*>(portal), strlen(portal)) ==
                   GatewayCommand::WifiPortal);
  const char* other = "{\"action\":\"reboot\"}";
  TEST_ASSERT_TRUE(parseGatewayCommand(reinterpret_cast<const uint8_t*>(other), strlen(other)) ==
                   GatewayCommand::Unknown);
  const char* broken = "wifi_portal";
  TEST_ASSERT_TRUE(parseGatewayCommand(reinterpret_cast<const uint8_t*>(broken), strlen(broken)) ==
                   GatewayCommand::Unknown);
  TEST_ASSERT_TRUE(parseGatewayCommand(nullptr, 0) == GatewayCommand::Unknown);
}

void test_wifi_recovery() {
  using Action = WifiRecovery::Action;
  const uint32_t minute = 60000;
  WifiRecovery wifi(10 * minute, 30000, 30 * minute);
  TEST_ASSERT_TRUE(wifi.update(true, 0) == Action::None);

  // Putus: dicatat sekali, lalu sambung ulang dipaksa tiap 30 detik.
  TEST_ASSERT_TRUE(wifi.update(false, 1000) == Action::Lost);
  TEST_ASSERT_TRUE(wifi.update(false, 30999) == Action::None);
  TEST_ASSERT_TRUE(wifi.update(false, 31000) == Action::Reconnect);
  TEST_ASSERT_TRUE(wifi.update(false, 31500) == Action::None);
  TEST_ASSERT_TRUE(wifi.update(false, 61000) == Action::Reconnect);

  // 10 menit tetap putus: radio istirahat 30 menit, tanpa percobaan selama istirahat.
  TEST_ASSERT_TRUE(wifi.update(false, 1000 + 10 * minute) == Action::RadioOff);
  TEST_ASSERT_TRUE(wifi.update(false, 1000 + 25 * minute) == Action::None);
  TEST_ASSERT_TRUE(wifi.update(false, 1000 + 40 * minute - 1) == Action::None);
  TEST_ASSERT_TRUE(wifi.update(false, 1000 + 40 * minute) == Action::RadioOn);

  // Tersambung di jendela berikutnya: kembali normal, tidak ada aksi lagi.
  TEST_ASSERT_TRUE(wifi.update(false, 1000 + 40 * minute + 30000) == Action::Reconnect);
  TEST_ASSERT_TRUE(wifi.update(true, 1000 + 41 * minute) == Action::None);
  TEST_ASSERT_TRUE(wifi.update(true, 1000 + 80 * minute) == Action::None);

  // Putus lagi: jendela 10 menit dihitung dari awal.
  TEST_ASSERT_TRUE(wifi.update(false, 100 * minute) == Action::Lost);
  TEST_ASSERT_TRUE(wifi.update(false, 109 * minute) != Action::RadioOff);
  TEST_ASSERT_TRUE(wifi.update(false, 110 * minute) == Action::RadioOff);

  WifiRecovery wrap(10 * minute, 30000, 30 * minute);  // millis() kembali ke 0 saat putus
  wrap.update(false, 0xFFFFFFFFu - 1000);
  TEST_ASSERT_TRUE(wrap.update(false, 29000) == Action::Reconnect);
}

void test_wifi_needs_restore() {
  // Password salah diketik di portal lalu portal ditinggal: WiFi lama dipasang lagi.
  TEST_ASSERT_TRUE(wifiNeedsRestore("Rumah", "benar123", "Rumah", "salah123"));
  // WiFi lain dipilih di portal tapi gagal: WiFi lama dipasang lagi.
  TEST_ASSERT_TRUE(wifiNeedsRestore("Rumah", "benar123", "Tetangga", "abc12345"));
  // Portal ditinggal tanpa mengetik apa pun: tidak ada yang ditulis ulang ke memori.
  TEST_ASSERT_FALSE(wifiNeedsRestore("Rumah", "benar123", "Rumah", "benar123"));
  // Alat baru tanpa WiFi lama: WiFi yang diketik dibiarkan.
  TEST_ASSERT_FALSE(wifiNeedsRestore("", "", "Rumah", "salah123"));
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_reading_packet_round_trip);
  RUN_TEST(test_packet_rejects_foreign_or_short);
  RUN_TEST(test_valve_packet_round_trip);
  RUN_TEST(test_device_id);
  RUN_TEST(test_reading_json_matches_contract);
  RUN_TEST(test_parse_valve_command);
  RUN_TEST(test_node_id_from_topic);
  RUN_TEST(test_remaining_and_mismatch);
  RUN_TEST(test_sensor_conversions);
  RUN_TEST(test_valve_timer_closes_itself);
  RUN_TEST(test_parse_set_command);
  RUN_TEST(test_portal_name);
  RUN_TEST(test_rank_networks);
  RUN_TEST(test_parse_gateway_command);
  RUN_TEST(test_wifi_recovery);
  RUN_TEST(test_wifi_needs_restore);
  return UNITY_END();
}
