import type { AppLanguage } from '@/i18n/language';

// Base semantic tone. StatusTone = versi tanpa neutral. Kelas warnanya di lib/toneClasses.ts.
export type SemanticTone = 'green' | 'yellow' | 'red' | 'neutral';

export type IrrigationMode = 'auto' | 'manual';

// Kebun bermulsa/beratap tidak kena hujan, jadi prediksi hujan hanya menunda irigasi
// untuk 'open'. Lihat irrigation.py effective_rain_next_3h.
export type GroundCover = 'open' | 'mulch' | 'roofed';

export interface Farm {
  id: string;
  name: string;
  location: string;
  crop_type: string;
  owner: string;
  area_ha: number;
  latitude: number;
  longitude: number;
  bmkg_adm4_code: string;
  status: string;
  irrigation_mode: IrrigationMode;
  ground_cover: GroundCover;
  updated_at: string;
  // Threshold VWC dari jenis tanaman. null = tanaman tidak dikenal, backend pakai default.
  lower_threshold?: number | null;
  upper_threshold?: number | null;
  // Irigasi Terbatas (limited_irrigation.py). null = tidak aktif. limited_until = UTC, format waktu server.
  limited_until?: string | null;
  limited_reason?: LimitedIrrigationReason | null;
}

export type LimitedIrrigationReason = 'flowering' | 'harvest' | 'other';

// Baris riwayat Irigasi Terbatas, hanya di decision_logs (bukan decision.type di summary).
export type LimitedIrrigationEvent =
  'limited_started' | 'limited_changed' | 'limited_stopped' | 'limited_ended';

export interface Reading {
  id: string;
  farm_id?: string | null;
  soil_moisture: number;
  soil_temp: number;
  air_temp: number;
  air_humidity: number;
  // dBm, diukur gateway saat menerima paket. null untuk reading tanpa laporan RSSI.
  rssi?: number | null;
  created_at: string;
}

export interface Node {
  id: string;
  name: string;
  location: string;
  // Diturunkan backend dari last_seen_at: offline kalau tidak ada data melewati batas waktu.
  status: 'online' | 'offline';
  // null kalau perangkat belum pernah melaporkan baterai.
  battery: number | null;
  last_seen_at?: string | null;
  // Perintah valve mode manual. sent_at NULL = belum terkirim ke alat (MQTT belum ada).
  valve_command: 'open' | 'closed' | null;
  valve_command_at: string | null;
  valve_command_sent_at: string | null;
  auto_paused_at?: string | null;
  // Waktu tutup otomatis valve yang dibuka manual (UTC, format waktu server).
  valve_auto_close_at: string | null;
  updated_at: string;
}

// Jenis keputusan irigasi dari backend (irrigation.py calculate_decision).
// disconnected hanya dari summary untuk node offline, tidak pernah tercatat di decision_logs.
// manual_* untuk kebun mode manual; manual_timeout hanya tercatat di decision_logs.
// manual_saturated: valve manual ditutup server karena tanah jenuh (reading >= 98%).
// soaking dan pulse_limit dari siram bertahap mode otomatis (irrigation.py auto_decision).
export type DecisionType =
  | 'open'
  | 'delayed'
  | 'closed'
  | 'standby'
  | 'disconnected'
  | 'manual_open'
  | 'manual_closed'
  | 'manual_timeout'
  | 'manual_saturated'
  | 'soaking'
  | 'pulse_limit'
  | 'check_irrigation';

interface IrrigationDecision {
  type: DecisionType;
  decision: string;
  valve_state: string;
  reason: string;
}

export interface IrrigationLog {
  id: string;
  node_id: string;
  soil_moisture: number;
  // String kondisi cuaca (mis. "Cerah Berawan"), terverifikasi smoke test 2026-09-22.
  weather: string;
  decision: string;
  // null untuk log lama yang teks keputusannya tidak dikenali saat migrasi.
  decision_type: DecisionType | LimitedIrrigationEvent | null;
  valve_state: string;
  reason: string;
  created_at: string;
  // Hanya terisi di baris Irigasi Terbatas.
  limited_until?: string | null;
  limited_reason?: LimitedIrrigationReason | null;
}

// GET /api/farms/{id}/gateway-logs → { items: GatewayLog[], total }
// Cocok dengan kolom tabel gateway_logs backend (id, farm_id, event, detail, created_at).
export interface GatewayLog {
  id: string | number;
  farm_id: string;
  event: string;
  detail: string;
  created_at: string;
}

export interface FarmGateway {
  id: number;
  device_id: string;
  farm_id: string | null;
  display_name: string | null;
  first_seen_at: string;
  last_seen_at: string | null;
  claimed_at: string | null;
}

export interface WeatherForecastPoint {
  local_datetime?: string;
  datetime?: string;
  utc_datetime?: string;
  weather?: number;
  weather_desc?: string;
  t?: number;
}

export interface Weather {
  region: { village: string; district: string; city: string; province: string };
  adm4: string;
  provider: string;
  condition: string;
  code: number;
  temperature: number;
  humidity: number;
  wind_speed: number;
  wind_direction: string;
  // boolean dari backend (bmkg.py: hasil any(...))
  rain_next_3h: boolean;
  // Total tp (mm) di jendela cek hujan; null kalau BMKG tidak mengirim angka tp.
  rain_next_3h_mm?: number | null;
  forecast_time: string;
  updated_at: string;
  location_profile: { altitude_m: number };
  forecast: WeatherForecastPoint[];
  is_stale?: boolean;
  fetched_at?: string;
}

export interface NodeSummary {
  node: Node;
  // null kalau node belum punya reading (routers/farms.py, summary)
  latest_reading: Reading | null;
  decision: IrrigationDecision | null;
}

export interface FarmSummary {
  farm: Farm;
  gateway_status: 'online' | 'offline';
  // null kalau belum ada reading sama sekali (routers/farms.py, summary)
  average_soil_moisture: number | null;
  thresholds: { lower: number; upper: number };
  nodes_problem: number;
  nodes: NodeSummary[];
  weather: Weather | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  language: AppLanguage;
}

// GET /api/crops → { crops: Crop[] } (routers/utils.py)
export interface Crop {
  name: string;
  lower_threshold: number;
  upper_threshold: number;
}

// Payload POST /api/farms (field dari addFarm/)
// PATCH /api/farms/{id}: semua field opsional, sama dengan schema FarmUpdate backend.
export interface UpdateFarmPayload {
  name?: string;
  owner?: string;
  location?: string;
  crop_type?: string;
  area_ha?: number | null;
  bmkg_adm4_code?: string;
  latitude?: number;
  longitude?: number;
  status?: string;
  ground_cover?: GroundCover;
}

export interface CreateFarmPayload {
  name: string;
  owner: string;
  location: string;
  crop_type: string;
  area_ha: number | null;
  bmkg_adm4_code: string;
  latitude: number;
  longitude: number;
  gateway_device_id: string;
  gateway_display_name: string;
  ground_cover: GroundCover;
}
