import type { AppLanguage } from '@/i18n/language';

// Base semantic tone. StatusTone = versi tanpa neutral. Kelas warnanya di lib/toneClasses.ts.
export type SemanticTone = 'green' | 'yellow' | 'red' | 'neutral';

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
  updated_at: string;
}

export interface Reading {
  id: string;
  farm_id?: string | null;
  soil_moisture: number;
  soil_temp: number;
  air_temp: number;
  air_humidity: number;
  created_at: string;
}

export interface Node {
  id: string;
  name: string;
  location: string;
  status: string;
  battery: number;
  updated_at: string;
}

export interface IrrigationLog {
  id: string;
  node_id: string;
  soil_moisture: number;
  // String kondisi cuaca (mis. "Cerah Berawan"), terverifikasi smoke test 2026-09-22.
  weather: string;
  decision: string;
  valve_state: string;
  reason: string;
  created_at: string;
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
  forecast_time: string;
  updated_at: string;
  location_profile: { altitude_m: number };
  forecast: WeatherForecastPoint[];
}

export interface NodeSummary {
  node: Node;
  // null kalau node belum punya reading (routers/farms.py, summary)
  latest_reading: Reading | null;
  decision: { decision: string; valve_state: string } | null;
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
}
