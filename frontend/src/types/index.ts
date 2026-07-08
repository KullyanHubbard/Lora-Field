// Base semantic tone — used by StatusTone (excludes neutral), GaugeTone, FarmStatusTone, LightTone.
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
  // ASUMSI - verifikasi dengan backend (string atau object?)
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

export interface WeatherForecastPoint {
  local_datetime?: string;
  datetime?: string;
  utc_datetime?: string;
  weather?: number;
  code?: number;
  weather_desc?: string;
  condition?: string;
  t?: number;
  temperature?: number;
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
  // boolean dari backend (main.py:335 → hasil any(...) berupa bool)
  rain_next_3h: boolean;
  forecast_time: string;
  updated_at: string;
  location_profile: { altitude_m: number };
  forecast: WeatherForecastPoint[];
}

export interface NodeSummary {
  node: Node;
  // backend kirim null kalau node belum punya reading (main.py:1063)
  latest_reading: Reading | null;
  decision: { decision: string; valve_state: string } | null;
  signal_rssi?: string; // client-side fallback/mock sampai backend punya field RSSI
}

export interface FarmSummary {
  farm: Farm;
  gateway_status: 'online' | 'offline';
  // null kalau belum ada reading sama sekali (main.py:1070)
  average_soil_moisture: number | null;
  thresholds: { lower: number; upper: number };
  nodes_problem: number;
  nodes: NodeSummary[];
  weather: Weather | null;
  is_mock_data?: boolean; // flag client-side saja, TIDAK ada di response backend asli — jangan dikira field API
}

// ASUMSI - verifikasi dengan backend (isi User belum kelihatan penuh)
export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

// GET /api/crops → { crops: Crop[] } (diverifikasi dari backend main.py)
export interface Crop {
  name: string;
  lower_threshold: number;
  upper_threshold: number;
}

// Payload POST /api/farms (field dari addFarm/)
export interface CreateFarmPayload {
  name: string;
  owner: string;
  location: string;
  crop_type: string;
  area_ha: number | null;
  bmkg_adm4_code: string;
  latitude: number;
  longitude: number;
}
