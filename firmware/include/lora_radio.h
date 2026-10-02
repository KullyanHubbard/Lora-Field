// Menyalakan radio LoRa. Dipakai gateway dan node: frekuensi, spreading factor, sync word, dan CRC wajib
// sama di keduanya, jadi urutannya ditulis sekali di sini.
#pragma once

#include <Arduino.h>
#include <LoRa.h>
#include <SPI.h>

#include "config.h"

inline void startLoRaRadio() {
  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_SS);
  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);
  while (!LoRa.begin(LORA_FREQUENCY)) {
    Serial.println("Radio LoRa tidak terdeteksi, cek pin di config.h");
    delay(2000);
  }
  LoRa.setSpreadingFactor(LORA_SPREADING_FACTOR);
  LoRa.setTxPower(LORA_TX_POWER_DBM);  // batas daya pancar Indonesia, lihat config.h
  LoRa.setSyncWord(LORA_SYNC_WORD);
  LoRa.enableCrc();
}
