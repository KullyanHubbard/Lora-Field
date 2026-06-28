// DATA DUMMY — bukan dari backend. Dipakai hanya sebagai fallback tampilan saat farm belum punya node sensor asli.

import type { GatewayLog, IrrigationLog, Node, NodeSummary, Reading } from '@/types';

export const MOCK_NODES: Node[] = [
  {
    id: 'mock-node-1',
    name: 'Node A',
    location: 'Blok Utara',
    status: 'online',
    battery: 88,
    updated_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  },
  {
    id: 'mock-node-2',
    name: 'Node B',
    location: 'Blok Selatan',
    status: 'online',
    battery: 20,
    updated_at: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
  },
  {
    id: 'mock-node-3',
    name: 'Node C',
    location: 'Blok Timur',
    status: 'online',
    battery: 92,
    updated_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
  {
    id: 'mock-node-4',
    name: 'Node D',
    location: 'Blok Barat',
    status: 'online',
    battery: 16,
    updated_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
  },
  {
    id: 'mock-node-5',
    name: 'Node E',
    location: 'Blok Tengah',
    status: 'online',
    battery: 81,
    updated_at: new Date(Date.now() - 180 * 60 * 1000).toISOString(),
  },
  {
    id: 'mock-node-6',
    name: 'Node F',
    location: 'Blok Tenggara',
    status: 'online',
    battery: 95,
    updated_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
  },
  {
    id: 'mock-node-7',
    name: 'Node G',
    location: 'Blok Barat Laut',
    status: 'online',
    battery: 73,
    updated_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
];

// Threshold demo: lower=40, upper=70 (sesuai komentar inline kode lama)
// moisture < 40 → valve open (irigasi); moisture ≥ 40 → valve closed (berhenti)
// HOUR = jam mundur dari now. Setiap node punya 6 sampling (0, 12, 24, 36, 48, 60 jam).
const HOUR = 60 * 60 * 1000;
function mockReadingsFor(base: { sm: number; st: number; at: number; ah: number }[], nodeId: string): Reading[] {
  return base.map((v, i) => ({
    id: `mock-${nodeId}-r${i}`,
    soil_moisture: v.sm,
    soil_temp: v.st,
    air_temp: v.at,
    air_humidity: v.ah,
    created_at: new Date(Date.now() - i * 12 * HOUR).toISOString(),
  }));
}

export const MOCK_READINGS: Record<string, Reading[]> = {
  'mock-node-1': mockReadingsFor([
    { sm: 35, st: 28, at: 31, ah: 72 },
    { sm: 33, st: 29, at: 32, ah: 70 },
    { sm: 38, st: 28, at: 30, ah: 73 },
    { sm: 32, st: 27, at: 31, ah: 71 },
    { sm: 36, st: 28, at: 31, ah: 72 },
    { sm: 30, st: 29, at: 30, ah: 74 },
  ], 'mock-node-1'),
  'mock-node-2': mockReadingsFor([
    { sm: 72, st: 27, at: 30, ah: 68 },
    { sm: 68, st: 28, at: 31, ah: 67 },
    { sm: 74, st: 27, at: 30, ah: 69 },
    { sm: 60, st: 26, at: 29, ah: 70 },
    { sm: 70, st: 27, at: 30, ah: 68 },
    { sm: 65, st: 28, at: 30, ah: 69 },
  ], 'mock-node-2'),
  'mock-node-3': mockReadingsFor([
    { sm: 28, st: 29, at: 32, ah: 65 },
    { sm: 26, st: 30, at: 33, ah: 64 },
    { sm: 30, st: 29, at: 32, ah: 66 },
    { sm: 22, st: 31, at: 34, ah: 63 },
    { sm: 27, st: 29, at: 32, ah: 65 },
    { sm: 25, st: 30, at: 33, ah: 64 },
  ], 'mock-node-3'),
  'mock-node-4': mockReadingsFor([
    { sm: 65, st: 26, at: 29, ah: 74 },
    { sm: 63, st: 27, at: 30, ah: 73 },
    { sm: 68, st: 26, at: 29, ah: 75 },
    { sm: 60, st: 27, at: 28, ah: 76 },
    { sm: 66, st: 26, at: 29, ah: 74 },
    { sm: 62, st: 27, at: 29, ah: 75 },
  ], 'mock-node-4'),
  'mock-node-5': mockReadingsFor([
    { sm: 57, st: 27, at: 30, ah: 72 },
    { sm: 55, st: 28, at: 31, ah: 71 },
    { sm: 60, st: 27, at: 30, ah: 73 },
    { sm: 52, st: 28, at: 30, ah: 72 },
    { sm: 58, st: 27, at: 31, ah: 71 },
    { sm: 54, st: 28, at: 30, ah: 72 },
  ], 'mock-node-5'),
  'mock-node-6': mockReadingsFor([
    { sm: 48, st: 27, at: 31, ah: 70 },
    { sm: 46, st: 28, at: 31, ah: 69 },
    { sm: 50, st: 27, at: 31, ah: 70 },
    { sm: 42, st: 28, at: 30, ah: 71 },
    { sm: 47, st: 27, at: 31, ah: 70 },
    { sm: 44, st: 28, at: 30, ah: 71 },
  ], 'mock-node-6'),
  'mock-node-7': mockReadingsFor([
    { sm: 19, st: 30, at: 33, ah: 61 },
    { sm: 17, st: 31, at: 34, ah: 60 },
    { sm: 22, st: 30, at: 33, ah: 62 },
    { sm: 15, st: 32, at: 35, ah: 59 },
    { sm: 20, st: 30, at: 33, ah: 61 },
    { sm: 18, st: 31, at: 34, ah: 60 },
  ], 'mock-node-7'),
};

export function mockNodeSummaries(): NodeSummary[] {
  return MOCK_NODES.map((node) => {
    const readings = MOCK_READINGS[node.id];
    const latest_reading = readings?.[0] ?? null;
    const moisture = latest_reading?.soil_moisture ?? null;
    let decision: { decision: string; valve_state: string } | null = null;
    if (moisture != null) {
      decision =
        moisture < 40
          ? { decision: 'Irigasi dijalankan', valve_state: 'open' }
          : { decision: 'Irigasi berhenti', valve_state: 'closed' };
    }
    return { node, latest_reading, decision };
  });
}

export const MOCK_LOGS: IrrigationLog[] = [
  {
    id: 'mock-log-1',
    node_id: 'mock-node-1',
    soil_moisture: 33,
    weather: 'Cerah',
    decision: 'Irigasi dijalankan',
    valve_state: 'open',
    reason: 'Kelembapan tanah di bawah threshold, tidak ada prediksi hujan.',
    created_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'mock-log-2',
    node_id: 'mock-node-2',
    soil_moisture: 28,
    weather: 'Cerah',
    decision: 'Irigasi dijalankan',
    valve_state: 'open',
    reason: 'Kelembapan tanah di bawah threshold, tidak ada prediksi hujan.',
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'mock-log-3',
    node_id: 'mock-node-1',
    soil_moisture: 62,
    weather: 'Hujan ringan',
    decision: 'Irigasi ditunda',
    valve_state: 'closed',
    reason: 'BMKG memprediksi hujan dalam 3 jam ke depan.',
    created_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'mock-log-4',
    node_id: 'mock-node-2',
    soil_moisture: 75,
    weather: 'Berawan',
    decision: 'Irigasi berhenti',
    valve_state: 'closed',
    reason: 'Kelembapan tanah sudah cukup, valve ditutup.',
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'mock-log-5',
    node_id: 'mock-node-1',
    soil_moisture: 38,
    weather: 'Cerah berawan',
    decision: 'Irigasi dijalankan',
    valve_state: 'open',
    reason: 'Kelembapan tanah di bawah threshold, tidak ada prediksi hujan.',
    created_at: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
  },
];

// DATA DUMMY — log aktivitas gateway. Dipakai sebagai placeholder di halaman
// Ringkasan Kebun saat backend belum mengirim log koneksi gateway.
// Spread ~3 hari, campuran connected / disconnected / heartbeat / data_sync.
const H = 60 * 60 * 1000;
export const MOCK_GATEWAY_LOGS: GatewayLog[] = (() => {
  const logs: GatewayLog[] = [];
  const events = [
    { event: 'connected', detail: 'Gateway berhasil terhubung melalui WiFi' },
    { event: 'heartbeat', detail: 'Heartbeat OK — 4 node aktif' },
    { event: 'data_sync', detail: 'Sinkronisasi 7 pembacaan sensor ke server' },
    { event: 'heartbeat', detail: 'Heartbeat OK — 4 node aktif' },
    { event: 'data_sync', detail: 'Sinkronisasi 5 pembacaan sensor ke server' },
    { event: 'disconnected', detail: 'Koneksi WiFi terputus sementara' },
    { event: 'connected', detail: 'Gateway berhasil terhubung kembali' },
    { event: 'heartbeat', detail: 'Heartbeat OK — 3 node aktif' },
    { event: 'data_sync', detail: 'Sinkronisasi 6 pembacaan sensor ke server' },
    { event: 'heartbeat', detail: 'Heartbeat OK — 4 node aktif' },
    { event: 'data_sync', detail: 'Sinkronisasi 7 pembacaan sensor ke server' },
    { event: 'heartbeat', detail: 'Heartbeat OK — 4 node aktif' },
    { event: 'disconnected', detail: 'Koneksi WiFi terputus (listrik padam)' },
    { event: 'connected', detail: 'Gateway berhasil terhubung melalui WiFi' },
    { event: 'heartbeat', detail: 'Heartbeat OK — 4 node aktif' },
    { event: 'data_sync', detail: 'Sinkronisasi 7 pembacaan sensor ke server' },
    { event: 'heartbeat', detail: 'Heartbeat OK — 4 node aktif' },
    { event: 'data_sync', detail: 'Sinkronisasi 6 pembacaan sensor ke server' },
    { event: 'heartbeat', detail: 'Heartbeat OK — 3 node aktif' },
    { event: 'data_sync', detail: 'Sinkronisasi 5 pembacaan sensor ke server' },
  ];
  // 20 entries, spread mundur ~6 jam per entry = ~5 hari coverage
  for (let i = 0; i < events.length; i++) {
    const offset = (i * 6 + 4) * H;
    logs.push({
      id: `mock-gwlog-${i + 1}`,
      farm_id: '',
      event: events[i].event,
      detail: events[i].detail,
      created_at: new Date(Date.now() - offset).toISOString(),
    });
  }
  return logs;
})();
