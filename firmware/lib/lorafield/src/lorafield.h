// Logika bersama gateway dan node LoraField, tanpa Arduino supaya bisa dites di PC (pio test -e native).
// Paket LoRa antara node dan gateway ditentukan di sini; format MQTT ikut docs/kontrak-mqtt.md.
#pragma once

#include <stddef.h>
#include <stdint.h>

#include <string>
#include <vector>

namespace lorafield {

// Batas aman lama valve terbuka per perintah, walau server minta lebih lama.
constexpr uint32_t kMaxOpenSeconds = 3600;

constexpr size_t kReadingPacketSize = 18;
constexpr size_t kValvePacketSize = 13;

// Isi paket data sensor node ke gateway. Angka disimpan sepersepuluh (54.2% = 542).
struct Reading {
  uint8_t node_mac[6];
  int16_t soil_moisture_x10;
  int16_t soil_temp_x10;
  int16_t air_temp_x10;
  int16_t air_humidity_x10;
  int8_t battery;  // persen, -1 = tidak diketahui
  bool valve_open;
};

// Isi paket perintah valve gateway ke node. Node tidak punya jam, jadi yang dikirim sisa detik.
struct ValveCommand {
  uint8_t node_mac[6];
  bool open;
  uint32_t duration_s;
};

size_t encodeReading(const Reading& reading, uint8_t* buf, size_t len);
bool decodeReading(const uint8_t* buf, size_t len, Reading& out);
size_t encodeValve(const ValveCommand& command, uint8_t* buf, size_t len);
bool decodeValve(const uint8_t* buf, size_t len, ValveCommand& out);

// ID perangkat dari MAC ESP32, mis. "ND-A1B2C3D4E5F6". Prefix wajib 2 huruf.
void deviceId(const char* prefix, const uint8_t mac[6], char* out, size_t len);
bool macFromDeviceId(const char* id, uint8_t mac[6]);

// Pesan MQTT sesuai kontrak. Kembalikan panjang JSON, 0 kalau buffer kurang.
size_t readingJson(const Reading& reading, int rssi, char* out, size_t len);
// Penyebab gateway menyala. Angka sama dengan esp_reset_reason_t ESP-IDF 4.4 (main.cpp memastikannya
// dengan static_assert), supaya logikanya bisa dites di PC tanpa header ESP-IDF.
enum class ResetReason : int {
  Unknown = 0,
  PowerOn = 1,
  External = 2,
  Software = 3,
  Panic = 4,
  InterruptWatchdog = 5,
  TaskWatchdog = 6,
  OtherWatchdog = 7,
  DeepSleep = 8,
  Brownout = 9,
  Sdio = 10,
};
// Kode boot_reason di heartbeat (docs/kontrak-mqtt.md): power_on (listrik padam atau tombol RST, ESP32 tidak
// bisa membedakannya), brownout, watchdog, crash, planned (restart dari firmware sendiri, mis. Ganti WiFi),
// firmware_update (versi firmware berbeda dari saat menyala sebelumnya, menang atas penyebab lain), other.
const char* bootReasonCode(ResetReason reason, bool firmware_changed);

// Isi heartbeat: uptime, node terdengar, WiFi yang dipakai gateway (nama dan kekuatan sinyal dBm, dijepit
// -120 sampai 0), penyebab gateway menyala, dan nomor nyala (acak, baru setiap gateway menyala). Nama WiFi
// kosong: kedua field WiFi tidak dikirim; boot_reason null atau kosong dan boot_id 0: tidak dikirim. Nama
// di-escape ArduinoJson, jadi boleh berisi tanda kutip. Kembalikan panjang JSON, 0 kalau buffer kurang.
size_t heartbeatJson(uint64_t uptime_s, int nodes_heard, const char* wifi_ssid, int wifi_rssi,
                     const char* boot_reason, uint32_t boot_id, char* out, size_t len);
// Isi valve/set. Isi kosong = tutup. false kalau rusak (perintah diabaikan).
bool parseValveCommand(const uint8_t* payload, size_t len, bool& open, uint32_t& until);
// "lorafield/gw/{gw}/node/{node}/valve/set" -> {node}.
bool nodeIdFromValveTopic(const char* topic, char* out, size_t len);

// Sisa detik valve boleh terbuka dari jam tutup mutlak (epoch). 0 kalau sudah lewat.
uint32_t remainingOpenSeconds(uint32_t until, uint32_t now);
// Posisi valve yang dilaporkan node belum sama dengan perintah: gateway kirim ulang.
bool valveMismatch(bool desired_open, uint32_t until, uint32_t now, bool reported_open);

float soilPercent(int raw, int adc_dry, int adc_wet);
int batteryPercent(float volts, float empty_v, float full_v);
bool validTemperature(float celsius);
bool validHumidity(float percent);
int16_t tenths(float value);

// Pengatur waktu valve di node: menutup sendiri saat durasi habis, walau perintah tutup tidak sampai.
class ValveTimer {
 public:
  void apply(bool open, uint32_t duration_s, uint32_t now_ms);
  void tick(uint32_t now_ms);
  bool isOpen() const { return open_; }

 private:
  bool open_ = false;
  uint32_t opened_at_ms_ = 0;
  uint32_t duration_ms_ = 0;
};

// Pengaturan gateway yang disimpan di memori alat, diisi lewat Serial saat produksi: "set <kunci> <nilai>".
enum class SettingKey { MqttHost, MqttPort, MqttPass, ApPass };
const char* settingName(SettingKey key);
// Baca "set <kunci> <nilai>". Nilai yang tidak sah ditolak, alasannya lewat `error`.
bool parseSetCommand(const char* line, SettingKey& key, char* value, size_t value_len, const char*& error);
// Nama hotspot portal WiFi dari ID gateway: "GW-F024F9925898" -> "LoraField-5898" (sama dengan stiker).
void portalName(const char* device_id, char* out, size_t len);

// Hasil pindai WiFi untuk daftar di portal: satu baris per nama WiFi (sinyal terkuat), terkuat di atas,
// nama kosong (jaringan tersembunyi) dilewati, maksimal `limit` baris.
struct ScannedNetwork {
  std::string ssid;
  int rssi;
  bool secure;
};
std::vector<ScannedNetwork> rankNetworks(const std::vector<ScannedNetwork>& scanned, size_t limit);

// WiFiManager langsung menyimpan WiFi yang diketik di portal walau gagal tersambung (uji alat 2026-10-02:
// password salah lalu portal ditinggal = WiFi lama hilang). Saat portal ditutup tanpa tersambung, WiFi
// tersimpan sebelum portal dipasang lagi kalau berbeda. Alat tanpa WiFi lama: tidak ada yang dipulihkan.
bool wifiNeedsRestore(const char* before_ssid, const char* before_pass, const char* now_ssid, const char* now_pass);

// Lampu status gateway (LED hijau bawaan, docs/rencana-produk.md F3). Bentuk kedip berbeda tiap keadaan
// supaya mudah dibedakan orang awam:
//   Connected          menyala terus
//   ServerUnreachable  kedip ganda lalu jeda, tiap 2 detik (WiFi tersambung, server belum)
//   WifiDown           kedip lambat: 1 detik nyala, 1 detik mati
//   Portal             kedip cepat, 4 kali per detik
//   Setup              kedip singkat tiap 2 detik (mode pengaturan, alat belum diisi pabrik)
enum class StatusLed { Connected, ServerUnreachable, WifiDown, Portal, Setup };
// Nyala atau mati pada waktu now_ms. Dipanggil pewaktu berkala, terpisah dari loop().
bool statusLedOn(StatusLed state, uint32_t now_ms);
// Keadaan lampu saat gateway berjalan. WiFi dicek dulu: sambungan MQTT bisa masih terbaca tersambung
// beberapa saat setelah WiFi putus.
StatusLed runtimeStatusLed(bool wifi_connected, bool mqtt_connected);

// Perintah server ke gateway, topik lorafield/gw/{gw}/cmd (docs/kontrak-mqtt.md).
enum class GatewayCommand { Unknown, WifiPortal };
GatewayCommand parseGatewayCommand(const uint8_t* payload, size_t len);

// Jadwal pemulihan WiFi saat gateway sudah berjalan: begitu putus, coba sambung ulang tiap
// retry_every_ms selama window_ms; kalau tetap gagal, radio WiFi istirahat rest_ms (hemat daya), lalu
// coba lagi, bergantian, sampai tersambung. update() dipanggil tiap putaran loop.
class WifiRecovery {
 public:
  enum class Action { None, Lost, Reconnect, RadioOff, RadioOn };
  WifiRecovery(uint32_t window_ms, uint32_t retry_every_ms, uint32_t rest_ms)
      : window_ms_(window_ms), retry_every_ms_(retry_every_ms), rest_ms_(rest_ms) {}
  Action update(bool connected, uint32_t now_ms);

 private:
  enum class State { Connected, Trying, Resting };
  uint32_t window_ms_;
  uint32_t retry_every_ms_;
  uint32_t rest_ms_;
  State state_ = State::Connected;
  uint32_t phase_start_ms_ = 0;
  uint32_t last_retry_ms_ = 0;
};

}  // namespace lorafield
