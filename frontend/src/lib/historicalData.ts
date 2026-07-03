// ponytail: DATA DUMMY/mock — BUKAN dari backend. Ganti dgn readings asli saat
// backend punya endpoint riwayat per-node. Dipakai untuk tile Min/Rata-rata/Maks
// + grafik historis kompak di kartu metrik Ringkasan Kebun (FarmDetailPage).

import { ENABLE_MOCK_NODE_FALLBACK, getMockNodeIdForNode, MOCK_READINGS } from '@/lib/mockFarmData';

export interface ChartPoint {
  label: string; // jam "HH.MM" (format id-ID), jarak antar titik 1 jam
  soil_moisture: number; // %
  soil_temp: number; // °C
  air_temp: number; // °C
  air_humidity: number; // %
}

// 6 titik, jarak 1 jam. Label = 6 jam terakhir s/d jam berjalan
// (mis. "08.00, 09.00, 10.00, 11.00, 12.00, 13.00").
const POINTS = 6;

function hourlyLabels(count: number): string[] {
  const anchor = new Date();
  anchor.setMinutes(0, 0, 0);
  const labels: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(anchor.getTime() - i * 3_600_000);
    labels.push(d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
  }
  return labels;
}

function historicalSeriesFromReadings(nodeId: string): ChartPoint[] {
  const labels = hourlyLabels(POINTS);
  const readings = (MOCK_READINGS[nodeId] ?? []).slice(0, POINTS).reverse();

  return readings.map((reading, index) => {
    return {
      label: labels[index] ?? '',
      soil_moisture: reading.soil_moisture,
      soil_temp: reading.soil_temp,
      air_temp: reading.air_temp,
      air_humidity: reading.air_humidity,
    };
  });
}

const mockNodeHistoricalData = Object.fromEntries(
  Object.keys(MOCK_READINGS).map((nodeId) => [nodeId, historicalSeriesFromReadings(nodeId)]),
) as Record<string, ChartPoint[]>;

const legacyAliases = ['node-a', 'node-b', 'node-c', 'node-d'];
const mockNodeIds = Object.keys(mockNodeHistoricalData);

// Alias node-a..d dipertahankan agar mock lama tetap tersambung.
export const historicalData: Record<string, ChartPoint[]> = {
  ...Object.fromEntries(
    legacyAliases.map((alias, index) => [alias, mockNodeHistoricalData[mockNodeIds[index] ?? ''] ?? []]),
  ),
  ...mockNodeHistoricalData,
};

export function getHistoricalDataForNode(nodeId: string): ChartPoint[] {
  if (!ENABLE_MOCK_NODE_FALLBACK) return [];

  const normalizedId = nodeId.trim().toLowerCase();
  if (historicalData[normalizedId]) return historicalData[normalizedId];

  const mockNodeId = getMockNodeIdForNode(normalizedId);
  return mockNodeId ? historicalData[mockNodeId] ?? [] : [];
}
