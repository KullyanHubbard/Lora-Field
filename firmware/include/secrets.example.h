// Salin jadi secrets.h (tidak ikut git) lalu isi. Dipakai gateway saja, node tidak memakai WiFi.
#pragma once

#define WIFI_SSID "nama-wifi"
#define WIFI_PASSWORD "password-wifi"

// Alamat komputer yang menjalankan Mosquitto, bukan 127.0.0.1 (itu alamat gateway sendiri).
#define MQTT_HOST "192.168.1.10"
#define MQTT_PORT 1883
// Password gateway ini di broker. Username otomatis = ID gateway (lihat Serial Monitor).
// Kosongkan kalau broker tanpa password (Mosquitto lokal).
#define MQTT_PASSWORD ""
