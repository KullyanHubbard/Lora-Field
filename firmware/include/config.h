// Pengaturan perangkat keras. Semua pin dan angka kalibrasi di sini BELUM diverifikasi dengan alat:
// sesuaikan dengan wiring dan hasil kalibrasi tim IoT sebelum di-flash.
#pragma once

#define FIRMWARE_VERSION "0.1.0"

// Radio LoRa, board LilyGO T3 v1.6.1 (PlatformIO: ttgo-lora32-v21). Versi board lain beda pin.
#define LORA_SCK 5
#define LORA_MISO 19
#define LORA_MOSI 27
#define LORA_SS 18
#define LORA_RST 23
#define LORA_DIO0 26
// Pita AS923 Indonesia: 920–923 MHz. Gateway dan node wajib sama persis.
#define LORA_FREQUENCY 922E6
#define LORA_SPREADING_FACTOR 9
#define LORA_SYNC_WORD 0x4C

// Node: pin sensor dan relay valve.
#define SOIL_PIN 34          // Capacitive Soil Moisture Sensor, ADC1 (ADC2 tidak bisa dipakai bersama radio)
#define DS18B20_PIN 14       // suhu tanah, butuh resistor pull-up 4.7k
#define DHT22_PIN 4          // suhu dan kelembapan udara
#define VALVE_PIN 13         // relay solenoid valve
#define VALVE_ACTIVE_LEVEL HIGH  // banyak modul relay aktif LOW, ganti kalau begitu
#define BATTERY_PIN 35       // pembagi tegangan baterai bawaan board

// Kalibrasi soil moisture: angka ADC mentah saat sensor di udara kering dan di air. Beda tiap sensor.
#define SOIL_ADC_DRY 3200
#define SOIL_ADC_WET 1300
#define SOIL_SAMPLES 16

// Baterai Li-ion 1 sel. Pembagi tegangan board membagi 2.
#define BATTERY_DIVIDER 2.0f
#define BATTERY_EMPTY_V 3.3f
#define BATTERY_FULL_V 4.2f

// Node kirim data tiap interval ini, ditambah jeda acak supaya node tidak bertabrakan.
// Harus di bawah 15 menit (batas offline server).
#define NODE_SEND_INTERVAL_MS 60000UL
#define NODE_SEND_JITTER_MS 5000UL

// Gateway.
#define GATEWAY_HEARTBEAT_MS 300000UL
#define GATEWAY_MAX_NODES 16
#define MQTT_RETRY_MS 5000UL
