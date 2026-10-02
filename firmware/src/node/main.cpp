// Firmware node sensor LoraField: baca sensor, kirim lewat LoRa ke gateway, jalankan perintah valve.
#include <Arduino.h>
#include <DHT.h>
#include <DallasTemperature.h>
#include <LoRa.h>
#include <OneWire.h>
#include <esp_mac.h>
#include <esp_random.h>
#include <lorafield.h>

#include "config.h"
#include "lora_radio.h"

using namespace lorafield;

namespace {

uint8_t node_mac[6];
char node_id[16];
DHT dht(DHT22_PIN, DHT22);
OneWire one_wire(DS18B20_PIN);
DallasTemperature soil_thermometer(&one_wire);
ValveTimer valve;
unsigned long next_send_ms = 0;
// Bacaan valid terakhir: sensor yang gagal dibaca mengirim bacaan valid terakhirnya.
float last_soil_temp = NAN;
float last_air_temp = NAN;
float last_air_humidity = NAN;

void driveValve() { digitalWrite(VALVE_PIN, valve.isOpen() ? VALVE_ACTIVE_LEVEL : !VALVE_ACTIVE_LEVEL); }

void listenForCommand() {
  int size = LoRa.parsePacket();
  if (size <= 0) return;
  uint8_t packet[32];
  size_t len = 0;
  while (LoRa.available() && len < sizeof packet) packet[len++] = LoRa.read();
  ValveCommand command;
  if (!decodeValve(packet, len, command) || memcmp(command.node_mac, node_mac, 6) != 0) return;
  valve.apply(command.open, command.duration_s, millis());
  driveValve();
  Serial.printf("Perintah valve: %s (%lu detik)\n", valve.isOpen() ? "buka" : "tutup",
                (unsigned long)command.duration_s);
}

int readSoilRaw() {
  long sum = 0;
  for (int i = 0; i < SOIL_SAMPLES; i++) sum += analogRead(SOIL_PIN);
  return sum / SOIL_SAMPLES;
}

bool readSensors(Reading& reading) {
  soil_thermometer.requestTemperatures();
  float soil_temp = soil_thermometer.getTempCByIndex(0);
  if (validTemperature(soil_temp)) last_soil_temp = soil_temp;
  float air_temp = dht.readTemperature();
  float air_humidity = dht.readHumidity();
  if (validTemperature(air_temp) && validHumidity(air_humidity)) {
    last_air_temp = air_temp;
    last_air_humidity = air_humidity;
  }
  // Server menolak reading tanpa suhu, jadi jangan kirim sebelum ada bacaan valid pertama.
  if (isnan(last_soil_temp) || isnan(last_air_temp)) {
    Serial.println("DS18B20 atau DHT22 belum pernah terbaca valid, data tidak dikirim");
    return false;
  }

  memcpy(reading.node_mac, node_mac, 6);
  reading.soil_moisture_x10 = tenths(soilPercent(readSoilRaw(), SOIL_ADC_DRY, SOIL_ADC_WET));
  reading.soil_temp_x10 = tenths(last_soil_temp);
  reading.air_temp_x10 = tenths(last_air_temp);
  reading.air_humidity_x10 = tenths(last_air_humidity);
  float volts = analogReadMilliVolts(BATTERY_PIN) * BATTERY_DIVIDER / 1000.0f;
  reading.battery = static_cast<int8_t>(batteryPercent(volts, BATTERY_EMPTY_V, BATTERY_FULL_V));
  reading.valve_open = valve.isOpen();
  return true;
}

void sendReading() {
  Reading reading;
  if (!readSensors(reading)) return;
  uint8_t packet[kReadingPacketSize];
  LoRa.beginPacket();
  LoRa.write(packet, encodeReading(reading, packet, sizeof packet));
  LoRa.endPacket();
  Serial.printf("Terkirim: tanah %.1f%%, valve %s, baterai %d%%\n", reading.soil_moisture_x10 / 10.0,
                reading.valve_open ? "buka" : "tutup", reading.battery);
}

}  // namespace

void setup() {
  Serial.begin(115200);
  esp_read_mac(node_mac, ESP_MAC_WIFI_STA);
  deviceId("ND", node_mac, node_id, sizeof node_id);
  Serial.printf("\nLoraField node %s, firmware %s\n", node_id, FIRMWARE_VERSION);

  pinMode(VALVE_PIN, OUTPUT);
  driveValve();  // valve tertutup saat menyala
  analogReadResolution(12);
  dht.begin();
  soil_thermometer.begin();

  startLoRaRadio();
}

void loop() {
  unsigned long now = millis();
  // Di antara kiriman, radio selalu mendengarkan perintah valve dari gateway.
  listenForCommand();
  valve.tick(now);
  driveValve();

  if ((long)(now - next_send_ms) >= 0) {
    sendReading();
    next_send_ms = now + NODE_SEND_INTERVAL_MS + esp_random() % NODE_SEND_JITTER_MS;
  }
}
