// Logika bersama gateway dan node LoraField, tanpa Arduino supaya bisa dites di PC (pio test -e native).
// Paket LoRa antara node dan gateway ditentukan di sini; format MQTT ikut docs/kontrak-mqtt.md.
#pragma once

#include <stddef.h>
#include <stdint.h>

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

}  // namespace lorafield
