// DATA DUMMY — bukan dari backend. Dipakai hanya sebagai fallback tampilan saat farm belum punya node sensor asli.

import type { IrrigationLog, Node, NodeSummary, Reading } from '@/types';

export const MOCK_NODES: Node[] = [
  {
    id: 'mock-node-1',
    name: 'Node Contoh A',
    location: 'Blok Utara',
    status: 'online',
    battery: 82,
    updated_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  },
  {
    id: 'mock-node-2',
    name: 'Node Contoh B',
    location: 'Blok Selatan',
    status: 'standby',
    battery: 55,
    updated_at: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
  },
];

const makeReading = (id: string, _nodeId: string, offsetMs: number): Reading => ({
  id,
  soil_moisture: 35 + Math.floor(Math.sin(offsetMs / 3_600_000) * 12),
  soil_temp: 28,
  air_temp: 31,
  air_humidity: 72,
  created_at: new Date(Date.now() - offsetMs).toISOString(),
});

export const MOCK_READINGS: Record<string, Reading[]> = {
  'mock-node-1': [
    makeReading('mock-r1-1', 'mock-node-1', 0),
    makeReading('mock-r1-2', 'mock-node-1', 30 * 60 * 1000),
    makeReading('mock-r1-3', 'mock-node-1', 60 * 60 * 1000),
    makeReading('mock-r1-4', 'mock-node-1', 90 * 60 * 1000),
    makeReading('mock-r1-5', 'mock-node-1', 120 * 60 * 1000),
  ],
  'mock-node-2': [
    makeReading('mock-r2-1', 'mock-node-2', 0),
    makeReading('mock-r2-2', 'mock-node-2', 30 * 60 * 1000),
    makeReading('mock-r2-3', 'mock-node-2', 60 * 60 * 1000),
    makeReading('mock-r2-4', 'mock-node-2', 90 * 60 * 1000),
    makeReading('mock-r2-5', 'mock-node-2', 120 * 60 * 1000),
  ],
};

// soil_moisture 35 < threshold lower (40) → irigasi dijalankan, valve open
export function mockNodeSummaries(): NodeSummary[] {
  return MOCK_NODES.map((node) => ({
    node,
    latest_reading: MOCK_READINGS[node.id][0],
    decision: {
      decision: 'Irigasi dijalankan',
      valve_state: 'open',
    },
  }));
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
